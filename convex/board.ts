import { query } from "./_generated/server";

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
  grade: string;
  status: string;
  version: number;
  column: BoardColumn;
  overallScore: number | null;
  overallPercentage: number | null;
  scoreBand: string | null;
  tier1AllPassed: boolean | null;
  designerComplete: boolean;
  teacherComplete: boolean;
  studentComplete: boolean;
  submittedBy: string | null;
  submittedAt: string;
  updatedAt: string;
  completedAt: string | null;
  // Directive counts for Vinay Review stage
  directiveCounts: { total: number; pending: number; accepted: number; rejected: number } | null;
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
      return "Gate Check";
    case "designer_reviewing":
    case "teacher_reviewing":
    case "student_reviewing":
      return "In Review";
    case "all_reviews_complete":
      return "Integration";
    case "review_complete":
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
    const modules = await ctx.db
      .query("modules")
      .withIndex("by_updatedAt")
      .order("desc")
      .take(200);

    // For modules in Vinay Review, fetch directive counts
    const vinayModuleIds = modules
      .filter((m) => m.status === "review_complete")
      .map((m) => ({ moduleId: m.moduleId, version: m.version }));

    const directiveCountsMap = new Map<string, { total: number; pending: number; accepted: number; rejected: number }>();

    for (const { moduleId, version } of vinayModuleIds) {
      const directives = await ctx.db
        .query("fixDirectives")
        .withIndex("by_moduleId_version", (q) =>
          q.eq("moduleId", moduleId).eq("version", version)
        )
        .collect();

      directiveCountsMap.set(`${moduleId}-v${version}`, {
        total: directives.length,
        pending: directives.filter((d) => d.reviewStatus === "pending").length,
        accepted: directives.filter((d) => d.reviewStatus === "accepted").length,
        rejected: directives.filter((d) => d.reviewStatus === "rejected").length,
      });
    }

    return modules.map((m) => ({
      _id: m._id,
      moduleId: m.moduleId,
      title: m.title,
      learningObjective: m.learningObjective,
      grade: m.grade,
      status: m.status,
      version: m.version,
      column: statusToColumn(m.status),
      overallScore: m.overallScore ?? null,
      overallPercentage: m.overallPercentage ?? null,
      scoreBand: m.scoreBand ?? null,
      tier1AllPassed: m.tier1AllPassed ?? null,
      designerComplete: m.designerComplete ?? false,
      teacherComplete: m.teacherComplete ?? false,
      studentComplete: m.studentComplete ?? false,
      submittedBy: m.submittedBy ?? null,
      submittedAt: m.submittedAt,
      updatedAt: m.updatedAt,
      completedAt: m.completedAt ?? null,
      directiveCounts: directiveCountsMap.get(`${m.moduleId}-v${m.version}`) ?? null,
    }));
  },
});
