import { query, internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { canAccessModule } from "./lib/authz";

// Patch a parsed slide row with its thumbnail storageId
export const updateThumbnail = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    slideNumber: v.number(),
    thumbnailStorageId: v.id("_storage"),
  },
  handler: async (ctx, { moduleId, version, slideNumber, thumbnailStorageId }) => {
    const existing = await ctx.db
      .query("parsedSlides")
      .withIndex("by_moduleId_version_slide", (q) =>
        q.eq("moduleId", moduleId).eq("version", version).eq("slideNumber", slideNumber)
      )
      .unique();
    if (!existing) {
      throw new Error(
        `No parsedSlides row found for moduleId=${moduleId}, version=${version}, slide=${slideNumber}`
      );
    }
    await ctx.db.patch(existing._id, { thumbnailStorageId });
    return { patched: existing._id };
  },
});

// Query parsed slides for a module+version
export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const q = ctx.db
      .query("parsedSlides")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      );
    return await q.collect();
  },
});

// Query parsed slides with resolved thumbnail URLs
export const byModuleWithUrls = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const slides = await ctx.db
      .query("parsedSlides")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      )
      .collect();
    return Promise.all(
      slides.map(async (s) => ({
        ...s,
        thumbnailUrl: s.thumbnailStorageId
          ? await ctx.storage.getUrl(s.thumbnailStorageId)
          : null,
      }))
    );
  },
});
