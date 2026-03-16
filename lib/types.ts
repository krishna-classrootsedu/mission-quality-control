// Pipeline statuses
export const PIPELINE_STATUSES = [
  "submitted",
  "intake_complete",
  "intake_flagged",
  "intake_failed",
  "gatekeeper_pass",
  "gatekeeper_fail",
  "designer_reviewing",
  "teacher_reviewing",
  "student_reviewing",
  "all_reviews_complete",
  "review_complete",
  "vinay_reviewed",
  "creator_fixing",
  "ship_ready",
] as const;

export type PipelineStatus = (typeof PIPELINE_STATUSES)[number];

// Board columns
export const BOARD_COLUMNS = [
  "Submitted",
  "Parsing",
  "Gate Check",
  "In Review",
  "Integration",
  "Vinay Review",
  "Creator Fix",
  "Ship-ready",
] as const;

export type BoardColumn = (typeof BOARD_COLUMNS)[number];

// Score bands
export const SCORE_BANDS = {
  "ship_ready": { label: "Ship-ready", min: 85, color: "emerald" },
  "upgradeable": { label: "Upgradeable", min: 70, color: "amber" },
  "re_architect": { label: "Re-architect", min: 50, color: "orange" },
  "reframe": { label: "Reframe from LO", min: 0, color: "red" },
} as const;

export type ScoreBand = keyof typeof SCORE_BANDS;

// Board item (from getBoard query)
export type ModuleBoardItem = {
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
  directiveCounts: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  } | null;
};

// 12 review categories
export const CATEGORIES = [
  { id: "A", name: "Activity Design & Engagement", maxPoints: 12, tier: "tier1", hat: "designer" },
  { id: "B", name: "Visual Design & Layout", maxPoints: 12, tier: "tier1", hat: "designer" },
  { id: "C", name: "Content Accuracy & Depth", maxPoints: 10, tier: "tier1", hat: "teacher" },
  { id: "D", name: "Differentiation & Scaffolding", maxPoints: 10, tier: "tier1", hat: "teacher" },
  { id: "E", name: "Student Experience & Flow", maxPoints: 10, tier: "tier2", hat: "student" },
  { id: "F", name: "Fun & Motivation", maxPoints: 10, tier: "tier2", hat: "student" },
  { id: "G", name: "Gamification & Rewards", maxPoints: 10, tier: "tier1", hat: "designer" },
  { id: "H", name: "Hints & Help System", maxPoints: 10, tier: "tier2", hat: "student" },
  { id: "J", name: "Journey & Progression", maxPoints: 10, tier: "tier2", hat: "designer" },
  { id: "K", name: "Knowledge Check & Assessment", maxPoints: 8, tier: "tier1", hat: "teacher" },
  { id: "T", name: "Teacher Notes & Guidance", maxPoints: 8, tier: "tier1", hat: "teacher" },
  { id: "V", name: "Voice & Tone", maxPoints: 10, tier: "tier1", hat: "designer" },
] as const;

// Column config for color styling
export const COLUMN_CONFIG: Record<BoardColumn, { bg: string; border: string; headerBg: string; count: string }> = {
  "Submitted": { bg: "bg-slate-50", border: "border-slate-200", headerBg: "bg-slate-100", count: "bg-slate-200 text-slate-700" },
  "Parsing": { bg: "bg-blue-50", border: "border-blue-200", headerBg: "bg-blue-100", count: "bg-blue-200 text-blue-700" },
  "Gate Check": { bg: "bg-violet-50", border: "border-violet-200", headerBg: "bg-violet-100", count: "bg-violet-200 text-violet-700" },
  "In Review": { bg: "bg-indigo-50", border: "border-indigo-200", headerBg: "bg-indigo-100", count: "bg-indigo-200 text-indigo-700" },
  "Integration": { bg: "bg-cyan-50", border: "border-cyan-200", headerBg: "bg-cyan-100", count: "bg-cyan-200 text-cyan-700" },
  "Vinay Review": { bg: "bg-amber-50", border: "border-amber-200", headerBg: "bg-amber-100", count: "bg-amber-200 text-amber-700" },
  "Creator Fix": { bg: "bg-orange-50", border: "border-orange-200", headerBg: "bg-orange-100", count: "bg-orange-200 text-orange-700" },
  "Ship-ready": { bg: "bg-emerald-50", border: "border-emerald-200", headerBg: "bg-emerald-100", count: "bg-emerald-200 text-emerald-700" },
};

// Status display labels
export const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  intake_complete: "Parsed",
  intake_flagged: "Flagged",
  intake_failed: "Parse Failed",
  gatekeeper_pass: "Gate Passed",
  gatekeeper_fail: "Gate Failed",
  designer_reviewing: "Designer Review",
  teacher_reviewing: "Teacher Review",
  student_reviewing: "Student Review",
  all_reviews_complete: "Reviews Done",
  review_complete: "Awaiting Review",
  vinay_reviewed: "Reviewed",
  creator_fixing: "Creator Fixing",
  ship_ready: "Ship-ready",
};
