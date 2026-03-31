import { internalMutation, internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { ROLES, requireAnyRole } from "./lib/authz";

const DEFAULT_DAILY_AGGREGATE_LIMIT = 250;
const MAX_DAILY_AGGREGATE_LIMIT = 500;

function normalizeLimit(limit?: number) {
  const safe = limit ?? DEFAULT_DAILY_AGGREGATE_LIMIT;
  return Math.max(1, Math.min(MAX_DAILY_AGGREGATE_LIMIT, Math.floor(safe)));
}

// Push a single token usage record (called by Orchestrator via HTTP)
export const push = internalMutation({
  args: {
    agentName: v.string(),
    moduleId: v.string(),
    version: v.optional(v.number()),
    totalTokens: v.number(),
    contextTokens: v.optional(v.number()),
    model: v.optional(v.string()),
    durationMs: v.optional(v.number()),
    sessionKey: v.optional(v.string()),
    dedupKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Dedup
    if (args.dedupKey) {
      const existing = await ctx.db
        .query("tokenUsage")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", args.dedupKey))
        .first();
      if (existing) return { action: "duplicate", id: existing._id };
    }

    const id = await ctx.db.insert("tokenUsage", {
      ...args,
      timestamp: new Date().toISOString(),
    });
    return { action: "created", id };
  },
});

// Push a batch of token usage records (one per agent in a pipeline run)
export const pushBatch = internalMutation({
  args: {
    records: v.array(
      v.object({
        agentName: v.string(),
        moduleId: v.string(),
        version: v.optional(v.number()),
        totalTokens: v.number(),
        contextTokens: v.optional(v.number()),
        model: v.optional(v.string()),
        durationMs: v.optional(v.number()),
        sessionKey: v.optional(v.string()),
        dedupKey: v.string(),
      })
    ),
  },
  handler: async (ctx, { records }) => {
    const results = [];
    const now = new Date().toISOString();

    for (const record of records) {
      // Dedup
      const existing = await ctx.db
        .query("tokenUsage")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", record.dedupKey))
        .first();
      if (existing) {
        results.push({ agentName: record.agentName, action: "duplicate" });
        continue;
      }

      const id = await ctx.db.insert("tokenUsage", {
        ...record,
        timestamp: now,
      });
      results.push({ agentName: record.agentName, action: "created", id });
    }
    return { results };
  },
});

export const byModule = query({
  args: { moduleId: v.string() },
  handler: async (ctx, { moduleId }) => {
    await requireAnyRole(ctx, [ROLES.MANAGER, ROLES.ADMIN], { allowFirstLogin: true });
    return await ctx.db
      .query("tokenUsage")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .collect();
  },
});

export const dailyAggregate = query({
  args: { limit: v.optional(v.number()) },
  handler: async (ctx, { limit }) => {
    await requireAnyRole(ctx, [ROLES.MANAGER, ROLES.ADMIN], { allowFirstLogin: true });
    const pageLimit = normalizeLimit(limit);
    const all = await ctx.db
      .query("tokenUsage")
      .withIndex("by_timestamp")
      .order("desc")
      .take(pageLimit);

    // Group by date + agent
    const groups = new Map<string, {
      date: string;
      agentName: string;
      totalTokens: number;
      modules: Set<string>;
      count: number;
    }>();

    for (const row of all) {
      const date = row.timestamp.slice(0, 10); // YYYY-MM-DD
      const key = `${date}|${row.agentName}`;
      const existing = groups.get(key);
      if (existing) {
        existing.totalTokens += row.totalTokens;
        existing.modules.add(row.moduleId);
        existing.count++;
      } else {
        groups.set(key, {
          date,
          agentName: row.agentName,
          totalTokens: row.totalTokens,
          modules: new Set([row.moduleId]),
          count: 1,
        });
      }
    }

    // Convert to array, replace Set with count
    return Array.from(groups.values())
      .map((g) => ({
        date: g.date,
        agentName: g.agentName,
        totalTokens: g.totalTokens,
        modulesCount: g.modules.size,
        runs: g.count,
      }))
      .sort((a, b) => b.date.localeCompare(a.date) || b.totalTokens - a.totalTokens);
  },
});
