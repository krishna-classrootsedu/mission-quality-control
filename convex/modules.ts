import { internalMutation, internalQuery, mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { logActivityIfNew, isModuleDeleted } from "./lib/activityHelper";
import { ROLES, canAccessModule, getModulesForUser, requireAnyRole, requireCurrentUser } from "./lib/authz";

// Valid pipeline statuses
const VALID_STATUSES = [
  "submitted",
  "intake_complete",
  "intake_flagged",
  "intake_failed",
  "gatekeeper_pass",
  "gatekeeper_fail",
  "flow_mapped",
  "researched",
  "all_reviews_complete",
  "review_complete",
  "vinay_reviewed",
  "creator_fixing",
  "ship_ready",
  "corrections_intake_complete",
  "corrections_review_complete",
] as const;

const DEFAULT_MODULE_PAGE_LIMIT = 50;
const MAX_MODULE_PAGE_LIMIT = 200;

function normalizePageLimit(limit?: number) {
  const safe = limit ?? DEFAULT_MODULE_PAGE_LIMIT;
  return Math.max(1, Math.min(MAX_MODULE_PAGE_LIMIT, Math.floor(safe)));
}

async function ensureUploaderModuleAccess(
  ctx: Pick<MutationCtx, "db">,
  moduleId: string,
  userId: Id<"users">,
  now: string
) {
  const existing = await ctx.db
    .query("modulePermissions")
    .withIndex("by_moduleId_userId", (q) => q.eq("moduleId", moduleId).eq("userId", userId))
    .first();

  const mergedPermissions = Array.from(
    new Set([...(existing?.permissions ?? []), "module:view", "module:review"])
  );

  if (existing) {
    await ctx.db.patch(existing._id, {
      permissions: mergedPermissions,
      grantSource: existing.grantSource ?? "uploader_auto_grant",
      updatedAt: now,
    });
    return;
  }

  await ctx.db.insert("modulePermissions", {
    moduleId,
    userId,
    permissions: ["module:view", "module:review"],
    grantSource: "uploader_auto_grant",
    createdAt: now,
    updatedAt: now,
  });
}

// Upsert a module — new submission or re-submission
export const upsert = internalMutation({
  args: {
    moduleId: v.string(),
    title: v.string(),
    learningObjective: v.string(),
    grade: v.number(),
    chapterNumber: v.optional(v.number()),
    chapterName: v.optional(v.string()),
    moduleNumber: v.optional(v.number()),
    cp: v.optional(v.string()),
    tp: v.optional(v.string()),
    phase: v.optional(v.string()),
    topic: v.optional(v.string()),
    pptxFileUrl: v.optional(v.string()),
    slideCount: v.optional(v.number()),
    submittedBy: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // Check for existing module
    const existing = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    // If module was deleted, treat as non-existent (don't resurrect)
    if (existing && existing.deleted) {
      return { id: existing._id, action: "module_deleted", version: existing.version };
    }

    // Re-submit: only allowed from vinay_reviewed or creator_fixing
    if (existing) {
      const resubmitAllowed = ["vinay_reviewed", "creator_fixing"];
      if (resubmitAllowed.includes(existing.status)) {
        const newVersion = existing.version + 1;
        const id = await ctx.db.insert("modules", {
          ...args,
          status: "submitted",
          version: newVersion,
          submittedAt: now,
          updatedAt: now,
        });
        await logActivityIfNew(ctx, {
          agentName: "system",
          action: "module_resubmitted",
          message: `Module "${args.title}" re-submitted as v${newVersion}`,
          dedupKey: `module-resubmit-${args.moduleId}-v${newVersion}`,
          metadata: { moduleId: args.moduleId, version: newVersion },
        });
        return { id, action: "resubmitted", version: newVersion };
      }
      // Already exists and not in a re-submit state — return existing
      return { id: existing._id, action: "already_exists", version: existing.version };
    }

    // New module
    const id = await ctx.db.insert("modules", {
      ...args,
      status: "submitted",
      version: 1,
      submittedAt: now,
      updatedAt: now,
    });
    await logActivityIfNew(ctx, {
      agentName: "system",
      action: "module_submitted",
      message: `Module "${args.title}" submitted`,
      dedupKey: `module-submit-${args.moduleId}-v1`,
      metadata: { moduleId: args.moduleId },
    });
    return { id, action: "created", version: 1 };
  },
});

// Update module status (called by any agent to advance pipeline)
export const updateStatus = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.optional(v.number()),
    status: v.string(),
    agentName: v.optional(v.string()),
    // Optional denormalized score data
    overallScore: v.optional(v.number()),
    overallPercentage: v.optional(v.number()),
    scoreBand: v.optional(v.string()),
    researchBrief: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (!VALID_STATUSES.includes(args.status as typeof VALID_STATUSES[number])) {
      throw new Error(`Invalid status: ${args.status}`);
    }

    const query = ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc");

    const module = await query.first();
    if (!module) throw new Error(`Module not found: ${args.moduleId}`);
    if (module.deleted) return; // Silently bail for deleted modules
    if (args.version && module.version !== args.version) {
      throw new Error(`Version mismatch: expected ${args.version}, found ${module.version}`);
    }

    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      status: args.status,
      updatedAt: now,
    };
    if (args.overallScore !== undefined) patch.overallScore = args.overallScore;
    if (args.overallPercentage !== undefined) patch.overallPercentage = args.overallPercentage;
    if (args.scoreBand !== undefined) patch.scoreBand = args.scoreBand;
    if (args.researchBrief !== undefined) patch.researchBrief = args.researchBrief;
    if (args.status === "ship_ready") patch.completedAt = now;

    await ctx.db.patch(module._id, patch);

    await logActivityIfNew(ctx, {
      agentName: args.agentName ?? "system",
      action: "module_status_changed",
      message: `Module "${module.title}" → ${args.status}`,
      dedupKey: `module-status-${args.moduleId}-v${module.version}-${args.status}`,
      metadata: { moduleId: args.moduleId, version: module.version, newStatus: args.status },
    });
  },
});

