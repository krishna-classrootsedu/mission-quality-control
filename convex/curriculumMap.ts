import { query, mutation, internalQuery } from "./_generated/server";
import { v } from "convex/values";
import { requireCurrentUser, requireAnyRole } from "./lib/authz";

// ---------------------------------------------------------------------------
// QUERIES (UI + cascading dropdowns)
// ---------------------------------------------------------------------------

// Distinct chapters for a grade (for first-level dropdown)
export const listByGrade = query({
  args: { grade: v.number() },
  handler: async (ctx, { grade }) => {
    await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("curriculumMap")
      .withIndex("by_grade", (q) => q.eq("grade", grade))
      .collect();
    // Deduplicate chapters and return ordered by chapterNumber
    const seen = new Map<number, string>();
    for (const r of rows) {
      if (!seen.has(r.chapterNumber)) {
        seen.set(r.chapterNumber, r.chapterName);
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([chapterNumber, chapterName]) => ({ chapterNumber, chapterName }));
  },
});

// All modules in a chapter (for second-level dropdown + curriculum page)
export const listByGradeChapter = query({
  args: { grade: v.number(), chapterNumber: v.number() },
  handler: async (ctx, { grade, chapterNumber }) => {
    await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("curriculumMap")
      .withIndex("by_grade_chapter", (q) =>
        q.eq("grade", grade).eq("chapterNumber", chapterNumber)
      )
      .collect();
    return rows.sort((a, b) => a.moduleNumber - b.moduleNumber);
  },
});

// Single entry lookup (for auto-fill)
export const getEntry = query({
  args: {
    grade: v.number(),
    chapterNumber: v.number(),
    moduleNumber: v.number(),
  },
  handler: async (ctx, { grade, chapterNumber, moduleNumber }) => {
    await requireCurrentUser(ctx);
    return await ctx.db
      .query("curriculumMap")
      .withIndex("by_grade_chapter_module", (q) =>
        q
          .eq("grade", grade)
          .eq("chapterNumber", chapterNumber)
          .eq("moduleNumber", moduleNumber)
      )
      .first();
  },
});

// All entries for curriculum display page
export const listAll = query({
  args: {},
  handler: async (ctx) => {
    await requireCurrentUser(ctx);
    const rows = await ctx.db.query("curriculumMap").collect();
    return rows.sort(
      (a, b) =>
        a.grade - b.grade ||
        a.chapterNumber - b.chapterNumber ||
        a.moduleNumber - b.moduleNumber
    );
  },
});

// ---------------------------------------------------------------------------
// INTERNAL QUERY (for HTTP endpoint — agent access)
// ---------------------------------------------------------------------------

// Chapter context for agents: all modules in a chapter with LOs
export const internalChapterContext = internalQuery({
  args: { grade: v.number(), chapterNumber: v.number() },
  handler: async (ctx, { grade, chapterNumber }) => {
    const rows = await ctx.db
      .query("curriculumMap")
      .withIndex("by_grade_chapter", (q) =>
        q.eq("grade", grade).eq("chapterNumber", chapterNumber)
      )
      .collect();
    const sorted = rows.sort((a, b) => a.moduleNumber - b.moduleNumber);
    const chapterName = sorted[0]?.chapterName ?? null;
    return {
      grade,
      chapterNumber,
      chapterName,
      modules: sorted.map((m) => ({
        moduleNumber: m.moduleNumber,
        moduleName: m.moduleName,
        learningOutcomes: m.learningOutcomes,
        topic: m.topic ?? null,
        conceptsCovered: m.conceptsCovered ?? null,
        prerequisites: m.prerequisites ?? null,
        keyVocabulary: m.keyVocabulary ?? null,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

const entryFields = {
  grade: v.number(),
  chapterNumber: v.number(),
  chapterName: v.string(),
  moduleNumber: v.number(),
  moduleName: v.string(),
  learningOutcomes: v.string(),
  topic: v.optional(v.string()),
  cp: v.optional(v.string()),
  tp: v.optional(v.string()),
  phase: v.optional(v.string()),
  prerequisites: v.optional(v.string()),
  keyVocabulary: v.optional(v.string()),
  conceptsCovered: v.optional(v.string()),
};

// Create or update a single curriculum entry
export const upsertEntry = mutation({
  args: entryFields,
  handler: async (ctx, args) => {
    const user = await requireAnyRole(ctx, ["manager", "admin"]);
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("curriculumMap")
      .withIndex("by_grade_chapter_module", (q) =>
        q
          .eq("grade", args.grade)
          .eq("chapterNumber", args.chapterNumber)
          .eq("moduleNumber", args.moduleNumber)
      )
      .first();

    if (existing) {
      await ctx.db.patch(existing._id, { ...args, updatedAt: now });
      return { action: "updated" as const, id: existing._id };
    }

    const id = await ctx.db.insert("curriculumMap", {
      ...args,
      createdAt: now,
      updatedAt: now,
      createdBy: user._id,
    });
    return { action: "inserted" as const, id };
  },
});

// Bulk import from CSV (admin only)
export const bulkImportCSV = mutation({
  args: {
    rows: v.array(
      v.object({
        grade: v.number(),
        chapterNumber: v.number(),
        chapterName: v.string(),
        moduleNumber: v.number(),
        moduleName: v.string(),
        learningOutcomes: v.string(),
        topic: v.optional(v.string()),
        cp: v.optional(v.string()),
        tp: v.optional(v.string()),
        phase: v.optional(v.string()),
        prerequisites: v.optional(v.string()),
        keyVocabulary: v.optional(v.string()),
        conceptsCovered: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { rows }) => {
    const user = await requireAnyRole(ctx, ["admin"]);
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (
          !row.chapterName.trim() ||
          !row.moduleName.trim() ||
          !row.learningOutcomes.trim()
        ) {
          errors.push(
            `Row ${i + 1}: chapterName, moduleName, and learningOutcomes are required`
          );
          continue;
        }

        const existing = await ctx.db
          .query("curriculumMap")
          .withIndex("by_grade_chapter_module", (q) =>
            q
              .eq("grade", row.grade)
              .eq("chapterNumber", row.chapterNumber)
              .eq("moduleNumber", row.moduleNumber)
          )
          .first();

        if (existing) {
          await ctx.db.patch(existing._id, { ...row, updatedAt: now });
          updated++;
        } else {
          await ctx.db.insert("curriculumMap", {
            ...row,
            createdAt: now,
            updatedAt: now,
            createdBy: user._id,
          });
          inserted++;
        }
      } catch (e) {
        errors.push(
          `Row ${i + 1}: ${e instanceof Error ? e.message : "Unknown error"}`
        );
      }
    }

    return { inserted, updated, errors };
  },
});

// Delete a single entry (admin only)
export const deleteEntry = mutation({
  args: { id: v.id("curriculumMap") },
  handler: async (ctx, { id }) => {
    await requireAnyRole(ctx, ["admin"]);
    await ctx.db.delete(id);
    return { deleted: true };
  },
});
