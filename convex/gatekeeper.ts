import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew } from "./lib/activityHelper";

export const push = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    passed: v.boolean(),
    ruleResults: v.array(
      v.object({
        ruleId: v.string(),
        ruleName: v.string(),
        passed: v.boolean(),
        evidence: v.optional(v.string()),
        slideNumbers: v.optional(v.array(v.number())),
      })
    ),
    agentName: v.string(),
    dedupKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Dedup
    const existing = await ctx.db
      .query("gatekeeperResults")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", args.dedupKey))
      .first();
    if (existing) return { action: "duplicate", id: existing._id };

    const now = new Date().toISOString();

    const id = await ctx.db.insert("gatekeeperResults", {
      moduleId: args.moduleId,
      version: args.version,
      passed: args.passed,
      ruleResults: args.ruleResults,
      agentName: args.agentName,
      completedAt: now,
      dedupKey: args.dedupKey,
    });

    // If gatekeeper fails, auto-generate recommendations from failed rules
    if (!args.passed) {
      const failedRules = args.ruleResults.filter((r) => !r.passed);
      for (let i = 0; i < failedRules.length; i++) {
        const rule = failedRules[i];
        await ctx.db.insert("recommendations", {
          moduleId: args.moduleId,
          version: args.version,
          directiveIndex: i,
          slideNumber: rule.slideNumbers?.[0],
          issue: `Dealbreaker: ${rule.ruleName}`,
          quadrantId: "GATE",
          recommendedFix: `Fix: ${rule.ruleName}. ${rule.evidence ?? ""}`,
          why: "Binary gate rule — must pass before any scoring can proceed.",
          operationType: "EDIT",
          confidence: "high",
          component: "spine",
          sourcePass: "gatekeeper",
          reviewStatus: "pending",
          agentName: args.agentName,
          createdAt: now,
        });
      }
    }

    // Update module status
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    if (module && module.version === args.version) {
      await ctx.db.patch(module._id, {
        status: args.passed ? "gatekeeper_pass" : "gatekeeper_fail",
        updatedAt: now,
      });
    }

    const failCount = args.ruleResults.filter((r) => !r.passed).length;
    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: args.passed ? "gatekeeper_pass" : "gatekeeper_fail",
      message: `Gatekeeper ${args.passed ? "PASSED" : `FAILED (${failCount} rules)`} for "${args.moduleId}" v${args.version}`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, passed: args.passed, failCount },
    });

    return { action: "created", id, passed: args.passed };
  },
});