// List modules, optionally filtered by status
export const list = query({
  args: { status: v.optional(v.string()) },
  handler: async (ctx, { status }) => {
    const { modules } = await getModulesForUser(ctx);
    if (status) {
      return modules.filter((m) => m.status === status);
    }
    return modules;
  },
});

// Paginated module list for large datasets (keeps `list` backward-compatible).
export const listPaginated = query({
  args: {
    status: v.optional(v.string()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, cursor, limit }) => {
    const { modules } = await getModulesForUser(ctx);
    const filtered = status ? modules.filter((m) => m.status === status) : modules;
    const pageLimit = normalizePageLimit(limit);
    const start = cursor ?? 0;
    const page = filtered.slice(start, start + pageLimit);
    const continueCursor = start + page.length;
    const isDone = continueCursor >= filtered.length;
    return {
      page,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

// Detail for a single module (latest version or specific version, excluding deleted)
export const detail = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    if (version !== undefined) {
      // Fetch specific version
      const all = await ctx.db
        .query("modules")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
        .collect();
      const match = all.find((m) => m.version === version && !m.deleted);
      return match ?? null;
    }
    // Latest version
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .order("desc")
      .first();
    if (module?.deleted) return null;
    return module;
  },
});

// Generate an upload URL for Convex file storage (public — called by UI)
export const generateUploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAnyRole(ctx, [
      ROLES.CONTENT_CREATOR,
      ROLES.LEAD_REVIEWER,
      ROLES.MANAGER,
      ROLES.ADMIN,
    ]);
    return await ctx.storage.generateUploadUrl();
  },
});

