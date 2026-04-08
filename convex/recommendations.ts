import { internalMutation, internalQuery, mutation, query, MutationCtx } from "./_generated/server";
import { v } from "convex/values";
import { logActivityIfNew, isModuleDeleted } from "./lib/activityHelper";
import { ROLES, canAccessModule, canReviewModule, requireAnyRole, requireCurrentUser } from "./lib/authz";

async function completeVinayReviewImpl(ctx: Pick<MutationCtx, "db">, moduleId: string, version: number) {
  const recs = await ctx.db
    .query("recommendations")
    .withIndex("by_moduleId_version", (q) =>
      q.eq("moduleId", moduleId).eq("version", version)
    )
    .collect();
  const pending = recs.filter((r) => r.reviewStatus === "pending");
  if (pending.length > 0) {
    throw new Error(`${pending.length} recommendations still pending. Review all before completing.`);
  }
  const module = await ctx.db
    .query("modules")
    .withIndex("by_moduleId", (q) => q.eq("moduleId", moduleId))
    .order("desc")
    .first();

  // Get review scores to calculate per-quadrant-per-component deductions for capping
  const reviewScores = await ctx.db
    .query("reviewScores")
    .withIndex("by_moduleId_version", (q) =>
      q.eq("moduleId", moduleId).eq("version", version)
    )
    .collect();

  // Build per-component quadrant deduction map:
  // component (reviewPass) -> quadrantId -> { maxPoints, score, deduction }
  const componentQuadrantDeductions = new Map<string, Map<string, { maxPoints: number; score: number; deduction: number }>>();
  
  for (const rs of reviewScores) {
    const component = rs.reviewPass; // "spine", "applet_1", etc.
    const quadrantMap = new Map<string, { maxPoints: number; score: number; deduction: number }>();
    
    for (const qs of rs.quadrantScores) {
      quadrantMap.set(qs.quadrantId, {
        maxPoints: qs.maxPoints,
        score: qs.score,
        deduction: Math.max(0, qs.maxPoints - qs.score),
      });
    }
    componentQuadrantDeductions.set(component, quadrantMap);
  }

  // Filter rejected initial-review recs (exclude corrections_check and custom_review)
  const rejectedInitialRecs = recs.filter(
    (r) =>
      r.reviewStatus === "rejected" &&
      r.sourcePass !== "corrections_check" &&
      r.sourcePass !== "custom_review"
  );

  // Group rejected recs by component + quadrantId
  // Key format: "component:quadrantId" (e.g., "spine:P", "applet_1:D")
  const rejectedByComponentQuadrant = new Map<string, typeof rejectedInitialRecs>();
  for (const r of rejectedInitialRecs) {
    const component = r.component ?? "module";
    const quadrantId = r.quadrantId ?? "GENERAL";
    const key = `${component}:${quadrantId}`;
    if (!rejectedByComponentQuadrant.has(key)) rejectedByComponentQuadrant.set(key, []);
    rejectedByComponentQuadrant.get(key)!.push(r);
  }

  // Valid scoring quadrants (P, D, X, L) - these have deductions in reviewScores
  const scoringQuadrants = new Set(["P", "D", "X", "L"]);
  
  // Calculate capped add-back per component+quadrant
  // Also track total add-back per component for component score adjustment
  const componentAddBacks = new Map<string, number>(); // component -> total capped add-back
  let uncappedModuleAddBack = 0; // For module-wide and special quadrant recommendations
  const quadrantAddBacksDetail: { component: string; quadrantId: string; raw: number; capped: number; deduction: number; cappedReason: string }[] = [];

  rejectedByComponentQuadrant.forEach((qRecs, key) => {
    const [component, quadrantId] = key.split(":");
    const rawAddBack = qRecs.reduce((sum, r) => sum + (r.pointsRecoverable ?? 0), 0);
    
    // Determine if this should be capped or not
    const isScoringQuadrant = scoringQuadrants.has(quadrantId);
    const hasComponentScore = componentQuadrantDeductions.has(component);
    
    let cappedAddBack: number;
    let deduction: number;
    let cappedReason: string;
    
    if (hasComponentScore && isScoringQuadrant) {
      // Component-level recommendation for a scoring quadrant - CAP IT
      const quadrantMap = componentQuadrantDeductions.get(component)!;
      const quadrantData = quadrantMap.get(quadrantId);
      deduction = quadrantData?.deduction ?? 0;
      cappedAddBack = Math.min(rawAddBack, deduction);
      cappedReason = deduction > 0 ? "capped_at_deduction" : "no_deduction";
      
      // Track per-component totals
      const currentTotal = componentAddBacks.get(component) ?? 0;
      componentAddBacks.set(component, currentTotal + cappedAddBack);
    } else {
      // Module-wide (component="module") or special quadrant (GATE, AP, CC, etc.) - NO CAP
      cappedAddBack = rawAddBack;
      deduction = 0;
      cappedReason = component === "module" ? "module_wide_no_cap" : "special_quadrant_no_cap";
      
      // Add to uncapped module total
      uncappedModuleAddBack += rawAddBack;
    }
    
    quadrantAddBacksDetail.push({ 
      component, 
      quadrantId, 
      raw: rawAddBack, 
      capped: cappedAddBack, 
      deduction,
      cappedReason,
    });
  });

  // Calculate new component scores and overall score
  let totalNewScore = 0;
  let componentCount = 0;
  const componentScoreAdjustments: { component: string; originalScore: number; addBack: number; newScore: number }[] = [];

  for (const rs of reviewScores) {
    const component = rs.reviewPass;
    const originalScore = rs.totalPoints;
    const addBack = componentAddBacks.get(component) ?? 0;
    const newScore = Math.min(originalScore + addBack, 100);
    
    totalNewScore += newScore;
    componentCount++;
    componentScoreAdjustments.push({ component, originalScore, addBack, newScore });
  }

  // Calculate overall score as average of component scores, then add uncapped module add-back
  const avgComponentScore = componentCount > 0 ? totalNewScore / componentCount : 0;
  const adjustedScore = Math.min(Math.round(avgComponentScore + uncappedModuleAddBack), 100);

  let scoreBand: string;
  if (adjustedScore >= 90) scoreBand = "Ship-ready";
  else if (adjustedScore >= 75) scoreBand = "Upgradeable";
  else if (adjustedScore >= 50) scoreBand = "Rework";
  else scoreBand = "Redesign";

  if (module && module.version === version) {
    await ctx.db.patch(module._id, {
      status: "vinay_reviewed",
      overallScore: adjustedScore,
      overallPercentage: adjustedScore,
      scoreBand,
      updatedAt: new Date().toISOString(),
    });
  }
  
  const accepted = recs.filter((r) => r.reviewStatus === "accepted").length;
  const rejected = recs.filter((r) => r.reviewStatus === "rejected").length;
  const rawAddBack = rejectedInitialRecs.reduce((sum, r) => sum + (r.pointsRecoverable ?? 0), 0);
  const totalCappedAddBack = Array.from(componentAddBacks.values()).reduce((sum, v) => sum + v, 0);
  
  return { 
    accepted, 
    rejected, 
    total: recs.length, 
    rawAddBack,
    addBackPoints: totalCappedAddBack + uncappedModuleAddBack, 
    cappedAddBack: totalCappedAddBack,
    uncappedModuleAddBack,
    adjustedScore, 
    scoreBand,
    componentScoreAdjustments,
    quadrantAddBacks: quadrantAddBacksDetail,
  };
}

