import { MutationCtx } from "../_generated/server";

/**
 * Log an activity entry if no entry with the same dedupKey exists.
 * Wrapped in try/catch so activity logging never blocks data ingestion.
 */
export async function logActivityIfNew(
  ctx: MutationCtx,
  entry: {
    agentName: string;
    action: string;
    message: string;
    dedupKey: string;
    metadata?: Record<string, unknown>;
  }
): Promise<boolean> {
  try {
    const existing = await ctx.db
      .query("agentActivity")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", entry.dedupKey))
      .first();

    if (existing) return false;

    await ctx.db.insert("agentActivity", {
      agentName: entry.agentName,
      action: entry.action,
      status: "completed",
      message: entry.message,
      timestamp: new Date().toISOString(),
      dedupKey: entry.dedupKey,
      metadata: entry.metadata,
    });
    return true;
  } catch {
    return false;
  }
}
