import { query, mutation, internalQuery, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { Id } from "./_generated/dataModel";
import { requireCurrentUser, requireAnyRole } from "./lib/authz";

// ---------------------------------------------------------------------------
// HELPERS
// ---------------------------------------------------------------------------

// Canonical module code format: G{grade}C{chapter}M{module} (e.g. "G6C3M5")
// Parses into numeric grade/chapter/module for indexing and sorting.
export function parseModuleCode(moduleCode: string): {
  grade: number;
  chapterNumber: number;
  moduleNumber: number;
} {
  const match = moduleCode.trim().match(/^G(\d+)C(\d+)M(\d+)$/i);
  if (!match) {
    throw new Error(
      `Invalid moduleCode "${moduleCode}". Expected format G{grade}C{chapter}M{module} — e.g. G6C3M5.`
    );
  }
  return {
    grade: parseInt(match[1], 10),
    chapterNumber: parseInt(match[2], 10),
    moduleNumber: parseInt(match[3], 10),
  };
}

function normalizeModuleCode(moduleCode: string): string {
  return moduleCode.trim().toUpperCase();
}

// Look up a user's display name (name → email → id string) for denormalized blame storage.
async function getUserDisplayName(ctx: MutationCtx, userId: Id<"users">): Promise<string> {
  const u = await ctx.db.get(userId);
  if (!u) return "unknown";
  return (u.name && u.name.trim().length > 0 ? u.name : u.email) ?? "unknown";
}

// ---------------------------------------------------------------------------
// QUERIES (UI + cascading dropdowns)
// ---------------------------------------------------------------------------

// All entries — for the curriculum browse page, sorted by grade/chapter/module
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

// Distinct chapters for a grade — used by upload page cascading dropdown
export const listByGrade = query({
  args: { grade: v.number() },
  handler: async (ctx, { grade }) => {
    await requireCurrentUser(ctx);
    const rows = await ctx.db
      .query("curriculumMap")
      .withIndex("by_grade", (q) => q.eq("grade", grade))
      .collect();
    const seen = new Map<number, string>();
    for (const r of rows) {
      if (!seen.has(r.chapterNumber)) {
        seen.set(r.chapterNumber, r.chapterName ?? "");
      }
    }
    return Array.from(seen.entries())
      .sort((a, b) => a[0] - b[0])
      .map(([chapterNumber, chapterName]) => ({ chapterNumber, chapterName }));
  },
});

// All modules in a chapter — used by upload page cascading dropdown
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

// Single entry lookup by moduleCode
export const getByModuleCode = query({
  args: { moduleCode: v.string() },
  handler: async (ctx, { moduleCode }) => {
    await requireCurrentUser(ctx);
    const normalized = normalizeModuleCode(moduleCode);
    return await ctx.db
      .query("curriculumMap")
      .withIndex("by_moduleCode", (q) => q.eq("moduleCode", normalized))
      .first();
  },
});

// ---------------------------------------------------------------------------
// INTERNAL QUERY (for HTTP endpoint — agent access)
// ---------------------------------------------------------------------------

// Chapter context for agents — all input rows in a chapter, ordered by moduleNumber
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
    const chapterName =
      sorted.find((r) => r.chapterName && r.chapterName.trim().length > 0)
        ?.chapterName ?? null;
    return {
      grade,
      chapterNumber,
      chapterName,
      modules: sorted.map((m) => ({
        moduleCode: m.moduleCode,
        moduleNumber: m.moduleNumber,
        thread: m.thread ?? null,
        strand: m.strand ?? null,
        tpCode: m.tpCode ?? null,
        tpDescription: m.tpDescription ?? null,
        conceptName: m.conceptName ?? null,
        conceptType: m.conceptType ?? null,
        conceptDescription: m.conceptDescription ?? null,
        proposedLOs: m.proposedLOs ?? null,
      })),
    };
  },
});

// ---------------------------------------------------------------------------
// MUTATIONS
// ---------------------------------------------------------------------------