// Submit a module with an uploaded PPTX file (public — called by UI)
export const submitModule = mutation({
  args: {
    title: v.string(),
    learningObjective: v.string(),
    grade: v.number(),
    chapterNumber: v.optional(v.number()),
    chapterName: v.optional(v.string()),
    moduleNumber: v.optional(v.number()),
    cp: v.optional(v.string()),
    tp: v.optional(v.string()),
    phase: v.optional(v.string()),
    topic: v.optional(v.string()),
    submittedBy: v.string(),
    pptxStorageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await requireAnyRole(ctx, [
      ROLES.CONTENT_CREATOR,
      ROLES.LEAD_REVIEWER,
      ROLES.MANAGER,
      ROLES.ADMIN,
    ]);
    const now = new Date().toISOString();

    const slug = args.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const moduleId = `MOD-${slug}-${crypto.randomUUID()}`;

    const pptxFileUrl = await ctx.storage.getUrl(args.pptxStorageId);

    const existing = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .first();
    if (existing) {
      throw new Error(`Module with this ID already exists. Try a different title.`);
    }

    const id = await ctx.db.insert("modules", {
      moduleId,
      title: args.title,
      learningObjective: args.learningObjective,
      grade: args.grade,
      phase: args.phase,
      topic: args.topic,
      pptxFileUrl: pptxFileUrl ?? undefined,
      status: "submitted",
      version: 1,
      submittedBy: args.submittedBy,
      submittedByUserId: user._id,
      submittedAt: now,
      updatedAt: now,
    });

    await logActivityIfNew(ctx, {
      agentName: "system",
      action: "module_submitted",
      message: `Module "${args.title}" submitted by ${args.submittedBy}`,
      dedupKey: `module-submit-${moduleId}-v1`,
      metadata: { moduleId, fileName: args.fileName, submittedBy: args.submittedBy },
    });

    await ensureUploaderModuleAccess(ctx, moduleId, user._id, now);

    return { id, moduleId, version: 1 };
  },
});

