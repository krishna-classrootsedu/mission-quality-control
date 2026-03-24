import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew, isModuleDeleted } from "./lib/activityHelper";

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
] as const;

// Upsert a module — new submission or re-submission
export const upsert = internalMutation({
  args: {
    moduleId: v.string(),
    title: v.string(),
    learningObjective: v.string(),
    grade: v.string(),
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
    if (status) {
      return await ctx.db
        .query("modules")
        .withIndex("by_status", (q) => q.eq("status", status))
        .order("desc")
        .take(200);
    }
    return await ctx.db.query("modules").order("desc").take(200);
  },
});

// Detail for a single module (latest version, excluding deleted)
export const detail = query({
  args: { moduleId: v.string() },
  handler: async (ctx, { moduleId }) => {
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
    return await ctx.storage.generateUploadUrl();
  },
});

// Submit a module with an uploaded PPTX file (public — called by UI)
export const submitModule = mutation({
  args: {
    title: v.string(),
    learningObjective: v.string(),
    grade: v.string(),
    phase: v.optional(v.string()),
    topic: v.optional(v.string()),
    submittedBy: v.string(),
    pptxStorageId: v.id("_storage"),
    fileName: v.string(),
  },
  handler: async (ctx, args) => {
    const now = new Date().toISOString();

    // Generate moduleId from title (slug-style)
    const slug = args.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const moduleId = `MOD-${slug}-${Date.now().toString(36)}`;

    // Get the file URL from storage
    const pptxFileUrl = await ctx.storage.getUrl(args.pptxStorageId);

    // Check for existing module with same title (loose dedup)
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

    return { id, moduleId, version: 1 };
  },
});

// Submit a module with multi-file flow (spine + applets)
export const submitModuleWithFlow = mutation({
  args: {
    title: v.string(),
    learningObjective: v.string(),
    grade: v.string(),
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
    const now = new Date().toISOString();

    // Generate moduleId from title
    const slug = args.title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
      .slice(0, 40);
    const moduleId = `MOD-${slug}-${Date.now().toString(36)}`;

    // Compute totalApplets from sourceFiles
    const totalApplets = args.sourceFiles.filter((f) => f.type === "applet").length;

    // Create module record
    const totalSlides = args.slides.length;
    const moduleDocId = await ctx.db.insert("modules", {
      moduleId,
      title: args.title,
      learningObjective: args.learningObjective,
      grade: args.grade,
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

// Pipeline summary — count modules per status
export const pipelineSummary = query({
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