// Upsert a single row by moduleCode — used by CSV import and the upsert-by-code path.
// Only moduleCode is required; every other field is optional and may be blank.
// Derives grade/chapterNumber/moduleNumber from moduleCode and stores them
// redundantly so queries can use fast indexes.
export const upsertByModuleCode = mutation({
  args: {
    moduleCode: v.string(),
    thread: v.optional(v.string()),
    strand: v.optional(v.string()),
    tpCode: v.optional(v.string()),
    tpDescription: v.optional(v.string()),
    chapterName: v.optional(v.string()),
    conceptName: v.optional(v.string()),
    conceptType: v.optional(v.string()),
    conceptDescription: v.optional(v.string()),
    proposedLOs: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const user = await requireAnyRole(ctx, ["manager", "admin"]);
    const displayName = await getUserDisplayName(ctx, user._id);
    const normalized = normalizeModuleCode(args.moduleCode);
    const parsed = parseModuleCode(normalized);
    const now = new Date().toISOString();

    const existing = await ctx.db
      .query("curriculumMap")
      .withIndex("by_moduleCode", (q) => q.eq("moduleCode", normalized))
      .first();

    const payload = {
      moduleCode: normalized,
      thread: args.thread,
      strand: args.strand,
      tpCode: args.tpCode,
      tpDescription: args.tpDescription,
      grade: parsed.grade,
      chapterNumber: parsed.chapterNumber,
      moduleNumber: parsed.moduleNumber,
      chapterName: args.chapterName,
      conceptName: args.conceptName,
      conceptType: args.conceptType,
      conceptDescription: args.conceptDescription,
      proposedLOs: args.proposedLOs,
      lastEditedAt: now,
      lastEditedBy: user._id,
      lastEditedByName: displayName,
    };

    if (existing) {
      await ctx.db.patch(existing._id, payload);
      return { action: "updated" as const, id: existing._id };
    }

    const id = await ctx.db.insert("curriculumMap", {
      ...payload,
      createdAt: now,
      createdBy: user._id,
      createdByName: displayName,
    });
    return { action: "inserted" as const, id };
  },
});

// Inline edit from the curriculum browse page — patches fields on an existing row
// and stamps the blame trail. moduleCode itself cannot be edited (identity).
export const updateRow = mutation({
  args: {
    id: v.id("curriculumMap"),
    thread: v.optional(v.string()),
    strand: v.optional(v.string()),
    tpCode: v.optional(v.string()),
    tpDescription: v.optional(v.string()),
    chapterName: v.optional(v.string()),
    conceptName: v.optional(v.string()),
    conceptType: v.optional(v.string()),
    conceptDescription: v.optional(v.string()),
    proposedLOs: v.optional(v.string()),
  },
  handler: async (ctx, { id, ...patch }) => {
    const user = await requireAnyRole(ctx, ["manager", "admin"]);
    const displayName = await getUserDisplayName(ctx, user._id);
    const existing = await ctx.db.get(id);
    if (!existing) throw new Error("Curriculum entry not found");
    const now = new Date().toISOString();
    await ctx.db.patch(id, {
      ...patch,
      lastEditedAt: now,
      lastEditedBy: user._id,
      lastEditedByName: displayName,
    });
    return { updated: true };
  },
});

// Bulk CSV import — per-row upsert by moduleCode. Empty fields are allowed.
// Errors on individual rows don't abort the batch; they're collected and returned.
export const bulkImportCSV = mutation({
  args: {
    rows: v.array(
      v.object({
        moduleCode: v.string(),
        thread: v.optional(v.string()),
        strand: v.optional(v.string()),
        tpCode: v.optional(v.string()),
        tpDescription: v.optional(v.string()),
        chapterName: v.optional(v.string()),
        conceptName: v.optional(v.string()),
        conceptType: v.optional(v.string()),
        conceptDescription: v.optional(v.string()),
        proposedLOs: v.optional(v.string()),
      })
    ),
  },
  handler: async (ctx, { rows }) => {
    const user = await requireAnyRole(ctx, ["manager", "admin"]);
    const displayName = await getUserDisplayName(ctx, user._id);
    const now = new Date().toISOString();
    let inserted = 0;
    let updated = 0;
    const errors: string[] = [];

    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      try {
        if (!row.moduleCode || !row.moduleCode.trim()) {
          errors.push(`Row ${i + 1}: moduleCode is required`);
          continue;
        }
        const normalized = normalizeModuleCode(row.moduleCode);
        const parsed = parseModuleCode(normalized);

        const existing = await ctx.db
          .query("curriculumMap")
          .withIndex("by_moduleCode", (q) => q.eq("moduleCode", normalized))
          .first();

        const payload = {
          moduleCode: normalized,
          thread: row.thread,
          strand: row.strand,
          tpCode: row.tpCode,
          tpDescription: row.tpDescription,
          grade: parsed.grade,
          chapterNumber: parsed.chapterNumber,
          moduleNumber: parsed.moduleNumber,
          chapterName: row.chapterName,
          conceptName: row.conceptName,
          conceptType: row.conceptType,
          conceptDescription: row.conceptDescription,
          proposedLOs: row.proposedLOs,
          lastEditedAt: now,
          lastEditedBy: user._id,
          lastEditedByName: displayName,
        };

        if (existing) {
          await ctx.db.patch(existing._id, payload);
          updated++;
        } else {
          await ctx.db.insert("curriculumMap", {
            ...payload,
            createdAt: now,
            createdBy: user._id,
            createdByName: displayName,
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