// Submit a module with multi-file flow (spine + applets)
export const submitModuleWithFlow = mutation({
  args: {
    title: v.string(),
    learningObjective: v.string(),
    grade: v.number(),
    chapterNumber: v.optional(v.number()),
    chapterName: v.optional(v.string()),
    moduleNumber: v.optional(v.number()),
    cp: v.optional(v.string()),
    tp: v.optional(v.string()),
    phase: v.optional(v.string()),
    topic: v.optional(v.string()),
    submittedBy: v.string(),
    sourceFiles: v.array(v.object({
      filename: v.string(),
      type: v.string(),
      label: v.string(),
      afterSpineSlide: v.optional(v.number()),
      slideCount: v.number(),
      storageId: v.optional(v.id("_storage")),
    })),
    slides: v.array(v.object({
      slideNumber: v.number(),
      sourceFile: v.string(),
      sourceSlideNumber: v.number(),
      textContent: v.optional(v.string()),
      speakerNotes: v.optional(v.string()),
      layoutType: v.optional(v.string()),
      hasAnimation: v.optional(v.boolean()),
      animationSequence: v.optional(v.any()),
      morphPairWith: v.optional(v.number()),
      metadata: v.optional(v.any()),
      thumbnailStorageId: v.optional(v.id("_storage")),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireAnyRole(ctx, [
      ROLES.CONTENT_CREATOR,
      ROLES.LEAD_REVIEWER,
      ROLES.MANAGER,
      ROLES.ADMIN,
    ]);
    const now = new Date().toISOString();

    const slug = args.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const moduleId = `MOD-${slug}-${crypto.randomUUID()}`;

    const totalApplets = args.sourceFiles.filter((f) => f.type === "applet").length;

    const totalSlides = args.slides.length;
    const moduleDocId = await ctx.db.insert("modules", {
      moduleId,
      title: args.title,
      learningObjective: args.learningObjective,
      grade: args.grade,
      chapterNumber: args.chapterNumber,
      chapterName: args.chapterName,
      moduleNumber: args.moduleNumber,
      cp: args.cp,
      tp: args.tp,
      phase: args.phase,
      topic: args.topic,
      slideCount: totalSlides,
      sourceFiles: args.sourceFiles,
      status: "intake_complete",
      version: 1,
      totalApplets,
      completedAppletReviews: 0,
      spineComplete: false,
      submittedBy: args.submittedBy,
      submittedByUserId: user._id,
      submittedAt: now,
      updatedAt: now,
    });

    // Batch-insert parsed slides
    for (const slide of args.slides) {
      await ctx.db.insert("parsedSlides", {
        moduleId,
        version: 1,
        slideNumber: slide.slideNumber,
        sourceFile: slide.sourceFile,
        sourceSlideNumber: slide.sourceSlideNumber,
        textContent: slide.textContent,
        speakerNotes: slide.speakerNotes,
        layoutType: slide.layoutType,
        hasAnimation: slide.hasAnimation,
        animationSequence: slide.animationSequence,
        morphPairWith: slide.morphPairWith,
        metadata: slide.metadata,
        thumbnailStorageId: slide.thumbnailStorageId,
        agentName: "upload-ui",
        createdAt: now,
      });
    }

    // Create intake results record
    await ctx.db.insert("intakeResults", {
      moduleId,
      version: 1,
      slideCount: totalSlides,
      slideTypes: {},
      flags: [],
      agentName: "upload-ui",
      completedAt: now,
      dedupKey: `intake-${moduleId}-v1`,
    });

    await logActivityIfNew(ctx, {
      agentName: "system",
      action: "module_submitted_with_flow",
      message: `Module "${args.title}" submitted with ${args.sourceFiles.length} source file(s), ${totalSlides} slides`,
      dedupKey: `module-submit-flow-${moduleId}-v1`,
      metadata: { moduleId, sourceFileCount: args.sourceFiles.length, slideCount: totalSlides },
    });

    await ensureUploaderModuleAccess(ctx, moduleId, user._id, now);

    return { id: moduleDocId, moduleId, version: 1, slideCount: totalSlides };
  },
});

// Finalize review — calculate overall score from all reviewScores and transition to review_complete
// Backup path: used when Integrator is paused. Orchestrator calls this directly.
export const finalizeReview = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    agentName: v.string(),
    dedupKey: v.string(),
  },
  handler: async (ctx, args) => {
    if (await isModuleDeleted(ctx, args.moduleId)) return { action: "module_deleted" };

    // Dedup
    const existing = await ctx.db
      .query("agentActivity")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", `activity-${args.dedupKey}`))
      .first();
    if (existing) return { action: "duplicate" };

    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();
    if (!module) throw new Error(`Module not found: ${args.moduleId}`);
    if (module.version !== args.version) {
      throw new Error(`Version mismatch: expected ${args.version}, found ${module.version}`);
    }
    if (module.status !== "all_reviews_complete") {
      throw new Error(`Module status must be all_reviews_complete, got: ${module.status}`);
    }

    // Query all review scores for this module+version
    const scores = await ctx.db
      .query("reviewScores")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", args.moduleId).eq("version", args.version)
      )
      .collect();

    if (scores.length === 0) {
      throw new Error(`No review scores found for ${args.moduleId} v${args.version}`);
    }

    // Calculate overall score = average of all component totalPoints
    const totalSum = scores.reduce((sum, s) => sum + s.totalPoints, 0);
    const overallScore = Math.round(totalSum / scores.length);
    const overallPercentage = overallScore; // Each component is out of 100

    // Determine score band
    let scoreBand: string;
    if (overallScore >= 90) scoreBand = "Ship-ready";
    else if (overallScore >= 75) scoreBand = "Upgradeable";
    else if (overallScore >= 50) scoreBand = "Rework";
    else scoreBand = "Redesign";

    const now = new Date().toISOString();
    await ctx.db.patch(module._id, {
      status: "review_complete",
      overallScore,
      overallPercentage,
      scoreBand,
      updatedAt: now,
    });

    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: "review_finalized",
      message: `Review finalized for "${module.title}" — ${overallScore}/100 (${scoreBand})`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, overallScore, scoreBand },
    });

    return { action: "finalized", overallScore, overallPercentage, scoreBand };
  },
});

