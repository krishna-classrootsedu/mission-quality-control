import { query } from "./_generated/server";
import { getModulesForUser } from "./lib/authz";

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
    const { modules } = await getModulesForUser(ctx);

    // For modules in Vinay Review, fetch recommendation counts
    const vinayModuleIds = modules
      .filter((m) => m.status === "review_complete" || m.status === "corrections_review_complete")
      .map((m) => ({ moduleId: m.moduleId, version: m.version }));

    const recCountsMap = new Map<string, { total: number; pending: number; accepted: number; rejected: number }>();

    for (const { moduleId, version } of vinayModuleIds) {
      const recs = await ctx.db
        .query("recommendations")
        .withIndex("by_moduleId_version", (q) =>
          q.eq("moduleId", moduleId).eq("version", version)
        )
        .collect();

      recCountsMap.set(`${moduleId}-v${version}`, {
        total: recs.length,
        pending: recs.filter((r) => r.reviewStatus === "pending").length,
        accepted: recs.filter((r) => r.reviewStatus === "accepted").length,
        rejected: recs.filter((r) => r.reviewStatus === "rejected").length,
      });
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
    }));
  },
});
