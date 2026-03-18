import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew } from "./lib/activityHelper";

// Batch-insert fix directives (called by Integrator)
export const pushBatch = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    directives: v.array(
      v.object({
        directiveIndex: v.number(),
        slideNumber: v.optional(v.number()),
        issue: v.string(),
        categoryId: v.string(),
        recommendedFix: v.string(),
        why: v.optional(v.string()),
        severity: v.string(),
        scoreImpact: v.optional(v.number()),
        sourcePass: v.string(),
        directiveType: v.optional(v.string()),
        priority: v.optional(v.number()),
      })
    ),
    // Denormalized score data to set on module
    overallScore: v.optional(v.number()),
    overallPercentage: v.optional(v.number()),
    scoreBand: v.optional(v.string()),
    tier1AllPassed: v.optional(v.boolean()),
    agentName: v.string(),
    dedupKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Dedup — check if we already processed this batch
    const existingActivity = await ctx.db
      .query("agentActivity")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", `activity-${args.dedupKey}`))
      .first();
    if (existingActivity) return { action: "duplicate" };

    const now = new Date().toISOString();

    // Insert all directives
    for (const d of args.directives) {
      await ctx.db.insert("fixDirectives", {
        moduleId: args.moduleId,
        version: args.version,
        directiveIndex: d.directiveIndex,
        slideNumber: d.slideNumber,
        issue: d.issue,
        categoryId: d.categoryId,
        recommendedFix: d.recommendedFix,
        why: d.why,
        severity: d.severity,
        scoreImpact: d.scoreImpact,
        sourcePass: d.sourcePass,
        directiveType: d.directiveType,
        priority: d.priority,
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
      if (args.tier1AllPassed !== undefined) patch.tier1AllPassed = args.tier1AllPassed;
      await ctx.db.patch(module._id, patch);
    }

    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: "fix_directives_pushed",
      message: `${args.directives.length} fix directives for "${args.moduleId}" v${args.version}. Band: ${args.scoreBand ?? "unknown"}`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, count: args.directives.length, scoreBand: args.scoreBand },
    });

    return { action: "created", count: args.directives.length };
  },
});

// Review a single directive (Vinay accepts/rejects)
export const review = mutation({
  args: {
    directiveId: v.id("fixDirectives"),
    reviewStatus: v.string(),
    vinayComment: v.optional(v.string()),
  },
  handler: async (ctx, { directiveId, reviewStatus, vinayComment }) => {
    if (!["accepted", "rejected"].includes(reviewStatus)) {
      throw new Error(`Invalid reviewStatus: ${reviewStatus}`);
    }
    if (reviewStatus === "rejected" && !vinayComment) {
      throw new Error("Comment is mandatory when rejecting a directive.");
    }

    await ctx.db.patch(directiveId, {
      reviewStatus,
      vinayComment: vinayComment ?? undefined,
      reviewedAt: new Date().toISOString(),
    });
  },
});

// Complete Vinay's review — check all directives are decided
export const completeVinayReview = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    const directives = await ctx.db
      .query("fixDirectives")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", moduleId).eq("version", version)
      )
      .collect();

    const pending = directives.filter((d) => d.reviewStatus === "pending");
    if (pending.length > 0) {
      throw new Error(`${pending.length} directives still pending. Review all before completing.`);
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

    const accepted = directives.filter((d) => d.reviewStatus === "accepted").length;
    const rejected = directives.filter((d) => d.reviewStatus === "rejected").length;
    return { accepted, rejected, total: directives.length };
  },
});

// Query directives for a module+version
export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const q = ctx.db
      .query("fixDirectives")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      );
    return await q.collect();
  },
});
