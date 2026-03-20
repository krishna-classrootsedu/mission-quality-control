import { mutation } from "./_generated/server";
import { v } from "convex/values";

// Soft-delete a module + hard-delete all child rows
export const deleteModule = mutation({
  args: { moduleId: v.string(), version: v.number() },
  handler: async (ctx, { moduleId, version }) => {
    // Find the module
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
      .order("desc")
      .first();

    if (!module || module.version !== version) {
      throw new Error(`Module ${moduleId} v${version} not found`);
    }

    // Soft-delete: mark module as deleted (agents will check this)
    await ctx.db.patch(module._id, {
      deleted: true,
      status: "deleted" as string,
      updatedAt: new Date().toISOString(),
    });

    // Hard-delete all child rows across all tables
    let deleted = 0;

    // parsedSlides
    const slides = await ctx.db
      .query("parsedSlides")
      .withIndex("by_moduleId_version", (q) => q.eq("moduleId", moduleId).eq("version", version))
      .collect();
    for (const row of slides) {
      // Delete thumbnail from storage if exists
      if (row.thumbnailStorageId) {
        await ctx.storage.delete(row.thumbnailStorageId);
      }
      await ctx.db.delete(row._id);
      deleted++;
    }

    // intakeResults
    const intakes = await ctx.db
      .query("intakeResults")
      .withIndex("by_moduleId_version", (q) => q.eq("moduleId", moduleId).eq("version", version))
      .collect();
    for (const row of intakes) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    // gatekeeperResults
    const gates = await ctx.db
      .query("gatekeeperResults")
      .withIndex("by_moduleId_version", (q) => q.eq("moduleId", moduleId).eq("version", version))
      .collect();
    for (const row of gates) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    // reviewScores
    const scores = await ctx.db
      .query("reviewScores")
      .withIndex("by_moduleId_version", (q) => q.eq("moduleId", moduleId).eq("version", version))
      .collect();
    for (const row of scores) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    // recommendations
    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) => q.eq("moduleId", moduleId).eq("version", version))
      .collect();
    for (const row of recs) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    // flowMap
    const flows = await ctx.db
      .query("flowMap")
      .withIndex("by_moduleId_version", (q) => q.eq("moduleId", moduleId).eq("version", version))
      .collect();
    for (const row of flows) {
      await ctx.db.delete(row._id);
      deleted++;
    }

    return { deleted, moduleId, version };
  },
});