// Finalize corrections review — recalculate score from fixStatus verdicts
// Called from frontend when Vinay completes review of corrections-checker results.
// Also callable from HTTP route for Orchestrator.
async function finalizeCorrectionsReviewImpl(
  ctx: Pick<MutationCtx, "db">,
  moduleId: string,
  version: number
) {
  const module = await ctx.db
    .query("modules")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .order("desc")
    .first();
  if (!module) throw new Error(`Module not found: ${moduleId}`);
  if (module.deleted) throw new Error("Module has been deleted");
  if (module.version !== version) {
    throw new Error(`Version mismatch: expected ${version}, found ${module.version}`);
  }
  if (module.status !== "corrections_review_complete") {
    throw new Error(`Module must be in corrections_review_complete status, got: ${module.status}`);
  }

  // Get corrections-check recs for this version
  const allRecs = await ctx.db
    .query("recommendations")
    .withIndex("by_moduleId_version", (q) =>
      q.eq("moduleId", moduleId).eq("version", version)
    )
    .collect();

  const correctionsRecs = allRecs.filter((r) => r.sourcePass === "corrections_check");
  const pending = correctionsRecs.filter((r) => r.reviewStatus === "pending");
  if (pending.length > 0) {
    throw new Error(`${pending.length} corrections verdicts still pending. Review all before completing.`);
  }

  // Get previous version's score as baseline
  const prevVersion = version - 1;
  const prevModules = await ctx.db
    .query("modules")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .collect();
  const prevModule = prevModules.find((m) => m.version === prevVersion && !m.deleted);
  const baseScore = prevModule?.overallScore ?? 0;

  // Calculate recovered points from accepted verdicts
  const accepted = correctionsRecs.filter((r) => r.reviewStatus === "accepted");
  let recoveredPoints = 0;
  let fixedCount = 0;
  let partialCount = 0;
  let notFixedCount = 0;

  for (const rec of accepted) {
    const pts = rec.pointsRecoverable ?? 0;
    if (rec.fixStatus === "fixed") {
      recoveredPoints += pts;
      fixedCount++;
    } else if (rec.fixStatus === "partially_fixed") {
      recoveredPoints += pts * 0.5;
      partialCount++;
    } else {
      notFixedCount++;
    }
  }

  const newScore = Math.min(Math.round(baseScore + recoveredPoints), 100);

  let scoreBand: string;
  if (newScore >= 90) scoreBand = "Ship-ready";
  else if (newScore >= 75) scoreBand = "Upgradeable";
  else if (newScore >= 50) scoreBand = "Rework";
  else scoreBand = "Redesign";

  const now = new Date().toISOString();
  await ctx.db.patch(module._id, {
    status: "vinay_reviewed",
    overallScore: newScore,
    overallPercentage: newScore,
    scoreBand,
    updatedAt: now,
  });

  return {
    previousScore: baseScore,
    recoveredPoints: Math.round(recoveredPoints * 10) / 10,
    newScore,
    scoreBand,
    fixedCount,
    partialCount,
    notFixedCount,
    totalVerdicts: correctionsRecs.length,
  };
}

export const finalizeCorrectionsReview = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    await requireAnyRole(ctx, [ROLES.LEAD_REVIEWER, ROLES.MANAGER, ROLES.ADMIN]);
    return await finalizeCorrectionsReviewImpl(ctx, moduleId, version);
  },
});

export const internalFinalizeCorrectionsReview = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    return await finalizeCorrectionsReviewImpl(ctx, moduleId, version);
  },
});

export const markShipReady = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    const actor = await requireAnyRole(ctx, [ROLES.MANAGER, ROLES.ADMIN]);
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const actorUser = await ctx.db.get(actor._id);
    const actorName = actorUser?.name?.trim() || actorUser?.email?.trim() || actor.role;

    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .order("desc")
      .first();
    if (!module) throw new Error(`Module not found: ${moduleId}`);
    if (module.deleted) throw new Error("Module has been deleted");
    if (module.version !== version) {
      throw new Error(`Version mismatch: expected ${version}, found ${module.version}`);
    }

    const eligibleStatuses = [
      "review_complete",
      "vinay_reviewed",
      "corrections_intake_complete",
      "corrections_review_complete",
    ] as const;
    if (!eligibleStatuses.includes(module.status as (typeof eligibleStatuses)[number])) {
      throw new Error(
        `Module must be in vinay review bucket or corrections flow to mark ship ready, got: ${module.status}`
      );
    }

    const now = new Date().toISOString();
    await ctx.db.patch(module._id, {
      status: "ship_ready",
      updatedAt: now,
      completedAt: now,
    });

    await logActivityIfNew(ctx, {
      agentName: actorName,
      action: "module_marked_ship_ready",
      message: `Module "${module.title}" marked ship-ready by ${actorName}`,
      dedupKey: `module-mark-ship-ready-${module.moduleId}-v${module.version}`,
      metadata: {
        moduleId: module.moduleId,
        version: module.version,
        actorUserId: actor._id,
        actorRole: actor.role,
        actorName,
        previousStatus: module.status,
        newStatus: "ship_ready",
      },
    });

    return { success: true, moduleId: module.moduleId, version: module.version, status: "ship_ready" };
  },
});

