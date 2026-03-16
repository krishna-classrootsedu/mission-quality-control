import { internalMutation } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew } from "./lib/activityHelper";

export const push = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    slideCount: v.number(),
    slideTypes: v.any(),
    detectedLO: v.optional(v.string()),
    flags: v.array(
      v.object({
        type: v.string(),
        description: v.string(),
        slideNumbers: v.optional(v.array(v.number())),
      })
    ),
    agentName: v.string(),
    dedupKey: v.string(),
    // Parsed slides to batch-insert
    slides: v.array(
      v.object({
        slideNumber: v.number(),
        slideType: v.optional(v.string()),
        textContent: v.optional(v.string()),
        speakerNotes: v.optional(v.string()),
        layoutType: v.optional(v.string()),
        hasAnimation: v.optional(v.boolean()),
        animationSequence: v.optional(v.any()),
        metadata: v.optional(v.any()),
      })
    ),
  },
  handler: async (ctx, args) => {
    // Dedup check
    const existing = await ctx.db
      .query("intakeResults")
      .withIndex("by_dedupKey", (q) => q.eq("dedupKey", args.dedupKey))
      .first();
    if (existing) return { action: "duplicate", id: existing._id };

    const now = new Date().toISOString();

    // Insert intake result
    const id = await ctx.db.insert("intakeResults", {
      moduleId: args.moduleId,
      version: args.version,
      slideCount: args.slideCount,
      slideTypes: args.slideTypes,
      detectedLO: args.detectedLO,
      flags: args.flags,
      agentName: args.agentName,
      completedAt: now,
      dedupKey: args.dedupKey,
    });

    // Batch-insert parsed slides
    for (const slide of args.slides) {
      await ctx.db.insert("parsedSlides", {
        moduleId: args.moduleId,
        version: args.version,
        slideNumber: slide.slideNumber,
        slideType: slide.slideType,
        textContent: slide.textContent,
        speakerNotes: slide.speakerNotes,
        layoutType: slide.layoutType,
        hasAnimation: slide.hasAnimation,
        animationSequence: slide.animationSequence,
        metadata: slide.metadata,
        agentName: args.agentName,
        createdAt: now,
      });
    }

    // Update module status
    const newStatus = args.flags.length > 0 ? "intake_flagged" : "intake_complete";
    const module = await ctx.db
      .query("modules")
      .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
      .order("desc")
      .first();

    if (module && module.version === args.version) {
      await ctx.db.patch(module._id, {
        status: newStatus,
        slideCount: args.slideCount,
        updatedAt: now,
      });
    }

    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: "intake_complete",
      message: `Parsed ${args.slideCount} slides for "${args.moduleId}" v${args.version}. ${args.flags.length} flags.`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, slideCount: args.slideCount, flagCount: args.flags.length },
    });

    return { action: "created", id, slidesParsed: args.slides.length };
  },
});
