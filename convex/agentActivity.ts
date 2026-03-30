import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser } from "./lib/authz";

// Ingest a single activity entry (called by agents via HTTP)
export const ingest = internalMutation({
  args: {
    agentName: v.string(),
    action: v.string(),
    status: v.optional(v.string()),
    message: v.string(),
    metadata: v.optional(v.any()),
    dedupKey: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    // Dedup if key provided
    if (args.dedupKey) {
      const existing = await ctx.db
        .query("agentActivity")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", args.dedupKey))
        .first();
      if (existing) return { action: "duplicate", id: existing._id };
    }

    const id = await ctx.db.insert("agentActivity", {
      agentName: args.agentName,
      action: args.action,
      status: args.status ?? "completed",
      message: args.message,
      timestamp: new Date().toISOString(),
      metadata: args.metadata,
      dedupKey: args.dedupKey,
    });
    return { action: "created", id };
  },
});

// Recent activity entries (authenticated)
export const recent = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireCurrentUser(ctx);
    return await ctx.db
      .query("agentActivity")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit ?? 50);
  },
});

// Agent-only variant (no user session, API-key gated at HTTP layer)
export const internalRecent = internalQuery({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    return await ctx.db
      .query("agentActivity")
      .withIndex("by_timestamp")
      .order("desc")
      .take(limit ?? 50);
  },
});
