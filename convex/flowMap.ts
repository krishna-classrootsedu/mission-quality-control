import { internalMutation, mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew, isModuleDeleted } from "./lib/activityHelper";
import { ROLES, canAccessModule, canReviewModule, requireAnyRole } from "./lib/authz";

// Batch-insert flow map rows (called by Flow Mapper agent)
export const push = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    steps: v.array(
      v.object({
        stepIndex: v.number(),
        type: v.string(),
        slideRange: v.string(),
        concept: v.string(),
        purpose: v.string(),
        appletRef: v.optional(v.string()),
        dedupKey: v.string(),
      })
    ),
    agentName: v.string(),
  },
  handler: async (ctx, args) => {
    // Bail if module was deleted
    if (await isModuleDeleted(ctx, args.moduleId)) return { action: "module_deleted", count: 0 };

    const now = new Date().toISOString();
    let inserted = 0;

    for (const step of args.steps) {
      // Dedup per step
      const existing = await ctx.db
        .query("flowMap")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", step.dedupKey))
        .first();
      if (existing) continue;

      await ctx.db.insert("flowMap", {
        moduleId: args.moduleId,
        version: args.version,
        stepIndex: step.stepIndex,
        type: step.type,
        slideRange: step.slideRange,
        concept: step.concept,
        purpose: step.purpose,
        appletRef: step.appletRef,
        status: "ok",
        agentName: args.agentName,
        createdAt: now,
        dedupKey: step.dedupKey,
      });
      inserted++;
    }

    // Update module status to flow_mapped
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    if (module && module.version === args.version) {
      await ctx.db.patch(module._id, {
        status: "flow_mapped",
        updatedAt: now,
      });
    }

    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: "flow_map_pushed",
      message: `Flow map: ${inserted} steps for "${args.moduleId}" v${args.version}`,
      dedupKey: `flow-map-${args.moduleId}-v${args.version}`,
      metadata: { moduleId: args.moduleId, version: args.version, stepCount: inserted },
    });

    return { action: "created", count: inserted };
  },
});

// Flag a flow map step (Vinay flags a step with comment)
export const flag = mutation({
  args: {
    stepId: v.id("flowMap"),
    vinayFlag: v.string(),
  },
  handler: async (ctx, { stepId, vinayFlag }) => {
    await requireAnyRole(ctx, [ROLES.LEAD_REVIEWER, ROLES.MANAGER, ROLES.ADMIN]);
    const step = await ctx.db.get(stepId);
    if (!step) throw new Error("Flow step not found");
    const allowed = await canReviewModule(ctx, step.moduleId);
    if (!allowed) throw new Error("Forbidden: no review access");
    await ctx.db.patch(stepId, {
      status: "flagged",
      vinayFlag,
      flaggedAt: new Date().toISOString(),
    });
  },
});

// Query flow map for a module+version, ordered by stepIndex
export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const results = await ctx.db
      .query("flowMap")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      )
      .collect();
    return results.sort((a, b) => a.stepIndex - b.stepIndex);
  },
});
