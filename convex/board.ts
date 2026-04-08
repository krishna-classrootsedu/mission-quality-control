import { query } from "./_generated/server";
import { getModulesForUser } from "./lib/authz";
import type { Id } from "./_generated/dataModel";

// Board column names
type BoardColumn =
  | "Submitted"
  | "Parsing"
  | "Gate Check"
  | "In Review"
  | "Integration"
  | "Vinay Review"
  | "Creator Fix"
  | "Ship-ready";

type ModuleBoardItem = {
  _id: string;
  moduleId: string;
  title: string;
  learningObjective: string;
  grade: number;
  chapterNumber: number | null;
  chapterName: string | null;
  moduleNumber: number | null;
  status: string;
  version: number;
  column: BoardColumn;
  overallScore: number | null;
  overallPercentage: number | null;
  scoreBand: string | null;
  spineComplete: boolean;
  totalApplets: number;
  completedAppletReviews: number;
  submittedBy: string | null;
  submittedAt: string;
  updatedAt: string;
  completedAt: string | null;
  // Recommendation counts for Vinay Review stage
  recommendationCounts: { total: number; pending: number; accepted: number; rejected: number } | null;
  // Corrections projected score (only for corrections versions)
  corrections: {
    previousScore: number;
    projectedScore: number;
    fixedCount: number;
    partialCount: number;
    notFixedCount: number;
    totalRecs: number;
  } | null;
  reviewerName?: string | null;
};

function statusToColumn(status: string): BoardColumn {
  switch (status) {
    case "submitted":
      return "Submitted";
    case "intake_complete":
    case "intake_flagged":
    case "intake_failed":
      return "Parsing";
    case "gatekeeper_pass":
    case "gatekeeper_fail":
    case "flow_mapped":
    case "researched":
      return "Gate Check";
    case "all_reviews_complete":
      return "Integration";
    case "corrections_intake_complete":
      return "In Review";
    case "review_complete":
    case "corrections_review_complete":
      return "Vinay Review";
    case "vinay_reviewed":
    case "creator_fixing":
      return "Creator Fix";
    case "ship_ready":
      return "Ship-ready";
    default:
      return "Submitted";
  }
}