// Batch-insert recommendations (called by Integrator or Reviewers)
// When called WITH score fields: updates module score + transitions to review_complete (Integrator path)
// When called WITHOUT score fields: inserts recommendations only, no status change (Reviewer path)
export const pushBatch = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    recommendations: v.array(
      v.object({
        directiveIndex: v.number(),
        slideNumber: v.optional(v.number()),
        issue: v.string(),
        quadrantId: v.string(),
        recommendedFix: v.string(),
        why: v.optional(v.string()),
        operationType: v.string(),
        confidence: v.string(),
        sourceAttribution: v.optional(v.string()),
        component: v.string(),
        pointsRecoverable: v.optional(v.number()),
        sourcePass: v.string(),
        priority: v.optional(v.number()),
        fixStatus: v.optional(v.string()),
      })
    ),
    // Denormalized score data to set on module
    overallScore: v.optional(v.number()),
    overallPercentage: v.optional(v.number()),
    scoreBand: v.optional(v.string()),
    agentName: v.string(),
    dedupKey: v.string(),
  },
  handler: async (ctx, args) => {
    // Bail if module was deleted
    if (await isModuleDeleted(ctx, args.moduleId)) return { action: "module_deleted" };

    // Dedup — check if we already processed this batch
    // For corrections passes, skip activity dedup — Layer 2 upsert handles re-runs
    const isCorrectionsPass = args.recommendations.some(
      (r) => r.sourcePass === "corrections_check"
    );
    if (!isCorrectionsPass) {
      const existingActivity = await ctx.db
        .query("agentActivity")
        .withIndex("by_dedupKey", (q) => q.eq("dedupKey", `activity-${args.dedupKey}`))
        .first();
      if (existingActivity) return { action: "duplicate" };
    }

    // Semantic dedup: if corrections_check recs already exist for this
    // component+module+version, upsert — delete stale ones, then insert fresh.
    let upsertedComponent: string | null = null;
    let deletedCount = 0;

    if (isCorrectionsPass) {
      const component = args.recommendations[0].component;

      const existingRecs = await ctx.db
        .query("recommendations")
        .withIndex("by_moduleId_version_component", (q) =>
          q
            .eq("moduleId", args.moduleId)
            .eq("version", args.version)
            .eq("component", component)
        )
        .collect();

      const existingCorrections = existingRecs.filter(
        (r) => r.sourcePass === "corrections_check"
      );

      if (existingCorrections.length > 0) {
        for (const old of existingCorrections) {
          await ctx.db.delete(old._id);
        }
        upsertedComponent = component;
        deletedCount = existingCorrections.length;
      }
    }

    const now = new Date().toISOString();

    // Insert all recommendations
    for (const r of args.recommendations) {
      await ctx.db.insert("recommendations", {
        moduleId: args.moduleId,
        version: args.version,
        directiveIndex: r.directiveIndex,
        slideNumber: r.slideNumber,
        issue: r.issue,
        quadrantId: r.quadrantId,
        recommendedFix: r.recommendedFix,
        why: r.why,
        operationType: r.operationType,
        confidence: r.confidence,
        sourceAttribution: r.sourceAttribution,
        component: r.component,
        pointsRecoverable: r.pointsRecoverable,
        sourcePass: r.sourcePass,
        priority: r.priority,
        fixStatus: r.fixStatus,
        reviewStatus: "pending",
        agentName: args.agentName,
        createdAt: now,
      });
    }

    // Update module with score data + status (only when score fields provided — Integrator path)
    // Reviewers call without score fields — no status change, just recommendation insertion
    const hasScoreData = args.overallScore !== undefined && args.scoreBand !== undefined;
    if (hasScoreData) {
      const module = await ctx.db
        .query("modules")
        .withIndex("by_moduleId", (q) => q.eq("moduleId", args.moduleId))
        .order("desc")
        .first();

      if (module && module.version === args.version) {
        await ctx.db.patch(module._id, {
          status: "review_complete",
          overallScore: args.overallScore,
          overallPercentage: args.overallPercentage,
          scoreBand: args.scoreBand,
          updatedAt: now,
        });
      }
    }

    const upsertNote = upsertedComponent
      ? ` (upsert: replaced ${deletedCount} stale corrections for ${upsertedComponent})`
      : "";

    await logActivityIfNew(ctx, {
      agentName: args.agentName,
      action: upsertedComponent ? "recommendations_upserted" : "recommendations_pushed",
      message: `${args.recommendations.length} recommendations for "${args.moduleId}" v${args.version}. Band: ${args.scoreBand ?? "unknown"}${upsertNote}`,
      dedupKey: `activity-${args.dedupKey}`,
      metadata: { moduleId: args.moduleId, version: args.version, count: args.recommendations.length, scoreBand: args.scoreBand },
    });

    if (upsertedComponent) {
      return { action: "upserted", count: args.recommendations.length, replacedCount: deletedCount, component: upsertedComponent };
    }
    return { action: "created", count: args.recommendations.length };
  },
});

