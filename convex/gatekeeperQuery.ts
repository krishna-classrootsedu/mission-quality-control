import { query } from "./_generated/server";
import { v } from "convex/values";

export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const q = ctx.db
      .query("gatekeeperResults")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      );
    return await q.first();
  },
});
