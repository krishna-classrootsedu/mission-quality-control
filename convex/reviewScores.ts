import { internalMutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew } from "./lib/activityHelper";

const PASS_TO_FIELD = {
  designer: "designerComplete",
  teacher: "teacherComplete",
  student: "studentComplete",
} as const;

export const push = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    reviewPass: v.string(),
    categoryScores: v.array(
      v.object({
        categoryId: v.string(),
        categoryName: v.string(),
        maxPoints: v.number(),
        score: v.number(),
        tier: v.string(),
        criteriaScores: v.array(
          v.object({
            criterionId: v.string(),
            criterionName: v.string(),
            maxPoints: v.number(),
            score: v.number(),
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

    if (!(args.reviewPass in PASS_TO_FIELD)) {
      throw new Error(`Invalid reviewPass: ${args.reviewPass}. Must be designer, teacher, or student.`);
    }

    const now = new Date().toISOString();

    const id = await ctx.db.insert("reviewScores", {
      moduleId: args.moduleId,
      version: args.version,
      reviewPass: args.reviewPass,
      categoryScores: args.categoryScores,
      totalPoints: args.totalPoints,
      maxPoints: args.maxPoints,
      observations: args.observations,
      agentName: args.agentName,
      completedAt: now,
      dedupKey: args.dedupKey,
    });

    // Update hat-specific boolean on module
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    if (module && module.version === args.version) {
      const field = PASS_TO_FIELD[args.reviewPass as keyof typeof PASS_TO_FIELD];
      const patch: Record<string, unknown> = {
        [field]: true,
        updatedAt: now,
      };

      // Check if all 3 passes complete
      const otherPasses = Object.keys(PASS_TO_FIELD).filter((p) => p !== args.reviewPass);
      const allComplete = otherPasses.every((p) => {
        const f = PASS_TO_FIELD[p as keyof typeof PASS_TO_FIELD];
        return module[f as keyof typeof module] === true;
      });

      if (allComplete) {
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