// Review a single recommendation (Vinay accepts/rejects)
export const review = mutation({
  args: {
    recommendationId: v.id("recommendations"),
    reviewStatus: v.string(),
    vinayComment: v.optional(v.string()),
  },
  handler: async (ctx, { recommendationId, reviewStatus, vinayComment }) => {
    await requireAnyRole(ctx, [ROLES.LEAD_REVIEWER, ROLES.MANAGER, ROLES.ADMIN]);
    if (!["accepted", "rejected"].includes(reviewStatus)) {
      throw new Error(`Invalid reviewStatus: ${reviewStatus}`);
    }
    if (reviewStatus === "rejected" && !vinayComment) {
      throw new Error("Comment is mandatory when rejecting a recommendation.");
    }

    const rec = await ctx.db.get(recommendationId);
    if (!rec) throw new Error("Recommendation not found");
    const allowed = await canReviewModule(ctx, rec.moduleId);
    if (!allowed) throw new Error("Forbidden: no review access for this module");

    await ctx.db.patch(recommendationId, {
      reviewStatus,
      vinayComment: vinayComment ?? undefined,
      reviewedAt: new Date().toISOString(),
    });
  },
});

// Complete Vinay's review — check all recommendations are decided
export const completeVinayReview = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canReviewModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no review access");
    return await completeVinayReviewImpl(ctx, moduleId, version);
  },
});

