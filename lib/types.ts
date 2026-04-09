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
  "corrections_intake_complete",
  "corrections_review_complete",
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

// Board item (from getBoard / getTrackerData query)
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
  corrections_intake_complete: "Corrections Uploaded",
  corrections_review_complete: "Corrections Checked",
};

// ─── Tracker visual system ────────────────────────────────────────────────────

// Notion-style colors for board column stage pills in the Tracker
export type StageColor = {
  bg: string;
  text: string;
  dot: string;
  border: string;
};

export const BOARD_COLUMN_COLORS: Record<BoardColumn, StageColor> = {
  "Submitted":     { bg: "bg-slate-100",    text: "text-slate-700",    dot: "bg-slate-400",    border: "border-slate-200" },
  "Parsing":       { bg: "bg-sky-100",      text: "text-sky-700",      dot: "bg-sky-500",      border: "border-sky-200" },
  "Gate Check":    { bg: "bg-indigo-100",   text: "text-indigo-700",   dot: "bg-indigo-500",   border: "border-indigo-200" },
  "In Review":     { bg: "bg-violet-100",   text: "text-violet-700",   dot: "bg-violet-500",   border: "border-violet-200" },
  "Integration":   { bg: "bg-fuchsia-100",  text: "text-fuchsia-700",  dot: "bg-fuchsia-500",  border: "border-fuchsia-200" },
  "Vinay Review":  { bg: "bg-purple-100",   text: "text-purple-800",   dot: "bg-purple-600",   border: "border-purple-200" },
  "Creator Fix":   { bg: "bg-amber-100",    text: "text-amber-800",    dot: "bg-amber-500",    border: "border-amber-200" },
  "Ship-ready":    { bg: "bg-emerald-100",  text: "text-emerald-800",  dot: "bg-emerald-600",  border: "border-emerald-200" },
};

// Score band colors for tracker pills
export const BAND_PILL_COLORS: Record<string, StageColor> = {
  ship_ready:   { bg: "bg-emerald-100", text: "text-emerald-800", dot: "bg-emerald-500",  border: "border-emerald-200" },
  upgradeable:  { bg: "bg-amber-100",   text: "text-amber-800",   dot: "bg-amber-500",    border: "border-amber-200" },
  rework:       { bg: "bg-orange-100",  text: "text-orange-800",  dot: "bg-orange-500",   border: "border-orange-200" },
  redesign:     { bg: "bg-red-100",     text: "text-red-800",     dot: "bg-red-500",      border: "border-red-200" },
};

// 8-color palette for owner chips — deterministic so the same person is always the same color
const OWNER_CHIP_PALETTE = [
  { bg: "bg-rose-100",    text: "text-rose-800"    },
  { bg: "bg-orange-100",  text: "text-orange-800"  },
  { bg: "bg-lime-100",    text: "text-lime-800"    },
  { bg: "bg-teal-100",    text: "text-teal-800"    },
  { bg: "bg-sky-100",     text: "text-sky-800"     },
  { bg: "bg-violet-100",  text: "text-violet-800"  },
  { bg: "bg-pink-100",    text: "text-pink-800"    },
  { bg: "bg-stone-100",   text: "text-stone-700"   },
] as const;

export function ownerColorIndex(name: string): number {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return hash % OWNER_CHIP_PALETTE.length;
}

export function ownerChipColors(name: string): { bg: string; text: string } {
  return OWNER_CHIP_PALETTE[ownerColorIndex(name)];
}

// Human-readable label for a board column
export const BOARD_COLUMN_LABELS: Record<BoardColumn, string> = {
  "Submitted":    "Submitted",
  "Parsing":      "Parsing",
  "Gate Check":   "Gate Check",
  "In Review":    "In Review",
  "Integration":  "Integration",
  "Vinay Review": "Needs Vinay",
  "Creator Fix":  "Creator Fix",
  "Ship-ready":   "Ship-ready",
  
};
