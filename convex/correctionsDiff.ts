/**
 * correctionsDiff.ts — Structural diff between two versions of parsed slides.
 * Used by the corrections pipeline to give the corrections-checker agent
 * only the targeted slides it needs, instead of all slides.
 *
 * Pure code comparison — no LLM calls.
 */

import { internalQuery, query } from "./_generated/server";
import { v } from "convex/values";
import { canAccessModule } from "./lib/authz";

// ---------------------------------------------------------------------------
// Text similarity helpers
// ---------------------------------------------------------------------------

function normalize(text: string): string {
  return text.toLowerCase().trim().replace(/\s+/g, " ");
}

function firstLine(text: string): string {
  const line = text.split("\n")[0] ?? "";
  return normalize(line);
}

/** Jaccard similarity on word tokens */
function jaccard(a: string, b: string): number {
  const wordsA = normalize(a).split(" ").filter(Boolean);
  const wordsB = normalize(b).split(" ").filter(Boolean);
  const tokensA = new Set(wordsA);
  const tokensB = new Set(wordsB);
  if (tokensA.size === 0 && tokensB.size === 0) return 1;
  if (tokensA.size === 0 || tokensB.size === 0) return 0;
  let intersection = 0;
  wordsA.forEach((t) => {
    if (tokensB.has(t)) intersection++;
  });
  // Deduplicate intersection count (word might repeat in wordsA)
  intersection = Math.min(intersection, tokensA.size, tokensB.size);
  const union = tokensA.size + tokensB.size - intersection;
  return union === 0 ? 0 : intersection / union;
}

const MATCH_THRESHOLD = 0.5;

// ---------------------------------------------------------------------------
// Slide mapping
// ---------------------------------------------------------------------------

interface SlideRecord {
  slideNumber: number;
  textContent?: string;
  speakerNotes?: string;
  sourceFile?: string;
  layoutType?: string;
}

interface SlideMapping {
  oldSlideNumber: number;
  newSlideNumber: number;
  similarity: number;
  sourceFile?: string;
}

function buildSlideMapping(
  oldSlides: SlideRecord[],
  newSlides: SlideRecord[]
): {
  mappings: SlideMapping[];
  insertedSlides: number[]; // new slide numbers with no old match
  deletedSlides: number[]; // old slide numbers with no new match
} {
  const mappings: SlideMapping[] = [];
  const matchedOld = new Set<number>();
  const matchedNew = new Set<number>();

  // Pass 1: exact text match
  for (const oldS of oldSlides) {
    if (matchedOld.has(oldS.slideNumber)) continue;
    const oldText = normalize(oldS.textContent ?? "");
    if (!oldText) continue;
    for (const newS of newSlides) {
      if (matchedNew.has(newS.slideNumber)) continue;
      if (oldS.sourceFile !== newS.sourceFile) continue;
      if (normalize(newS.textContent ?? "") === oldText) {
        mappings.push({
          oldSlideNumber: oldS.slideNumber,
          newSlideNumber: newS.slideNumber,
          similarity: 1.0,
          sourceFile: oldS.sourceFile,
        });
        matchedOld.add(oldS.slideNumber);
        matchedNew.add(newS.slideNumber);
        break;
      }
    }
  }

  // Pass 2: first-line (title) match for unmatched
  for (const oldS of oldSlides) {
    if (matchedOld.has(oldS.slideNumber)) continue;
    const oldTitle = firstLine(oldS.textContent ?? "");
    if (!oldTitle) continue;
    for (const newS of newSlides) {
      if (matchedNew.has(newS.slideNumber)) continue;
      if (oldS.sourceFile !== newS.sourceFile) continue;
      if (firstLine(newS.textContent ?? "") === oldTitle) {
        const sim = jaccard(oldS.textContent ?? "", newS.textContent ?? "");
        mappings.push({
          oldSlideNumber: oldS.slideNumber,
          newSlideNumber: newS.slideNumber,
          similarity: Math.max(sim, 0.8), // title match is strong signal
          sourceFile: oldS.sourceFile,
        });
        matchedOld.add(oldS.slideNumber);
        matchedNew.add(newS.slideNumber);
        break;
      }
    }
  }

  // Pass 3: best Jaccard match above threshold for remaining
  for (const oldS of oldSlides) {
    if (matchedOld.has(oldS.slideNumber)) continue;
    let bestSim = 0;
    let bestNew: SlideRecord | null = null;
    for (const newS of newSlides) {
      if (matchedNew.has(newS.slideNumber)) continue;
      if (oldS.sourceFile !== newS.sourceFile) continue;
      const sim = jaccard(oldS.textContent ?? "", newS.textContent ?? "");
      if (sim > bestSim && sim >= MATCH_THRESHOLD) {
        bestSim = sim;
        bestNew = newS;
      }
    }
    if (bestNew) {
      mappings.push({
        oldSlideNumber: oldS.slideNumber,
        newSlideNumber: bestNew.slideNumber,
        similarity: bestSim,
        sourceFile: oldS.sourceFile,
      });
      matchedOld.add(oldS.slideNumber);
      matchedNew.add(bestNew.slideNumber);
    }
  }

  const deletedSlides = oldSlides
    .filter((s) => !matchedOld.has(s.slideNumber))
    .map((s) => s.slideNumber);
  const insertedSlides = newSlides
    .filter((s) => !matchedNew.has(s.slideNumber))
    .map((s) => s.slideNumber);

  return { mappings, insertedSlides, deletedSlides };
}