// Add a custom review (called from frontend by human reviewer)
export const addCustomReview = mutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
    issue: v.string(),
    recommendedFix: v.string(),
    component: v.string(),
    slideNumber: v.optional(v.number()),
    reviewerName: v.string(),
  },
  handler: async (ctx, args) => {
    const allowed = await canReviewModule(ctx, args.moduleId);
    if (!allowed) throw new Error("Forbidden: no review access");
    // Count existing recs to get next directiveIndex
    const existing = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", args.moduleId).eq("version", args.version)
      )
      .collect();

    const now = new Date().toISOString();

    await ctx.db.insert("recommendations", {
      moduleId: args.moduleId,
      version: args.version,
      directiveIndex: existing.length,
      slideNumber: args.slideNumber,
      issue: args.issue,
      quadrantId: "GENERAL",
      recommendedFix: args.recommendedFix || "",
      operationType: "EDIT",
      confidence: "high",
      sourceAttribution: args.reviewerName,
      component: args.component,
      sourcePass: "custom_review",
      reviewStatus: "accepted",
      reviewedAt: now,
      agentName: args.reviewerName,
      source: "reviewer",
      createdAt: now,
    });
  },
});

// Accepted feedback from a specific version — used by Orchestrator for corrections flow
export const acceptedByModuleVersion = internalQuery({
  args: { moduleId: v.string(), version: v.number() },
  handler: async (ctx, { moduleId, version }) => {
    const all = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        q.eq("moduleId", moduleId).eq("version", version)
      )
      .collect();
    // Include accepted agent recs + all custom reviews (source === "reviewer")
    return all.filter((r) => r.reviewStatus === "accepted" || r.source === "reviewer");
  },
});

// --- Internal variants for HTTP agent routes (API-key gated, no user session) ---

export const internalReview = internalMutation({
  args: {
    recommendationId: v.id("recommendations"),
    reviewStatus: v.string(),
    vinayComment: v.optional(v.string()),
  },
  handler: async (ctx, { recommendationId, reviewStatus, vinayComment }) => {
    if (!["accepted", "rejected"].includes(reviewStatus)) {
      throw new Error(`Invalid reviewStatus: ${reviewStatus}`);
    }
    if (reviewStatus === "rejected" && !vinayComment) {
      throw new Error("Comment is mandatory when rejecting a recommendation.");
    }
    await ctx.db.patch(recommendationId, {
      reviewStatus,
      vinayComment: vinayComment ?? undefined,
      reviewedAt: new Date().toISOString(),
    });
  },
});

export const internalCompleteVinayReview = internalMutation({
  args: {
    moduleId: v.string(),
    version: v.number(),
  },
  handler: async (ctx, { moduleId, version }) => {
    return await completeVinayReviewImpl(ctx, moduleId, version);
  },
});

export const internalByModule = internalQuery({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const q = ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      );
    return await q.collect();
  },
});

export const byModule = query({
  args: { moduleId: v.string(), version: v.optional(v.number()) },
  handler: async (ctx, { moduleId, version }) => {
    const allowed = await canAccessModule(ctx, moduleId);
    if (!allowed) throw new Error("Forbidden: no module access");
    const user = await requireCurrentUser(ctx, { allowFirstLogin: true });
    const recs = await ctx.db
      .query("recommendations")
      .withIndex("by_moduleId_version", (q) =>
        version !== undefined
          ? q.eq("moduleId", moduleId).eq("version", version)
          : q.eq("moduleId", moduleId)
      )
      .collect();

    // Filter out soft-deleted recs
    const active = recs.filter((r) => !r.deletedAt);

    if (user.role === ROLES.CONTENT_CREATOR) {
      return active.filter((r) => r.reviewStatus !== "pending" || r.source === "reviewer");
    }
    return active;
  },
});

// Soft-delete a custom recommendation (reviewer-authored only)
export const softDeleteRecommendation = mutation({
  args: { recommendationId: v.id("recommendations") },
  handler: async (ctx, { recommendationId }) => {
    await requireAnyRole(ctx, [ROLES.LEAD_REVIEWER, ROLES.MANAGER, ROLES.ADMIN]);
    const rec = await ctx.db.get(recommendationId);
    if (!rec) throw new Error("Recommendation not found");
    if (rec.source !== "reviewer") throw new Error("Only reviewer-authored recommendations can be deleted");
    const allowed = await canReviewModule(ctx, rec.moduleId);
    if (!allowed) throw new Error("Forbidden: no review access for this module");
    await ctx.db.patch(recommendationId, { deletedAt: new Date().toISOString() });
  },
});