export const getBoard = query({
  args: {},
  handler: async (ctx): Promise<ModuleBoardItem[]> => {
    const { modules: allModules } = await getModulesForUser(ctx);

    // Show only the latest version per moduleId
    const latestByModuleId = new Map<string, (typeof allModules)[0]>();
    for (const m of allModules) {
      const existing = latestByModuleId.get(m.moduleId);
      if (!existing || m.version > existing.version) {
        latestByModuleId.set(m.moduleId, m);
      }
    }
    const modules = Array.from(latestByModuleId.values());

    // For corrections modules, compute projected score from previous version + fixStatus
    const correctionsStatuses = ["corrections_intake_complete", "corrections_review_complete"];
    const correctionsModules = modules.filter((m) => correctionsStatuses.includes(m.status) && m.version > 1);
    const correctionsMap = new Map<string, { previousScore: number; projectedScore: number; fixedCount: number; partialCount: number; notFixedCount: number; totalRecs: number }>();

    for (const m of correctionsModules) {
      // Find previous version's score
      const prevModule = allModules.find((am) => am.moduleId === m.moduleId && am.version === m.version - 1 && !am.deleted);
      const prevScore = prevModule?.overallScore ?? 0;

      // Get corrections-check recs for this version
      const corrRecs = await ctx.db
        .query("recommendations")
        .withIndex("by_moduleId_version", (q) => q.eq("moduleId", m.moduleId).eq("version", m.version))
        .collect();
      const checkRecs = corrRecs.filter((r) => r.sourcePass === "corrections_check" && r.reviewStatus === "accepted");

      let recovered = 0;
      let fixedCount = 0;
      let partialCount = 0;
      let notFixedCount = 0;
      for (const r of checkRecs) {
        const pts = r.pointsRecoverable ?? 0;
        if (r.fixStatus === "fixed") { recovered += pts; fixedCount++; }
        else if (r.fixStatus === "partially_fixed") { recovered += pts * 0.5; partialCount++; }
        else { notFixedCount++; }
      }

      correctionsMap.set(`${m.moduleId}-v${m.version}`, {
        previousScore: prevScore,
        projectedScore: Math.min(Math.round(prevScore + recovered), 100),
        fixedCount,
        partialCount,
        notFixedCount,
        totalRecs: checkRecs.length,
      });
    }

    // For modules in Vinay Review, fetch recommendation counts
    const vinayModuleIds = modules
      .filter((m) => m.status === "review_complete" || m.status === "corrections_review_complete")
      .map((m) => ({ moduleId: m.moduleId, version: m.version }));

    const recCountsMap = new Map<string, { total: number; pending: number; accepted: number; rejected: number }>();
    const vinayKeySet = new Set(vinayModuleIds.map(({ moduleId, version }) => `${moduleId}-v${version}`));
    const allVinayRecs = await ctx.db.query("recommendations").collect();
    for (const r of allVinayRecs) {
      const key = `${r.moduleId}-v${r.version}`;
      if (!vinayKeySet.has(key)) continue;
      const existing = recCountsMap.get(key) ?? { total: 0, pending: 0, accepted: 0, rejected: 0 };
      existing.total += 1;
      if (r.reviewStatus === "pending") existing.pending += 1;
      if (r.reviewStatus === "accepted") existing.accepted += 1;
      if (r.reviewStatus === "rejected") existing.rejected += 1;
      recCountsMap.set(key, existing);
    }

    return modules.map((m) => ({
      _id: m._id,
      moduleId: m.moduleId,
      title: m.title,
      learningObjective: m.learningObjective,
      grade: m.grade,
      chapterNumber: m.chapterNumber ?? null,
      chapterName: m.chapterName ?? null,
      moduleNumber: m.moduleNumber ?? null,
      status: m.status,
      version: m.version,
      column: statusToColumn(m.status),
      overallScore: m.overallScore ?? null,
      overallPercentage: m.overallPercentage ?? null,
      scoreBand: m.scoreBand ?? null,
      spineComplete: m.spineComplete ?? false,
      totalApplets: m.totalApplets ?? 0,
      completedAppletReviews: m.completedAppletReviews ?? 0,
      submittedBy: m.submittedBy ?? null,
      submittedAt: m.submittedAt,
      updatedAt: m.updatedAt,
      completedAt: m.completedAt ?? null,
      recommendationCounts: recCountsMap.get(`${m.moduleId}-v${m.version}`) ?? null,
      corrections: correctionsMap.get(`${m.moduleId}-v${m.version}`) ?? null,
    }));
  },
});

