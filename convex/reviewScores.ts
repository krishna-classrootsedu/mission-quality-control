import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew } from "./lib/activityHelper";

export const push = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    reviewPass: v.string(), // "spine" | "applet_1" | "applet_2" etc.
    quadrantScores: v.array(
      v.object({
        quadrantId: v.string(),
        quadrantName: v.string(),
        maxPoints: v.number(),
        score: v.number(),
        criteriaScores: v.array(
          v.object({
            criterionId: v.string(),
            criterionName: v.string(),
            maxPoints: v.number(),
            score: v.number(),
            type: v.optional(v.string()),
            evidence: v.optional(v.string()),
            slideNumbers: v.optional(v.array(v.number())),
          })
        ),
      })
    ),
    totalPoints: v.number(),
    maxPoints: v.number(),
    observations: v.optional(v.string()),
    agentName: v.string(),
    dedupKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Dedup
    const existing = await ctx.db
      .query("reviewScores")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", args.dedupKey))
      .first();
    if (existing) return { action: "duplicate", id: existing._id };

    // Validate reviewPass
    if (args.reviewPass !== "spine" && !args.reviewPass.startsWith("applet_")) {
      throw new Error(`Invalid reviewPass: ${args.reviewPass}. Must be "spine" or "applet_N".`);
    }

    const now = new Date().toISOString();

    const id = await ctx.db.insert("reviewScores", {
      moduleId: args.moduleId,
      version: args.version,
      reviewPass: args.reviewPass,
      quadrantScores: args.quadrantScores,
      totalPoints: args.totalPoints,
      maxPoints: args.maxPoints,
      observations: args.observations,
      agentName: args.agentName,
      completedAt: now,
      dedupKey: args.dedupKey,
    });

    // Update completion tracking on module
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    if (module && module.version === args.version) {
      const patch: Record<string, unknown> = { updatedAt: now };

      if (args.reviewPass === "spine") {
        patch.spineComplete = true;
      } else if (args.reviewPass.startsWith("applet_")) {
        patch.completedAppletReviews = (module.completedAppletReviews ?? 0) + 1;
      }

      // Check if all reviews complete
      const newSpineComplete = args.reviewPass === "spine" ? true : (module.spineComplete ?? false);
      const newAppletReviews = args.reviewPass.startsWith("applet_")
        ? (module.completedAppletReviews ?? 0) + 1
        : (module.completedAppletReviews ?? 0);
      const totalApplets = module.totalApplets ?? 0;

      if (newSpineComplete && newAppletReviews >= totalApplets) {
        patch.status = "all_reviews_complete";
      }

      await ctx.db.patch(module._id, patch);
    }

    const pct = Math.round((args.totalPoints / args.maxPoints) * 100);
    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: "review_scores_pushed",
      message: `${args.reviewPass} review: ${args.totalPoints}/${args.maxPoints} (${pct}%) for "${args.moduleId}" v${args.version}`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, pass: args.reviewPass, score: args.totalPoints, max: args.maxPoints },
    });

    return { action: "created", id };
  },
});

// Query scores for a module+version
export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const q = ctx.db
      .query("reviewScores")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      );
    return await q.collect();
  },
});
