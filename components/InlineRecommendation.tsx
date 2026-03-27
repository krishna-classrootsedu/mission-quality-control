"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { OPERATION_TYPES, CONFIDENCE_LEVELS } from "@/lib/types";

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
  source?: string;
  agentName?: string;
};

type Decision = { status: string; comment: string };

const OP_BORDER_COLORS: Record<string, string> = {
  DELETE: "border-l-red-400",
  INSERT: "border-l-stone-400",
  EDIT: "border-l-stone-300",
  REPLACE: "border-l-stone-500",
  ADD: "border-l-stone-400",
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

  const isCustom = r.source === "reviewer";
  const isCorrectionsCheck = r.sourcePass === "corrections_check";
  const opKey = r.operationType.toUpperCase() as keyof typeof OPERATION_TYPES;
  const opConfig = OPERATION_TYPES[opKey] ?? { label: r.operationType, color: "gray" };
  const confKey = r.confidence.toLowerCase() as keyof typeof CONFIDENCE_LEVELS;
  const confConfig = CONFIDENCE_LEVELS[confKey] ?? { label: r.confidence, color: "gray" };

  const effectiveStatus = decision?.status ?? r.reviewStatus;
  const effectiveComment = decision?.comment ?? r.vinayComment ?? "";
  const isPending = r.reviewStatus === "pending";
  const hasUnsaved = !!decision;

  const cardBg = hasUnsaved
    ? "bg-stone-50/60"
    : effectiveStatus === "accepted"
      ? "bg-stone-50/30"
      : effectiveStatus === "rejected"
        ? "bg-red-50/20"
        : "bg-white";

  return (
    <div
      className={`border border-stone-200 rounded-lg border-l-2 ${isCorrectionsCheck ? "border-l-blue-400" : isCustom ? "border-l-stone-600" : OP_BORDER_COLORS[r.operationType.toUpperCase()] ?? "border-l-stone-300"} ${cardBg} transition-colors`}
    >
      {/* Header row */}
      <div
        className="px-3 py-2.5 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start gap-2">
          {/* Metadata line */}
          {isCorrectionsCheck ? (
            <span className="text-[11px] font-medium text-blue-500 shrink-0 mt-px flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-blue-400" />
              Verify &middot; {r.component}
            </span>
          ) : isCustom ? (
            <span className="text-[11px] font-medium text-stone-500 shrink-0 mt-px flex items-center gap-1.5">
              <span className="w-1 h-1 rounded-full bg-stone-500" />
              Custom &middot; {r.sourceAttribution ?? r.agentName}
            </span>
          ) : (
            <>
              <span className="text-[11px] font-mono text-stone-400 shrink-0 mt-px">
                [{r.quadrantId}] {opConfig.label}
                {r.pointsRecoverable != null && ` +${r.pointsRecoverable}pt`}
              </span>
              <span className="text-[11px] font-medium text-stone-400 shrink-0 mt-px">
                {confConfig.label.charAt(0)}
              </span>
            </>
          )}
        </div>

        {/* Issue text */}
        <p className={`text-[13px] text-stone-700 mt-1 ${expanded ? "" : "line-clamp-2"} leading-relaxed`}>
          {r.issue}
        </p>

        {/* Fix */}
        {(expanded || r.recommendedFix) && (
          <p className={`text-[13px] text-stone-500 mt-1.5 ${expanded ? "" : "line-clamp-1"} leading-relaxed`}>
            <span className="font-medium text-stone-400">Fix:</span> {r.recommendedFix}
          </p>
        )}
      </div>

      {/* Expanded details */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <div className="px-3 pb-2 border-t border-dashed border-stone-200/60 pt-2 space-y-2">
              {r.why && (
                <p className="text-[11px] text-stone-400 leading-relaxed">
                  <span className="font-medium">Why:</span> {r.why}
                </p>
              )}
              <div className="flex items-center gap-3 text-[11px] text-stone-400">
                <span>{r.sourcePass}</span>
                <span>&middot;</span>
                <span>{r.component}</span>
                {r.sourceAttribution && <><span>&middot;</span><span>{r.sourceAttribution}</span></>}
                {r.priority != null && <><span>&middot;</span><span>#{r.priority}</span></>}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Accept/Reject row — icon buttons instead of dropdown */}
      {isPending && (
        <div className="px-3 py-2 border-t border-stone-100 flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex gap-1">
            <button
              onClick={() => onDecisionChange(r._id, effectiveStatus === "accepted" ? "pending" : "accepted", effectiveComment)}
              className={`w-7 h-7 rounded flex items-center justify-center text-[13px] transition-all ${
                effectiveStatus === "accepted"
                  ? "bg-stone-800 text-white"
                  : "text-stone-300 hover:text-stone-600 hover:bg-stone-100"
              }`}
              title="Accept"
            >
              &#10003;
            </button>
            <button
              onClick={() => onDecisionChange(r._id, effectiveStatus === "rejected" ? "pending" : "rejected", effectiveComment)}
              className={`w-7 h-7 rounded flex items-center justify-center text-[13px] transition-all ${
                effectiveStatus === "rejected"
                  ? "bg-red-500 text-white"
                  : "text-stone-300 hover:text-red-500 hover:bg-red-50"
              }`}
              title="Reject"
            >
              &#10005;
            </button>
          </div>
          <div className="relative flex-1">
            <textarea
              value={effectiveComment}
              onChange={(e) => onDecisionChange(r._id, effectiveStatus, e.target.value)}
              placeholder={effectiveStatus === "rejected" ? "Required for reject..." : "Optional note..."}
              rows={1}
              className={`text-[13px] rounded-lg border px-2 py-1.5 w-full resize-none transition-colors pr-7 ${
                effectiveStatus === "rejected" && !effectiveComment
                  ? "border-red-200 bg-red-50/50"
                  : "border-stone-200 focus:border-stone-300 focus:ring-1 focus:ring-stone-200"
              }`}
            />
            {hasUnsaved && (
              <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-stone-400" title="Unsaved" />
            )}
          </div>
        </div>
      )}

      {/* Already decided */}
      {!isPending && (
        <div className="px-3 py-2 border-t border-stone-100 flex items-center gap-2">
          <span className={`text-[11px] font-medium px-2 py-0.5 rounded ${
            effectiveStatus === "accepted"
              ? "bg-stone-800 text-white"
              : "bg-red-50 text-red-600"
          }`}>
            {effectiveStatus === "accepted" ? "Accepted" : "Rejected"}
          </span>
          {r.vinayComment && <span className="text-[11px] text-stone-400">{r.vinayComment}</span>}
        </div>
      )}
    </div>
  );
}
