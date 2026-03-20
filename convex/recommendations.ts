import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew, isModuleDeleted } from "./lib/activityHelper";

// Batch-insert recommendations (called by Integrator)
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
        reviewStatus: "pending",
        agentName: args.agentName,
        createdAt: now,
      });
    }

    // Update module with score data + status
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    if (module && module.version === args.version) {
      const patch: Record<string, unknown> = {
        status: "review_complete",
        updatedAt: now,
      };
      if (args.overallScore !== undefined) patch.overallScore = args.overallScore;
      if (args.overallPercentage !== undefined) patch.overallPercentage = args.overallPercentage;
      if (args.scoreBand !== undefined) patch.scoreBand = args.scoreBand;
      await ctx.db.patch(module._id, patch);
    }

    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: "recommendations_pushed",
      message: `${args.recommendations.length} recommendations for "${args.moduleId}" v${args.version}. Band: ${args.scoreBand ?? "unknown"}`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, count: args.recommendations.length, scoreBand: args.scoreBand },
    });

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

// Complete Vinay's review — check all recommendations are decided
export const completeVinayReview = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
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

    // Update module status
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .order("desc")
      .first();

    if (module && module.version === version) {
      await ctx.db.patch(module._id, {
        status: "vinay_reviewed",
        updatedAt: new Date().toISOString(),
      });
    }

    const accepted = recs.filter((r) => r.reviewStatus === "accepted").length;
    const rejected = recs.filter((r) => r.reviewStatus === "rejected").length;
    return { accepted, rejected, total: recs.length };
  },
});

// Query recommendations for a module+version
export const byModule = query({
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
