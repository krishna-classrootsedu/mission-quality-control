import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew, isModuleDeleted } from "./lib/activityHelper";

export const push = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    component: v.string(), // "module" | "applet_1" | "applet_2" etc.
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
    // Bail if module was deleted
    if (await isModuleDeleted(ctx, args.moduleId)) return { action: "module_deleted" };

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
      component: args.component,
      passed: args.passed,
      ruleResults: args.ruleResults,
      agentName: args.agentName,
      completedAt: now,
      dedupKey: args.dedupKey,
    });

    // Auto-generate recommendations from failed rules
    if (!args.passed) {
      const failedRules = args.ruleResults.filter((r) => !r.passed);
      for (let i = 0; i < failedRules.length; i++) {
        const rule = failedRules[i];
        const isModule = args.component === "module";
        await ctx.db.insert("recommendations", {
          moduleId: args.moduleId,
          version: args.version,
          directiveIndex: i,
          slideNumber: rule.slideNumbers?.[0],
          issue: `${isModule ? "Module" : "Applet"} gate failure: ${rule.ruleName}`,
          quadrantId: "GATE",
          recommendedFix: `Fix: ${rule.ruleName}. ${rule.evidence ?? ""}`,
          why: isModule
            ? "Module gate failure — must pass before scoring can proceed."
            : "Applet gate failure — this applet is blocked from scoring.",
          operationType: "EDIT",
          confidence: "high",
          component: isModule ? "spine" : args.component,
          sourcePass: "gatekeeper",
          reviewStatus: "pending",
          agentName: args.agentName,
          createdAt: now,
        });
      }
    }

    // Only update module status for module-level gates (not per-applet)
    if (args.component === "module") {
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
    }

    const failCount = args.ruleResults.filter((r) => !r.passed).length;
    const componentLabel = args.component === "module" ? "module" : args.component.replace("_", " ");
    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: args.passed ? "gatekeeper_pass" : "gatekeeper_fail",
      message: `Gatekeeper ${args.passed ? "PASSED" : `FAILED (${failCount} rules)`} ${componentLabel} gates for "${args.moduleId}" v${args.version}`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, component: args.component, passed: args.passed, failCount },
    });

    return { action: "created", id, passed: args.passed, component: args.component };
  },
});