// Tracker view — enriches getBoard data with allocated reviewer names.
// modulePermissions: userId[] with "review" permission per module.
export const getTrackerData = query({
  args: {},
  handler: async (ctx): Promise<ModuleBoardItem[]> => {
    const { modules: allModules, user } = await getModulesForUser(ctx);

    // Latest version per moduleId (same as getBoard)
    const latestByModuleId = new Map<string, (typeof allModules)[0]>();
    for (const m of allModules) {
      const existing = latestByModuleId.get(m.moduleId);
      if (!existing || m.version > existing.version) {
        latestByModuleId.set(m.moduleId, m);
      }
    }
    const modules = Array.from(latestByModuleId.values());

    // Corrections projections (same logic as getBoard)
    const correctionsStatuses = ["corrections_intake_complete", "corrections_review_complete"];
    const correctionsModules = modules.filter((m) => correctionsStatuses.includes(m.status) && m.version > 1);
    const correctionsMap = new Map<string, { previousScore: number; projectedScore: number; fixedCount: number; partialCount: number; notFixedCount: number; totalRecs: number }>();

    for (const m of correctionsModules) {
      const prevModule = allModules.find((am) => am.moduleId === m.moduleId && am.version === m.version - 1 && !am.deleted);
      const prevScore = prevModule?.overallScore ?? 0;
      const corrRecs = await ctx.db
        .query("recommendations")
        .withIndex("by_moduleId_version", (q) => q.eq("moduleId", m.moduleId).eq("version", m.version))
        .collect();
      const checkRecs = corrRecs.filter((r) => r.sourcePass === "corrections_check" && r.reviewStatus === "accepted");
      let recovered = 0, fixedCount = 0, partialCount = 0, notFixedCount = 0;
      for (const r of checkRecs) {
        const pts = r.pointsRecoverable ?? 0;
        if (r.fixStatus === "fixed") { recovered += pts; fixedCount++; }
        else if (r.fixStatus === "partially_fixed") { recovered += pts * 0.5; partialCount++; }
        else { notFixedCount++; }
      }
      correctionsMap.set(`${m.moduleId}-v${m.version}`, {
        previousScore: prevScore,
        projectedScore: Math.min(Math.round(prevScore + recovered), 100),
        fixedCount, partialCount, notFixedCount, totalRecs: checkRecs.length,
      });
    }

    // Recommendation counts
    const recCountsMap = new Map<string, { total: number; pending: number; accepted: number; rejected: number }>();
    const allRecs = await ctx.db.query("recommendations").collect();
    const moduleVersionKeys = new Set(modules.map((m) => `${m.moduleId}-v${m.version}`));
    for (const r of allRecs) {
      const key = `${r.moduleId}-v${r.version}`;
      if (!moduleVersionKeys.has(key)) continue;
      if (r.deletedAt) continue;
      const existing = recCountsMap.get(key) ?? { total: 0, pending: 0, accepted: 0, rejected: 0 };
      existing.total += 1;
      if (r.reviewStatus === "pending") existing.pending += 1;
      if (r.reviewStatus === "accepted") existing.accepted += 1;
      if (r.reviewStatus === "rejected") existing.rejected += 1;
      recCountsMap.set(key, existing);
    }

    // Reviewer allocations — look up the first lead_reviewer per module
    const allPerms = await ctx.db.query("modulePermissions").collect();
    const now = Date.now();
    const activePerms = allPerms.filter((p) => !p.expiresAt || new Date(p.expiresAt).getTime() >= now);
    // Group by moduleId, keeping only "review" permission holders
    const reviewerIdByModule = new Map<string, Id<"users">>();
    for (const p of activePerms) {
      if (p.permissions.includes("review") && !reviewerIdByModule.has(p.moduleId)) {
        reviewerIdByModule.set(p.moduleId, p.userId);
      }
    }
    // Fetch reviewer names
    const reviewerNameByModule = new Map<string, string | null>();
    for (const entry of Array.from(reviewerIdByModule.entries())) {
      const [modId, userId] = entry;
      const u = await ctx.db.get(userId);
      reviewerNameByModule.set(modId, u?.name ?? u?.email ?? null);
    }

    void user; // used only for authz in getModulesForUser

    return modules.map((m) => ({
      _id: m._id,
      moduleId: m.moduleId,
      title: m.title,
      learningObjective: m.learningObjective,
      grade: m.grade,
      chapterNumber: m.chapterNumber ?? null,
      chapterName: m.chapterName ?? null,
      moduleNumber: m.moduleNumber ?? null,
      status: m.status,
      version: m.version,
      column: statusToColumn(m.status),
      overallScore: m.overallScore ?? null,
      overallPercentage: m.overallPercentage ?? null,
      scoreBand: m.scoreBand ?? null,
      spineComplete: m.spineComplete ?? false,
      totalApplets: m.totalApplets ?? 0,
      completedAppletReviews: m.completedAppletReviews ?? 0,
      submittedBy: m.submittedBy ?? null,
      submittedAt: m.submittedAt,
      updatedAt: m.updatedAt,
      completedAt: m.completedAt ?? null,
      recommendationCounts: recCountsMap.get(`${m.moduleId}-v${m.version}`) ?? null,
      corrections: correctionsMap.get(`${m.moduleId}-v${m.version}`) ?? null,
      reviewerName: reviewerNameByModule.get(m.moduleId) ?? null,
    }));
  },
});