// Modules eligible for corrections submission (vinay_reviewed or creator_fixing)
export const correctableModules = query({
  args: {},
  handler: async (ctx) => {
    const user = await requireCurrentUser(ctx, { allowFirstLogin: true });
    const all = await ctx.db.query("modules").order("desc").take(200);
    return all
      .filter((m) => {
        if (m.deleted) return false;
        if (!["vinay_reviewed", "creator_fixing"].includes(m.status)) return false;
        if (user.role === ROLES.CONTENT_CREATOR) {
          return m.submittedByUserId === user._id;
        }
        return true;
      })
      .map((m) => ({
        _id: m._id,
        moduleId: m.moduleId,
        title: m.title,
        version: m.version,
        grade: m.grade,
        chapterNumber: m.chapterNumber ?? null,
        chapterName: m.chapterName ?? null,
        moduleNumber: m.moduleNumber ?? null,
        status: m.status,
        overallScore: m.overallScore ?? null,
        scoreBand: m.scoreBand ?? null,
        updatedAt: m.updatedAt,
      }));
  },
});

// All versions of a module (for version selector in module detail)
export const allVersions = query({
  args: { moduleId: v.string() },
  handler: async (ctx, { moduleId }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const versions = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .order("desc")
      .collect();
    return versions
      .filter((m) => !m.deleted)
      .map((m) => ({ _id: m._id, version: m.version, status: m.status, updatedAt: m.updatedAt }));
  },
});

// Submit corrections — creates new version of an existing reviewed module
export const submitCorrections = mutation({
  args: {
    moduleId: v.string(),
    sourceFiles: v.array(v.object({
      filename: v.string(),
      type: v.string(),
      label: v.string(),
      afterSpineSlide: v.optional(v.number()),
      slideCount: v.number(),
      storageId: v.optional(v.id("_storage")),
    })),
    slides: v.array(v.object({
      slideNumber: v.number(),
      sourceFile: v.string(),
      sourceSlideNumber: v.number(),
      textContent: v.optional(v.string()),
      speakerNotes: v.optional(v.string()),
      layoutType: v.optional(v.string()),
      hasAnimation: v.optional(v.boolean()),
      animationSequence: v.optional(v.any()),
      morphPairWith: v.optional(v.number()),
      metadata: v.optional(v.any()),
      thumbnailStorageId: v.optional(v.id("_storage")),
    })),
  },
  handler: async (ctx, args) => {
    const user = await requireAnyRole(ctx, [
      ROLES.CONTENT_CREATOR,
      ROLES.LEAD_REVIEWER,
      ROLES.MANAGER,
      ROLES.ADMIN,
    ]);
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    if (!existing) throw new Error(`Module not found: ${args.moduleId}`);
    if (existing.deleted) throw new Error("Module has been deleted");
    if (!["vinay_reviewed", "creator_fixing"].includes(existing.status)) {
      throw new Error(`Module must be in vinay_reviewed or creator_fixing status, got: ${existing.status}`);
    }

    if (user.role === ROLES.CONTENT_CREATOR && existing.submittedByUserId !== user._id) {
      throw new Error("Forbidden: you can only submit corrections for your own modules");
    }

    const newVersion = existing.version + 1;
    const totalApplets = args.sourceFiles.filter((f) => f.type === "applet").length;
    const totalSlides = args.slides.length;

    const moduleDocId = await ctx.db.insert("modules", {
      moduleId: args.moduleId,
      title: existing.title,
      learningObjective: existing.learningObjective,
      grade: existing.grade,
      chapterNumber: existing.chapterNumber,
      chapterName: existing.chapterName,
      moduleNumber: existing.moduleNumber,
      cp: existing.cp,
      tp: existing.tp,
      phase: existing.phase,
      topic: existing.topic,
      slideCount: totalSlides,
      sourceFiles: args.sourceFiles,
      status: "corrections_intake_complete",
      version: newVersion,
      totalApplets,
      completedAppletReviews: 0,
      spineComplete: false,
      submittedBy: existing.submittedBy,
      submittedByUserId: existing.submittedByUserId,
      submittedAt: now,
      updatedAt: now,
    });

    // Batch-insert parsed slides
    for (const slide of args.slides) {
      await ctx.db.insert("parsedSlides", {
        moduleId: args.moduleId,
        version: newVersion,
        slideNumber: slide.slideNumber,
        sourceFile: slide.sourceFile,
        sourceSlideNumber: slide.sourceSlideNumber,
        textContent: slide.textContent,
        speakerNotes: slide.speakerNotes,
        layoutType: slide.layoutType,
        hasAnimation: slide.hasAnimation,
        animationSequence: slide.animationSequence,
        morphPairWith: slide.morphPairWith,
        metadata: slide.metadata,
        thumbnailStorageId: slide.thumbnailStorageId,
        agentName: "upload-ui",
        createdAt: now,
      });
    }

    // Create intake results record
    await ctx.db.insert("intakeResults", {
      moduleId: args.moduleId,
      version: newVersion,
      slideCount: totalSlides,
      slideTypes: {},
      flags: [],
      agentName: "upload-ui",
      completedAt: now,
      dedupKey: `intake-${args.moduleId}-v${newVersion}`,
    });

    await logActivityIfNew(ctx, {
      agentName: "system",
      action: "module_corrections_submitted",
      message: `Corrections submitted for "${existing.title}" — v${existing.version} → v${newVersion}`,
      dedupKey: `module-corrections-${args.moduleId}-v${newVersion}`,
      metadata: { moduleId: args.moduleId, previousVersion: existing.version, version: newVersion },
    });

    return { id: moduleDocId, moduleId: args.moduleId, version: newVersion, slideCount: totalSlides };
  },
});

