"use client";

import { useState, useCallback, useMemo, Fragment } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { OPERATION_TYPES, CONFIDENCE_LEVELS } from "@/lib/types";

type Recommendation = {
  _id: Id<"recommendations">;
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
  reviewedAt?: string;
};

type Filter = "all" | "P" | "D" | "X" | "L" | "GATE" | "pending" | "accepted" | "rejected";

export default function RecommendationsSection({
  recommendations,
  moduleId,
  version,
}: {
  recommendations: Recommendation[];
  moduleId: string;
  version: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<Map<string, { status: string; comment: string }>>(new Map());
  const [saving, setSaving] = useState(false);

  const reviewMutation = useMutation(api.recommendations.review);
  const completeMutation = useMutation(api.recommendations.completeVinayReview);

  const filtered = useMemo(() => {
    return recommendations.filter((r) => {
      switch (filter) {
        case "P": case "D": case "X": case "L": case "GATE": return r.quadrantId === filter;
        case "pending": return r.reviewStatus === "pending";
        case "accepted": return r.reviewStatus === "accepted";
        case "rejected": return r.reviewStatus === "rejected";
        default: return true;
      }
    });
  }, [recommendations, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Sort by points recoverable descending
      const pa = a.pointsRecoverable ?? 0;
      const pb = b.pointsRecoverable ?? 0;
      if (pa !== pb) return pb - pa;
      const sa = a.slideNumber ?? Infinity;
      const sb = b.slideNumber ?? Infinity;
      if (sa !== sb) return sa - sb;
      return a.directiveIndex - b.directiveIndex;
    });
  }, [filtered]);

  const handleDecision = useCallback(
    (id: string, status: string, comment: string) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        next.set(id, { status, comment });
        return next;
      });
    },
    []
  );

  const pendingCount = recommendations.filter((r) => r.reviewStatus === "pending").length;
  const saveableCount = Array.from(decisions.values()).filter((d) => d.status !== "pending").length;
  const needsDecisionCount = decisions.size - saveableCount;

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = new Map(decisions);
      for (const [id, decision] of Array.from(decisions)) {
        if (decision.status === "pending") continue;
        await reviewMutation({
          recommendationId: id as Id<"recommendations">,
          reviewStatus: decision.status,
          vinayComment: decision.comment || undefined,
        });
        saved.delete(id);
      }
      setDecisions(saved);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    try {
      const result = await completeMutation({ moduleId, version });
      alert(`Review complete! ${result.accepted} accepted, ${result.rejected} rejected.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Complete failed");
    }
  };

  // Build filter tabs
  const allFilterItems: { label: string; value: Filter; count: number }[] = [
    { label: "All", value: "all" as Filter, count: recommendations.length },
    { label: "P", value: "P" as Filter, count: recommendations.filter((r) => r.quadrantId === "P").length },
    { label: "D", value: "D" as Filter, count: recommendations.filter((r) => r.quadrantId === "D").length },
    { label: "X", value: "X" as Filter, count: recommendations.filter((r) => r.quadrantId === "X").length },
    { label: "L", value: "L" as Filter, count: recommendations.filter((r) => r.quadrantId === "L").length },
    { label: "Gate", value: "GATE" as Filter, count: recommendations.filter((r) => r.quadrantId === "GATE").length },
    { label: "Pending", value: "pending" as Filter, count: recommendations.filter((r) => r.reviewStatus === "pending").length },
    { label: "Accepted", value: "accepted" as Filter, count: recommendations.filter((r) => r.reviewStatus === "accepted").length },
    { label: "Rejected", value: "rejected" as Filter, count: recommendations.filter((r) => r.reviewStatus === "rejected").length },
  ];
  const filterItems = allFilterItems.filter((f) => f.count > 0 || f.value === "all");

  let lastSlide: number | undefined | null = -999;

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 180px)" }}>
      {/* Filters bar */}
      <div className="px-5 py-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex gap-1.5 flex-wrap">
            {filterItems.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                  filter === f.value
                    ? "bg-gray-900 text-white shadow-sm"
                    : "bg-gray-100/80 text-gray-500 hover:bg-gray-200/80 hover:text-gray-700"
                }`}
              >
                {f.label}
                <span className={`ml-1.5 ${filter === f.value ? "text-gray-400" : "text-gray-400"}`}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Scrollable table area */}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse">
          <thead className="sticky top-0 z-[5]">
            <tr className="bg-gray-50 border-b border-gray-200/80">
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[52px] bg-gray-50">Slide</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[64px] bg-gray-50">Op</th>
              <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[44px] bg-gray-50">Conf</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50" style={{ width: "20%" }}>Issue</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50" style={{ width: "20%" }}>Recommended Fix</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50" style={{ width: "12%" }}>Why</th>
              <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[48px] bg-gray-50">Pts</th>
              <th className="text-center px-2 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[90px] bg-gray-50">Decision</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50" style={{ width: "16%" }}>Comment</th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((r) => {
              const isNewSlideGroup = r.slideNumber !== lastSlide;
              lastSlide = r.slideNumber;

              const localDecision = decisions.get(r._id);
              const effectiveStatus = localDecision?.status ?? r.reviewStatus;
              const effectiveComment = localDecision?.comment ?? r.vinayComment ?? "";
              const isPending = r.reviewStatus === "pending";
              const isExpanded = expandedId === r._id;
              const hasUnsaved = !!localDecision;

              const rowBg = hasUnsaved
                ? "bg-amber-50/40"
                : effectiveStatus === "accepted"
                  ? "bg-emerald-50/30"
                  : effectiveStatus === "rejected"
                    ? "bg-red-50/30"
                    : "";

              // Operation type styling
              const opKey = r.operationType.toUpperCase() as keyof typeof OPERATION_TYPES;
              const opConfig = OPERATION_TYPES[opKey] ?? { label: r.operationType, color: "gray" };
              const opColors: Record<string, string> = {
                red: "text-red-600 bg-red-50 border-red-200",
                blue: "text-blue-600 bg-blue-50 border-blue-200",
                gray: "text-gray-500 bg-gray-50 border-gray-200",
                violet: "text-violet-600 bg-violet-50 border-violet-200",
                emerald: "text-emerald-600 bg-emerald-50 border-emerald-200",
              };

              // Confidence styling
              const confKey = r.confidence.toLowerCase() as keyof typeof CONFIDENCE_LEVELS;
              const confConfig = CONFIDENCE_LEVELS[confKey] ?? { label: r.confidence, color: "gray" };
              const confColors: Record<string, string> = {
                emerald: "text-emerald-600",
                amber: "text-amber-600",
                gray: "text-gray-400",
              };

              // Border color by operation
              const borderColors: Record<string, string> = {
                DELETE: "border-l-[3px] border-l-red-400",
                INSERT: "border-l-[3px] border-l-blue-400",
                EDIT: "border-l-[3px] border-l-gray-300",
                REPLACE: "border-l-[3px] border-l-violet-400",
                ADD: "border-l-[3px] border-l-emerald-400",
              };

              return (
                <Fragment key={r._id}>
                  {isNewSlideGroup && (
                    <tr><td colSpan={9} className="h-0"><div className="border-t border-gray-200/60" /></td></tr>
                  )}

                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : r._id)}
                    className={`cursor-pointer transition-colors hover:bg-gray-50/80 ${rowBg} ${borderColors[r.operationType.toUpperCase()] ?? "border-l-[3px] border-l-gray-300"}`}
                  >
                    <td className="px-3 py-2 text-xs font-mono text-gray-500 align-top">
                      {r.slideNumber ?? "N/A"}
                    </td>
                    <td className="px-3 py-2 align-top">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${opColors[opConfig.color]}`}>
                        {opConfig.label}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center align-top">
                      <span className={`text-[10px] font-bold ${confColors[confConfig.color]}`}>
                        {confConfig.label.charAt(0)}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-700 align-top">
                      <div className={isExpanded ? "" : "line-clamp-2 leading-relaxed"}>{r.issue}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-600 align-top">
                      <div className={isExpanded ? "leading-relaxed" : "line-clamp-2 leading-relaxed"}>{r.recommendedFix}</div>
                    </td>
                    <td className="px-3 py-2 text-xs text-gray-400 align-top">
                      <div className={isExpanded ? "leading-relaxed" : "line-clamp-2 leading-relaxed"}>{r.why || "\u2014"}</div>
                    </td>
                    <td className="px-2 py-2 text-center align-top">
                      <span className="text-[11px] font-mono text-gray-500">
                        {r.pointsRecoverable != null ? `+${r.pointsRecoverable}` : "\u2014"}
                      </span>
                    </td>
                    <td className="px-2 py-2 text-center align-top" onClick={(e) => e.stopPropagation()}>
                      {isPending ? (
                        <select
                          value={effectiveStatus}
                          onChange={(e) => handleDecision(r._id, e.target.value, effectiveComment)}
                          className={`text-xs rounded-md border px-1.5 py-1 w-full font-medium transition-colors cursor-pointer ${
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
                      ) : (
                        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${
                          effectiveStatus === "accepted"
                            ? "bg-emerald-100 text-emerald-700"
                            : "bg-red-100 text-red-700"
                        }`}>
                          {effectiveStatus === "accepted" ? "Accepted" : "Rejected"}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                      {isPending ? (
                        <div className="relative">
                          <textarea
                            value={effectiveComment}
                            onChange={(e) => handleDecision(r._id, effectiveStatus, e.target.value)}
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
                      ) : (
                        <span className="text-xs text-gray-400 leading-relaxed">{r.vinayComment || "\u2014"}</span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {isExpanded && (
                    <tr className={rowBg}>
                      <td colSpan={9} className="px-3 pb-3 pt-0">
                        <div className="flex items-center gap-4 pl-[52px] text-[10px] text-gray-400 py-1.5 border-t border-dashed border-gray-200/60">
                          <span>Source: <span className="font-medium text-gray-500 capitalize">{r.sourcePass}</span></span>
                          <span>Quadrant: <span className="font-medium text-gray-500">{r.quadrantId}</span></span>
                          <span>Component: <span className="font-medium text-gray-500">{r.component}</span></span>
                          {r.sourceAttribution && <span>Attribution: <span className="font-medium text-gray-500">{r.sourceAttribution}</span></span>}
                          {r.priority != null && <span>Priority: <span className="font-medium text-gray-500">#{r.priority}</span></span>}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>

      {sorted.length === 0 && (
        <div className="text-center py-12 text-sm text-gray-400">
          No recommendations match this filter
        </div>
      )}

      {/* Sticky save bar */}
      <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/80 px-5 py-3.5 flex items-center justify-between shrink-0">
        <div className="text-xs text-gray-500 flex items-center gap-3">
          {saveableCount > 0 && (
            <span className="text-amber-600 font-medium">{saveableCount} ready to save</span>
          )}
          {needsDecisionCount > 0 && (
            <span className="text-orange-500 text-xs">
              {needsDecisionCount} {needsDecisionCount === 1 ? "row needs" : "rows need"} Accept/Reject before saving
            </span>
          )}
          {saveableCount === 0 && needsDecisionCount === 0 && pendingCount > 0 && (
            <span className="text-gray-400">{pendingCount} recommendations still pending</span>
          )}
          {saveableCount === 0 && needsDecisionCount === 0 && pendingCount === 0 && (
            <span className="text-emerald-600 font-medium">All recommendations reviewed</span>
          )}
        </div>
        <div className="flex gap-2.5">
          {saveableCount > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
            >
              {saving ? "Saving..." : `Save ${saveableCount} ${saveableCount === 1 ? "Decision" : "Decisions"}`}
            </button>
          )}
          {pendingCount === 0 && saveableCount === 0 && needsDecisionCount === 0 && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm"
            >
              Complete Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
