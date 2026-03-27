// Pipeline statuses
export const PIPELINE_STATUSES = [
  "submitted",
  "intake_complete",
  "intake_flagged",
  "intake_failed",
  "gatekeeper_pass",
  "gatekeeper_fail",
  "flow_mapped",
  "researched",
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

// Score bands (CRLDS: 90/75/50 thresholds)
export const SCORE_BANDS = {
  "ship_ready": { label: "Ship-ready", min: 90, color: "emerald" },
  "upgradeable": { label: "Upgradeable", min: 75, color: "amber" },
  "rework": { label: "Rework", min: 50, color: "orange" },
  "redesign": { label: "Redesign", min: 0, color: "red" },
} as const;

export type ScoreBand = keyof typeof SCORE_BANDS;

// Operation types (replaces directive types)
export const OPERATION_TYPES = {
  DELETE: { label: "Delete", color: "red" },
  INSERT: { label: "Insert", color: "blue" },
  EDIT: { label: "Edit", color: "gray" },
  REPLACE: { label: "Replace", color: "violet" },
  ADD: { label: "Add", color: "emerald" },
} as const;

export type OperationType = keyof typeof OPERATION_TYPES;

// Confidence levels
export const CONFIDENCE_LEVELS = {
  high: { label: "High", color: "emerald" },
  medium: { label: "Medium", color: "amber" },
  low: { label: "Low", color: "gray" },
} as const;

export type ConfidenceLevel = keyof typeof CONFIDENCE_LEVELS;

// 4-quadrant scoring system (CRLDS)
export const QUADRANTS = [
  { id: "P", name: "Pedagogy", maxPoints: 25 },
  { id: "D", name: "Design", maxPoints: 25 },
  { id: "X", name: "Experience", maxPoints: 25 },
  { id: "L", name: "Learning", maxPoints: 25 },
] as const;

export type QuadrantId = "P" | "D" | "X" | "L";

// Board item (from getBoard query)
export type ModuleBoardItem = {
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
  recommendationCounts: {
    total: number;
    pending: number;
    accepted: number;
    rejected: number;
  } | null;
};

// Column config — all neutral stone palette (quiet luxury: the label is enough differentiation)
export const COLUMN_CONFIG: Record<BoardColumn, { bg: string; border: string; headerBg: string; count: string }> = {
  "Submitted": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
  "Parsing": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
  "Gate Check": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
  "In Review": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
  "Integration": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
  "Vinay Review": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
  "Creator Fix": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
  "Ship-ready": { bg: "bg-stone-50", border: "border-stone-200", headerBg: "bg-stone-50", count: "text-stone-400" },
};

// Quadrant color mapping — subtle tonal differentiation with stone warmth
export const QUADRANT_COLORS: Record<string, { bg: string; text: string; border: string; accent: string }> = {
  P: { bg: "bg-stone-50", text: "text-stone-600", border: "border-stone-200", accent: "border-l-stone-400" },
  D: { bg: "bg-stone-50", text: "text-stone-600", border: "border-stone-200", accent: "border-l-stone-500" },
  X: { bg: "bg-stone-50", text: "text-stone-600", border: "border-stone-200", accent: "border-l-stone-300" },
  L: { bg: "bg-stone-50", text: "text-stone-600", border: "border-stone-200", accent: "border-l-stone-600" },
  GATE: { bg: "bg-red-50", text: "text-red-600", border: "border-red-200", accent: "border-l-red-400" },
};

// Map sourceFile labels (A1, A2) to component keys (applet_1, applet_2)
export function sourceFileToComponent(sourceFile: string): string {
  if (sourceFile === "spine") return "spine";
  const match = sourceFile.match(/^A(\d+)$/);
  return match ? `applet_${match[1]}` : sourceFile;
}

// Status display labels
export const STATUS_LABELS: Record<string, string> = {
  submitted: "Submitted",
  intake_complete: "Parsed",
  intake_flagged: "Flagged",
  intake_failed: "Parse Failed",
  gatekeeper_pass: "Gate Passed",
  gatekeeper_fail: "Gate Failed",
  flow_mapped: "Flow Mapped",
  researched: "Researched",
  all_reviews_complete: "Reviews Done",
  review_complete: "Awaiting Review",
  vinay_reviewed: "Reviewed",
  creator_fixing: "Creator Fixing",
  ship_ready: "Ship-ready",
};