// Pipeline summary — count modules per status
export const pipelineSummary = query({
  args: {},
  handler: async (ctx) => {
    const { modules } = await getModulesForUser(ctx);
    const counts: Record<string, number> = {};
    for (const m of modules) {
      counts[m.status] = (counts[m.status] || 0) + 1;
    }
    return { total: modules.length, byStatus: counts };
  },
});

// --- Internal variants for HTTP agent routes (API-key gated, no user session) ---

export const internalList = internalQuery({
  args: {
    status: v.optional(v.string()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, limit }) => {
    const pageLimit = normalizePageLimit(limit);
    if (status) {
      return await ctx.db
        .query("modules")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(pageLimit);
    }
    return await ctx.db.query("modules").order("desc").take(pageLimit);
  },
});

// Internal paginated list for agent routes processing larger queues.
export const internalListPaginated = internalQuery({
  args: {
    status: v.optional(v.string()),
    cursor: v.optional(v.number()),
    limit: v.optional(v.number()),
  },
  handler: async (ctx, { status, cursor, limit }) => {
    const pageLimit = normalizePageLimit(limit);
    const start = cursor ?? 0;
    const source = status
      ? await ctx.db
          .query("modules")
          .withIndex("by_status", (q) => q.eq("status", status))
          .order("desc")
          .collect()
      : await ctx.db.query("modules").order("desc").collect();
    const page = source.slice(start, start + pageLimit);
    const continueCursor = start + page.length;
    const isDone = continueCursor >= source.length;
    return {
      page,
      isDone,
      continueCursor: isDone ? null : continueCursor,
    };
  },
});

export const internalDetail = internalQuery({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    if (version !== undefined) {
      const all = await ctx.db
        .query("modules")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
        .collect();
      const match = all.find((m) => m.version === version && !m.deleted);
      return match ?? null;
    }
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .order("desc")
      .first();
    if (module?.deleted) return null;
    return module;
  },
});

export const internalPipelineSummary = internalQuery({
  args: {},
  handler: async (ctx) => {
    const all = await ctx.db.query("modules").collect();
    const counts: Record<string, number> = {};
    for (const m of all) {
      counts[m.status] = (counts[m.status] || 0) + 1;
    }
    return { total: all.length, byStatus: counts };
  },
});