// ---------------------------------------------------------------------------
// Main query — returns everything the Orchestrator needs in one call
// ---------------------------------------------------------------------------

export const correctionsDiff = internalQuery({
  args: {
    moduleId: v.string(),
    version: v.number(), // the corrections version (N) — compares with N-1
  },
  handler: async (ctx, { moduleId, version }) => {
    const prevVersion = version - 1;
    if (prevVersion < 1) {
      throw new Error(`Version ${version} has no previous version to diff against`);
    }

    // Fetch both versions of slides
    const [oldSlides, newSlides] = await Promise.all([
      ctx.db
        .query("parsedSlides")
        .withIndex("by_moduleId_version", (q) =>
          q.eq("moduleId", moduleId).eq("version", prevVersion)
        )
        .collect(),
      ctx.db
        .query("parsedSlides")
        .withIndex("by_moduleId_version", (q) =>
          q.eq("moduleId", moduleId).eq("version", version)
        )
        .collect(),
    ]);

    // Fetch accepted recommendations from previous version
    const allRecs = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", moduleId).eq("version", prevVersion)
      )
      .collect();
    const acceptedRecs = allRecs.filter(
      (r) => r.reviewStatus === "accepted" || r.source === "reviewer"
    );

    // Build slide mapping
    const { mappings, insertedSlides, deletedSlides } = buildSlideMapping(
      oldSlides,
      newSlides
    );

    // Create lookup: old slide number → new slide number
    const oldToNew = new Map<number, number>();
    for (const m of mappings) {
      oldToNew.set(m.oldSlideNumber, m.newSlideNumber);
    }

    // Create lookup: new slide number → slide data
    const newSlideMap = new Map<number, (typeof newSlides)[0]>();
    for (const s of newSlides) {
      newSlideMap.set(s.slideNumber, s);
    }

    // For each accepted rec, find the mapped new slide + neighbors
    const targetedRecs = acceptedRecs.map((rec) => {
      const oldSlideNum = rec.slideNumber;
      const newSlideNum = oldSlideNum != null ? oldToNew.get(oldSlideNum) : undefined;

      // Collect targeted slides: the mapped slide + 1 neighbor each side
      const targetSlides: Array<{
        slideNumber: number;
        textContent: string;
        speakerNotes: string;
        sourceFile: string;
        layoutType: string;
      }> = [];

      if (newSlideNum != null) {
        for (const offset of [-1, 0, 1]) {
          const s = newSlideMap.get(newSlideNum + offset);
          if (s && s.sourceFile === (rec.component === "module" ? undefined : rec.component === "spine" ? "spine" : rec.component)) {
            targetSlides.push({
              slideNumber: s.slideNumber,
              textContent: s.textContent ?? "",
              speakerNotes: s.speakerNotes ?? "",
              sourceFile: s.sourceFile ?? "",
              layoutType: s.layoutType ?? "",
            });
          }
        }
        // If sourceFile matching was too strict and we got nothing, include without filter
        if (targetSlides.length === 0) {
          for (const offset of [-1, 0, 1]) {
            const s = newSlideMap.get(newSlideNum + offset);
            if (s) {
              targetSlides.push({
                slideNumber: s.slideNumber,
                textContent: s.textContent ?? "",
                speakerNotes: s.speakerNotes ?? "",
                sourceFile: s.sourceFile ?? "",
                layoutType: s.layoutType ?? "",
              });
            }
          }
        }
      }

      return {
        recommendationId: rec._id,
        directiveIndex: rec.directiveIndex,
        originalSlideNumber: rec.slideNumber,
        mappedNewSlideNumber: newSlideNum ?? null,
        issue: rec.issue,
        recommendedFix: rec.recommendedFix,
        operationType: rec.operationType,
        quadrantId: rec.quadrantId,
        component: rec.component,
        pointsRecoverable: rec.pointsRecoverable,
        confidence: rec.confidence,
        source: rec.source,
        targetSlides,
      };
    });

    // Unexpected changes summary
    // Count INSERT/DELETE recs to compare against actual inserts/deletes
    const insertRecs = acceptedRecs.filter((r) => r.operationType === "INSERT").length;
    const deleteRecs = acceptedRecs.filter((r) => r.operationType === "DELETE").length;

    // Detect significant text changes on non-targeted slides
    const targetedNewSlideNums = new Set<number>();
    for (const tr of targetedRecs) {
      for (const ts of tr.targetSlides) {
        targetedNewSlideNums.add(ts.slideNumber);
      }
    }
    const changedNonTargeted: Array<{ newSlideNumber: number; sourceFile: string }> = [];
    for (const m of mappings) {
      if (targetedNewSlideNums.has(m.newSlideNumber)) continue;
      // similarity < 0.9 means significant text change on a non-targeted slide
      if (m.similarity < 0.9) {
        changedNonTargeted.push({
          newSlideNumber: m.newSlideNumber,
          sourceFile: m.sourceFile ?? "",
        });
      }
    }

    const unexpectedChanges = {
      insertedSlideCount: insertedSlides.length,
      insertRecsCount: insertRecs,
      deletedSlideCount: deletedSlides.length,
      deleteRecsCount: deleteRecs,
      changedNonTargetedSlides: changedNonTargeted,
      hasUnexpectedChanges:
        insertedSlides.length > insertRecs ||
        deletedSlides.length > deleteRecs ||
        changedNonTargeted.length > 0,
      summary: buildSummary(insertedSlides.length, insertRecs, deletedSlides.length, deleteRecs, changedNonTargeted.length),
    };

    // Group targeted recs by component for Orchestrator
    const byComponent: Record<string, typeof targetedRecs> = {};
    for (const tr of targetedRecs) {
      const key = tr.component ?? "module";
      if (!byComponent[key]) byComponent[key] = [];
      byComponent[key].push(tr);
    }

    return {
      moduleId,
      version,
      prevVersion,
      slideMapping: {
        totalOldSlides: oldSlides.length,
        totalNewSlides: newSlides.length,
        matchedCount: mappings.length,
        insertedSlides,
        deletedSlides,
      },
      targetedRecsByComponent: byComponent,
      totalAcceptedRecs: acceptedRecs.length,
      unexpectedChanges,
    };
  },
});

