import { query } from "./_generated/server";
import { v } from "convex/values";
import { canAccessModule } from "./lib/authz";

// Get all gate results for a module (module-level + per-applet)
export const allByModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const q = ctx.db
      .query("gatekeeperResults")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      );
    return await q.collect();
  },
});

// Backward compat — returns module-level gate result only
export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const results = await ctx.db
      .query("gatekeeperResults")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      )
      .collect();
    return results.find((r) => r.component === "module") ?? results[0] ?? null;
  },
});
