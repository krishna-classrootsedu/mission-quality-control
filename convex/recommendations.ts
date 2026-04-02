import { internalMutation, internalQuery, mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew, isModuleDeleted } from "./lib/activityHelper";
import { ROLES, canAccessModule, canReviewModule, requireAnyRole, requireCurrentUser } from "./lib/authz";

async function completeVinayReviewImpl(ctx: Pick<MutationCtx, "db">, moduleId: string, version: number) {
  const recs = await ctx.db
    .query("recommendations")
    .withIndex("by_moduleId_version", (q) =>
      q.eq("moduleId", moduleId).eq("version", version)
    )
    .collect();
  const pending = recs.filter((r) => r.reviewStatus === "pending");
  if (pending.length > 0) {
    throw new Error(`${pending.length} recommendations still pending. Review all before completing.`);
  }
  const module = await ctx.db
    .query("modules")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .order("desc")
    .first();

  // Add back pointsRecoverable from rejected initial-review recs
  const rejectedInitialRecs = recs.filter(
    (r) =>
      r.reviewStatus === "rejected" &&
      r.sourcePass !== "corrections_check" &&
      r.sourcePass !== "custom_review"
  );
  const addBackPoints = rejectedInitialRecs.reduce(
    (sum, r) => sum + (r.pointsRecoverable ?? 0),
    0
  );

  let adjustedScore: number | undefined;
  let scoreBand: string | undefined;
  if (module && module.version === version) {
    const currentScore = module.overallScore ?? 0;
    adjustedScore = Math.min(Math.round(currentScore + addBackPoints), 100);

    if (adjustedScore >= 90) scoreBand = "Ship-ready";
    else if (adjustedScore >= 75) scoreBand = "Upgradeable";
    else if (adjustedScore >= 50) scoreBand = "Rework";
    else scoreBand = "Redesign";

    await ctx.db.patch(module._id, {
      status: "vinay_reviewed",
      overallScore: adjustedScore,
      overallPercentage: adjustedScore,
      scoreBand,
      updatedAt: new Date().toISOString(),
    });
  }
  const accepted = recs.filter((r) => r.reviewStatus === "accepted").length;
  const rejected = recs.filter((r) => r.reviewStatus === "rejected").length;
  return { accepted, rejected, total: recs.length, addBackPoints, adjustedScore, scoreBand };
}

// Batch-insert recommendations (called by Integrator or Reviewers)
// When called WITH score fields: updates module score + transitions to review_complete (Integrator path)
// When called WITHOUT score fields: inserts recommendations only, no status change (Reviewer path)
export const pushBatch = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    recommendations: v.array(
      v.object({
        directiveIndex: v.number(),
        slideNumber: v.optional(v.number()),
        issue: v.string(),
        quadrantId: v.string(),
        recommendedFix: v.string(),
        why: v.optional(v.string()),
        operationType: v.string(),
        confidence: v.string(),
        sourceAttribution: v.optional(v.string()),
        component: v.string(),
        pointsRecoverable: v.optional(v.number()),
        sourcePass: v.string(),
        priority: v.optional(v.number()),
        fixStatus: v.optional(v.string()),
      })
    ),
    // Denormalized score data to set on module
    overallScore: v.optional(v.number()),
    overallPercentage: v.optional(v.number()),
    scoreBand: v.optional(v.string()),
    agentName: v.string(),
    dedupKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Bail if module was deleted
    if (await isModuleDeleted(ctx, args.moduleId)) return { action: "module_deleted" };

    // Dedup — check if we already processed this batch
    const existingActivity = await ctx.db
      .query("agentActivity")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", `activity-${args.dedupKey}`))
      .first();
    if (existingActivity) return { action: "duplicate" };

    // Semantic dedup: if corrections_check recs already exist for this
    // component+module+version, upsert — delete stale ones, then insert fresh.
    const isCorrectionsPass = args.recommendations.some(
      (r) => r.sourcePass === "corrections_check"
    );
    let upsertedComponent: string | null = null;
    let deletedCount = 0;

    if (isCorrectionsPass) {
      const component = args.recommendations[0].component;

      const existingRecs = await ctx.db
        .query("recommendations")
        .withIndex("by_moduleId_version_component", (q) =>
          q
            .eq("moduleId", args.moduleId)
            .eq("version", args.version)
            .eq("component", component)
        )
        .collect();

      const existingCorrections = existingRecs.filter(
        (r) => r.sourcePass === "corrections_check"
      );

      if (existingCorrections.length > 0) {
        for (const old of existingCorrections) {
          await ctx.db.delete(old._id);
        }
        upsertedComponent = component;
        deletedCount = existingCorrections.length;
      }
    }

    const now = new Date().toISOString();

    // Insert all recommendations
    for (const r of args.recommendations) {
      await ctx.db.insert("recommendations", {
        moduleId: args.moduleId,
        version: args.version,
        directiveIndex: r.directiveIndex,
        slideNumber: r.slideNumber,
        issue: r.issue,
        quadrantId: r.quadrantId,
        recommendedFix: r.recommendedFix,
        why: r.why,
        operationType: r.operationType,
        confidence: r.confidence,
        sourceAttribution: r.sourceAttribution,
        component: r.component,
        pointsRecoverable: r.pointsRecoverable,
        sourcePass: r.sourcePass,
        priority: r.priority,
        fixStatus: r.fixStatus,
        reviewStatus: "pending",
        agentName: args.agentName,
        createdAt: now,
      });
    }

    // Update module with score data + status (only when score fields provided — Integrator path)
    // Reviewers call without score fields — no status change, just recommendation insertion
    const hasScoreData = args.overallScore !== undefined && args.scoreBand !== undefined;
    if (hasScoreData) {
      const module = await ctx.db
        .query("modules")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
        .order("desc")
        .first();

      if (module && module.version === args.version) {
        await ctx.db.patch(module._id, {
          status: "review_complete",
          overallScore: args.overallScore,
          overallPercentage: args.overallPercentage,
          scoreBand: args.scoreBand,
          updatedAt: now,
        });
      }
    }

    const upsertNote = upsertedComponent
      ? ` (upsert: replaced ${deletedCount} stale corrections for ${upsertedComponent})`
      : "";

    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: upsertedComponent ? "recommendations_upserted" : "recommendations_pushed",
      message: `${args.recommendations.length} recommendations for "${args.moduleId}" v${args.version}. Band: ${args.scoreBand ?? "unknown"}${upsertNote}`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, count: args.recommendations.length, scoreBand: args.scoreBand },
    });

    if (upsertedComponent) {
      return { action: "upserted", count: args.recommendations.length, replacedCount: deletedCount, component: upsertedComponent };
    }
    return { action: "created", count: args.recommendations.length };
  },
});