// Public query for frontend — returns only unexpected changes summary (no targeted recs)
export const unexpectedChanges = query({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");

    const prevVersion = version - 1;
    if (prevVersion < 1) return null;

    const [oldSlides, newSlides] = await Promise.all([
      ctx.db
        .query("parsedSlides")
        .withIndex("by_moduleId_version", (q) =>
          q.eq("moduleId", moduleId).eq("version", prevVersion)
        )
        .collect(),
      ctx.db
        .query("parsedSlides")
        .withIndex("by_moduleId_version", (q) =>
          q.eq("moduleId", moduleId).eq("version", version)
        )
        .collect(),
    ]);

    if (oldSlides.length === 0 || newSlides.length === 0) return null;

    const allRecs = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", moduleId).eq("version", prevVersion)
      )
      .collect();
    const acceptedRecs = allRecs.filter(
      (r) => r.reviewStatus === "accepted" || r.source === "reviewer"
    );

    const { mappings, insertedSlides, deletedSlides } = buildSlideMapping(oldSlides, newSlides);

    const insertRecs = acceptedRecs.filter((r) => r.operationType === "INSERT").length;
    const deleteRecs = acceptedRecs.filter((r) => r.operationType === "DELETE").length;

    // Detect text changes on non-targeted slides
    const oldToNew = new Map<number, number>();
    for (const m of mappings) oldToNew.set(m.oldSlideNumber, m.newSlideNumber);

    const targetedNewNums = new Set<number>();
    for (const rec of acceptedRecs) {
      if (rec.slideNumber != null) {
        const mapped = oldToNew.get(rec.slideNumber);
        if (mapped != null) {
          targetedNewNums.add(mapped - 1);
          targetedNewNums.add(mapped);
          targetedNewNums.add(mapped + 1);
        }
      }
    }

    const changedNonTargeted: Array<{ newSlideNumber: number; sourceFile: string }> = [];
    for (const m of mappings) {
      if (targetedNewNums.has(m.newSlideNumber)) continue;
      if (m.similarity < 0.9) {
        changedNonTargeted.push({ newSlideNumber: m.newSlideNumber, sourceFile: m.sourceFile ?? "" });
      }
    }

    const hasUnexpectedChanges =
      insertedSlides.length > insertRecs ||
      deletedSlides.length > deleteRecs ||
      changedNonTargeted.length > 0;

    return {
      hasUnexpectedChanges,
      summary: buildSummary(insertedSlides.length, insertRecs, deletedSlides.length, deleteRecs, changedNonTargeted.length),
      slideMapping: {
        totalOldSlides: oldSlides.length,
        totalNewSlides: newSlides.length,
        matchedCount: mappings.length,
      },
    };
  },
});

function buildSummary(
  inserted: number,
  insertRecs: number,
  deleted: number,
  deleteRecs: number,
  changedNonTargeted: number
): string {
  const parts: string[] = [];
  if (inserted > insertRecs) {
    parts.push(`${inserted} slides inserted (only ${insertRecs} INSERT recommendation${insertRecs === 1 ? "" : "s"} existed)`);
  }
  if (deleted > deleteRecs) {
    parts.push(`${deleted} slides deleted (only ${deleteRecs} DELETE recommendation${deleteRecs === 1 ? "" : "s"} existed)`);
  }
  if (changedNonTargeted > 0) {
    parts.push(`${changedNonTargeted} slide${changedNonTargeted === 1 ? "" : "s"} significantly changed with no recommendation targeting ${changedNonTargeted === 1 ? "it" : "them"}`);
  }
  return parts.length > 0 ? parts.join(". ") + "." : "No unexpected changes detected.";
}
