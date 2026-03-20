"use client";

import { useState } from "react";
import { OPERATION_TYPES, CONFIDENCE_LEVELS, QUADRANT_COLORS } from "@/lib/types";

type Recommendation = {
  _id: string;
  directiveIndex: number;
  slideNumber?: number;
  issue: string;
  quadrantId: string;
  recommendedFix: string;
  why?: string;
  operationType: string;
  confidence: string;
  sourceAttribution?: string;
  component: string;
  pointsRecoverable?: number;
  sourcePass: string;
  priority?: number;
  reviewStatus: string;
  vinayComment?: string;
};

type Decision = { status: string; comment: string };

const OP_BORDER_COLORS: Record<string, string> = {
  DELETE: "border-l-red-400",
  INSERT: "border-l-blue-400",
  EDIT: "border-l-gray-300",
  REPLACE: "border-l-violet-400",
  ADD: "border-l-emerald-400",
};

const OP_PILL_COLORS: Record<string, string> = {
  red: "text-red-600 bg-red-50 border-red-200",
  blue: "text-blue-600 bg-blue-50 border-blue-200",
  gray: "text-gray-500 bg-gray-50 border-gray-200",
  violet: "text-violet-600 bg-violet-50 border-violet-200",
  emerald: "text-emerald-600 bg-emerald-50 border-emerald-200",
};

const CONF_COLORS: Record<string, string> = {
  emerald: "text-emerald-600",
  amber: "text-amber-600",
  gray: "text-gray-400",
};

export default function InlineRecommendation({
  recommendation: r,
  decision,
  onDecisionChange,
}: {
  recommendation: Recommendation;
  decision?: Decision;
  onDecisionChange: (id: string, status: string, comment: string) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  const opKey = r.operationType.toUpperCase() as keyof typeof OPERATION_TYPES;
  const opConfig = OPERATION_TYPES[opKey] ?? { label: r.operationType, color: "gray" };
  const confKey = r.confidence.toLowerCase() as keyof typeof CONFIDENCE_LEVELS;
  const confConfig = CONFIDENCE_LEVELS[confKey] ?? { label: r.confidence, color: "gray" };
  const qColors = QUADRANT_COLORS[r.quadrantId] ?? QUADRANT_COLORS.P;

  const effectiveStatus = decision?.status ?? r.reviewStatus;
  const effectiveComment = decision?.comment ?? r.vinayComment ?? "";
  const isPending = r.reviewStatus === "pending";
  const hasUnsaved = !!decision;

  const cardBg = hasUnsaved
    ? "bg-amber-50/40"
    : effectiveStatus === "accepted"
      ? "bg-emerald-50/30"
      : effectiveStatus === "rejected"
        ? "bg-red-50/30"
        : "bg-white";

  return (
    <div
      className={`border border-gray-200/80 rounded-lg border-l-[3px] ${OP_BORDER_COLORS[r.operationType.toUpperCase()] ?? "border-l-gray-300"} ${cardBg} transition-colors`}
    >
      {/* Header row */}
      <div
        className="px-3 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2">
          {/* Quadrant pill */}
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${qColors.bg} ${qColors.text} ${qColors.border} border shrink-0`}>
            {r.quadrantId}
          </span>
          {/* Operation pill */}
          <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap shrink-0 ${OP_PILL_COLORS[opConfig.color]}`}>
            {opConfig.label}
          </span>
          {/* Confidence */}
          <span className={`text-[10px] font-bold shrink-0 ${CONF_COLORS[confConfig.color]}`}>
            {confConfig.label.charAt(0)}
          </span>
          {/* Points */}
          {r.pointsRecoverable != null && (
            <span className="text-[10px] font-mono text-emerald-600 shrink-0">+{r.pointsRecoverable}pt</span>
          )}
          {/* Issue text */}
          <p className={`text-xs text-gray-700 flex-1 min-w-0 ${expanded ? "" : "line-clamp-2"} leading-relaxed`}>
            {r.issue}
          </p>
        </div>

        {/* Fix */}
        {(expanded || r.recommendedFix) && (
          <div className="mt-1.5 pl-[4px]">
            <p className={`text-xs text-gray-500 ${expanded ? "" : "line-clamp-1"} leading-relaxed`}>
              <span className="font-medium text-gray-400">Fix:</span> {r.recommendedFix}
            </p>
          </div>
        )}
      </div>

      {/* Expanded details */}
      {expanded && (
        <div className="px-3 pb-2 border-t border-dashed border-gray-200/60 pt-2 space-y-2">
          {r.why && (
            <p className="text-[11px] text-gray-400 leading-relaxed">
              <span className="font-medium">Why:</span> {r.why}
            </p>
          )}
          <div className="flex items-center gap-4 text-[10px] text-gray-400">
            <span>Source: <span className="font-medium text-gray-500 capitalize">{r.sourcePass}</span></span>
            <span>Component: <span className="font-medium text-gray-500">{r.component}</span></span>
            {r.sourceAttribution && <span>Attribution: <span className="font-medium text-gray-500">{r.sourceAttribution}</span></span>}
            {r.priority != null && <span>Priority: <span className="font-medium text-gray-500">#{r.priority}</span></span>}
          </div>
        </div>
      )}

      {/* Accept/Reject row */}
      {isPending && (
        <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <select
            value={effectiveStatus}
            onChange={(e) => onDecisionChange(r._id, e.target.value, effectiveComment)}
            className={`text-xs rounded-md border px-1.5 py-1 font-medium transition-colors cursor-pointer ${
              effectiveStatus === "accepted"
                ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                : effectiveStatus === "rejected"
                  ? "border-red-300 bg-red-50 text-red-700"
                  : "border-gray-200 bg-white text-gray-600"
            }`}
          >
            <option value="pending">Pending</option>
            <option value="accepted">Accept</option>
            <option value="rejected">Reject</option>
          </select>
          <div className="relative flex-1">
            <textarea
              value={effectiveComment}
              onChange={(e) => onDecisionChange(r._id, effectiveStatus, e.target.value)}
              placeholder={effectiveStatus === "rejected" ? "Required for reject..." : "Optional note..."}
              rows={1}
              className={`text-xs rounded-md border px-2 py-1.5 w-full resize-none transition-colors pr-7 ${
                effectiveStatus === "rejected" && !effectiveComment
                  ? "border-red-300 bg-red-50/50"
                  : "border-gray-200 focus:border-gray-300 focus:ring-1 focus:ring-gray-200"
              }`}
            />
            {hasUnsaved && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" title="Unsaved" />
            )}
          </div>
        </div>
      )}

      {/* Already decided */}
      {!isPending && (
        <div className="px-3 py-2 border-t border-gray-100 flex items-center gap-2">
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
            effectiveStatus === "accepted"
              ? "bg-emerald-100 text-emerald-700"
              : "bg-red-100 text-red-700"
          }`}>
            {effectiveStatus === "accepted" ? "Accepted" : "Rejected"}
          </span>
          {r.vinayComment && <span className="text-xs text-gray-400">{r.vinayComment}</span>}
        </div>
      )}
    </div>
  );
}