// Review a single recommendation (Vinay accepts/rejects)
export const review = mutation({
  args: {
    recommendationId: v.id("recommendations"),
    reviewStatus: v.string(),
    vinayComment: v.optional(v.string()),
  },
  handler: async (ctx, { recommendationId, reviewStatus, vinayComment }) => {
    await requireAnyRole(ctx, [ROLES.LEAD_REVIEWER, ROLES.MANAGER, ROLES.ADMIN]);
    if (!["accepted", "rejected"].includes(reviewStatus)) {
      throw new Error(`Invalid reviewStatus: ${reviewStatus}`);
    }
    if (reviewStatus === "rejected" && !vinayComment) {
      throw new Error("Comment is mandatory when rejecting a recommendation.");
    }

    const rec = await ctx.db.get(recommendationId);
    if (!rec) throw new Error("Recommendation not found");
    const allowed = await canReviewModule(ctx, rec.moduleId);
    if (!allowed) throw new Error("Forbidden: no review access for this module");

    await ctx.db.patch(recommendationId, {
      reviewStatus,
      vinayComment: vinayComment ?? undefined,
      reviewedAt: new Date().toISOString(),
    });
  },
});

// Complete Vinay's review — check all recommendations are decided
export const completeVinayReview = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canReviewModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no review access");
    return await completeVinayReviewImpl(ctx, moduleId, version);
  },
});

// Add a custom review (called from frontend by human reviewer)
export const addCustomReview = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    issue: v.string(),
    recommendedFix: v.string(),
    component: v.string(),
    slideNumber: v.optional(v.number()),
    reviewerName: v.string(),
  },
  handler: async (ctx, args) => {
    const allowed = await canReviewModule(ctx, args.moduleId);
    if (!allowed) throw new Error("Forbidden: no review access");
    // Count existing recs to get next directiveIndex
    const existing = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", args.moduleId).eq("version", args.version)
      )
      .collect();

    const now = new Date().toISOString();

    await ctx.db.insert("recommendations", {
      moduleId: args.moduleId,
      version: args.version,
      directiveIndex: existing.length,
      slideNumber: args.slideNumber,
      issue: args.issue,
      quadrantId: "GENERAL",
      recommendedFix: args.recommendedFix || "",
      operationType: "EDIT",
      confidence: "high",
      sourceAttribution: args.reviewerName,
      component: args.component,
      sourcePass: "custom_review",
      reviewStatus: "accepted",
      reviewedAt: now,
      agentName: args.reviewerName,
      source: "reviewer",
      createdAt: now,
    });
  },
});

// Accepted feedback from a specific version — used by Orchestrator for corrections flow
export const acceptedByModuleVersion = internalQuery({
  args: { moduleId: v.string(), version: v.number() },
  handler: async (ctx, { moduleId, version }) => {
    const all = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", moduleId).eq("version", version)
      )
      .collect();
    // Include accepted agent recs + all custom reviews (source === "reviewer")
    return all.filter((r) => r.reviewStatus === "accepted" || r.source === "reviewer");
  },
});

// --- Internal variants for HTTP agent routes (API-key gated, no user session) ---

export const internalReview = internalMutation({
  args: {
    recommendationId: v.id("recommendations"),
    reviewStatus: v.string(),
    vinayComment: v.optional(v.string()),
  },
  handler: async (ctx, { recommendationId, reviewStatus, vinayComment }) => {
    if (!["accepted", "rejected"].includes(reviewStatus)) {
      throw new Error(`Invalid reviewStatus: ${reviewStatus}`);
    }
    if (reviewStatus === "rejected" && !vinayComment) {
      throw new Error("Comment is mandatory when rejecting a recommendation.");
    }
    await ctx.db.patch(recommendationId, {
      reviewStatus,
      vinayComment: vinayComment ?? undefined,
      reviewedAt: new Date().toISOString(),
    });
  },
});

export const internalCompleteVinayReview = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    return await completeVinayReviewImpl(ctx, moduleId, version);
  },
});

export const internalByModule = internalQuery({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const q = ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      );
    return await q.collect();
  },
});

export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const user = await requireCurrentUser(ctx, { allowFirstLogin: true });
    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      )
      .collect();

    if (user.role === ROLES.CONTENT_CREATOR) {
      return recs.filter((r) => r.reviewStatus !== "pending" || r.source === "reviewer");
    }
    return recs;
  },
});
