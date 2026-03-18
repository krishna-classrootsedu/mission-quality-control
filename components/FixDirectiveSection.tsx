"use client";

import { useState, useCallback, useMemo, Fragment } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import FixDirectiveFilters from "./FixDirectiveFilters";
import FixDirectiveStickyBar from "./FixDirectiveStickyBar";

type FixDirective = {
  _id: Id<"fixDirectives">;
  directiveIndex: number;
  slideNumber?: number;
  issue: string;
  categoryId: string;
  recommendedFix: string;
  why?: string;
  severity: string;
  scoreImpact?: number;
  sourcePass: string;
  reviewStatus: string;
  vinayComment?: string;
  reviewedAt?: string;
  directiveType?: string;
  priority?: number;
};

type Filter = "all" | "tier1" | "tier2" | "pending" | "accepted" | "rejected";

export default function FixDirectiveSection({
  directives,
  moduleId,
  version,
}: {
  directives: FixDirective[];
  moduleId: string;
  version: number;
  slides?: unknown[];
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [decisions, setDecisions] = useState<
    Map<string, { status: string; comment: string }>
  >(new Map());
  const [saving, setSaving] = useState(false);

  const reviewMutation = useMutation(api.fixDirectives.review);
  const completeMutation = useMutation(api.fixDirectives.completeVinayReview);

  const filtered = useMemo(() => {
    return directives.filter((d) => {
      switch (filter) {
        case "tier1": return d.severity === "tier1";
        case "tier2": return d.severity === "tier2";
        case "pending": return d.reviewStatus === "pending";
        case "accepted": return d.reviewStatus === "accepted";
        case "rejected": return d.reviewStatus === "rejected";
        default: return true;
      }
    });
  }, [directives, filter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const sa = a.slideNumber ?? Infinity;
      const sb = b.slideNumber ?? Infinity;
      if (sa !== sb) return sa - sb;
      const pa = a.priority ?? Infinity;
      const pb = b.priority ?? Infinity;
      if (pa !== pb) return pa - pb;
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

  const pendingCount = directives.filter((d) => d.reviewStatus === "pending").length;
  // Only count decisions that are actually saveable (not still "pending")
  const saveableCount = Array.from(decisions.values()).filter((d) => d.status !== "pending").length;
  const needsDecisionCount = decisions.size - saveableCount; // typed comment but no accept/reject

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = new Map(decisions);
      for (const [id, decision] of Array.from(decisions)) {
        // Only save if user has made an actual decision (not still "pending")
        if (decision.status === "pending") continue;
        await reviewMutation({
          directiveId: id as Id<"fixDirectives">,
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

  const filters: { label: string; value: string; count: number }[] = [
    { label: "All", value: "all", count: directives.length },
    { label: "Tier 1", value: "tier1", count: directives.filter((d) => d.severity === "tier1").length },
    { label: "Tier 2", value: "tier2", count: directives.filter((d) => d.severity === "tier2").length },
    { label: "Pending", value: "pending", count: directives.filter((d) => d.reviewStatus === "pending").length },
    { label: "Accepted", value: "accepted", count: directives.filter((d) => d.reviewStatus === "accepted").length },
    { label: "Rejected", value: "rejected", count: directives.filter((d) => d.reviewStatus === "rejected").length },
  ];

  let lastSlide: number | undefined | null = -999;

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden flex flex-col" style={{ maxHeight: "calc(100vh - 180px)" }}>
      {/* Filters bar — fixed top */}
      <div className="px-5 py-3 border-b border-gray-100 bg-white shrink-0">
        <div className="flex items-center justify-between">
          <FixDirectiveFilters
            filters={filters}
            activeFilter={filter}
            onFilterChange={(v) => setFilter(v as Filter)}
          />
          <div className="text-[11px] text-gray-400 ml-4 shrink-0">
            Click any row to expand details
          </div>
        </div>
      </div>

      {/* Scrollable table area */}
      <div className="overflow-auto flex-1 min-h-0">
        <table className="w-full border-collapse">
          {/* Sticky header */}
          <thead className="sticky top-0 z-[5]">
            <tr className="bg-gray-50 border-b border-gray-200/80">
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[52px] bg-gray-50">
                Slide
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[64px] bg-gray-50">
                Type
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: "20%" }}>
                Issue
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: "20%" }}>
                Recommended Fix
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: "14%" }}>
                Why
              </th>
              <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[48px] bg-gray-50">
                Priority
              </th>
              <th className="text-center px-2 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider w-[90px] bg-gray-50">
                Decision
              </th>
              <th className="text-left px-3 py-2 text-[10px] font-semibold text-gray-500 uppercase tracking-wider bg-gray-50" style={{ width: "18%" }}>
                Comment
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((d) => {
              const isNewSlideGroup = d.slideNumber !== lastSlide;
              lastSlide = d.slideNumber;

              const localDecision = decisions.get(d._id);
              const effectiveStatus = localDecision?.status ?? d.reviewStatus;
              const effectiveComment = localDecision?.comment ?? d.vinayComment ?? "";
              const isPending = d.reviewStatus === "pending";
              const isExpanded = expandedId === d._id;
              const hasUnsaved = !!localDecision;

              // Row background
              const rowBg = hasUnsaved
                ? "bg-amber-50/40"
                : effectiveStatus === "accepted"
                  ? "bg-emerald-50/30"
                  : effectiveStatus === "rejected"
                    ? "bg-red-50/30"
                    : "";

              // Type styling
              const typeKey = d.directiveType?.toLowerCase() ?? "fix";
              const typeConfig: Record<string, { label: string; pillClass: string; borderClass: string }> = {
                insert: { label: "#insert", pillClass: "text-blue-600 bg-blue-50 border-blue-200", borderClass: "border-l-[3px] border-l-blue-400" },
                delete: { label: "#delete", pillClass: "text-red-600 bg-red-50 border-red-200", borderClass: "border-l-[3px] border-l-red-400" },
                fix: { label: "#fix", pillClass: "text-gray-500 bg-gray-50 border-gray-200", borderClass: "border-l-[3px] border-l-gray-300" },
              };
              const tc = typeConfig[typeKey] || typeConfig.fix;

              return (
                <Fragment key={d._id}>
                  {/* Slide group separator */}
                  {isNewSlideGroup && (
                    <tr><td colSpan={8} className="h-0"><div className="border-t border-gray-200/60" /></td></tr>
                  )}

                  {/* Main row */}
                  <tr
                    onClick={() => setExpandedId(isExpanded ? null : d._id)}
                    className={`cursor-pointer transition-colors hover:bg-gray-50/80 ${rowBg} ${tc.borderClass}`}
                  >
                    {/* Slide */}
                    <td className="px-3 py-2 text-xs font-mono text-gray-500 align-top">
                      {d.slideNumber ?? "N/A"}
                    </td>

                    {/* Type */}
                    <td className="px-3 py-2 align-top">
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border whitespace-nowrap ${tc.pillClass}`}>
                        {tc.label}
                      </span>
                    </td>

                    {/* Issue — truncated */}
                    <td className="px-3 py-2 text-xs text-gray-700 align-top">
                      <div className={isExpanded ? "" : "line-clamp-2 leading-relaxed"}>
                        {d.issue}
                      </div>
                    </td>

                    {/* Recommended Fix — truncated */}
                    <td className="px-3 py-2 text-xs text-gray-600 align-top">
                      <div className={isExpanded ? "leading-relaxed" : "line-clamp-2 leading-relaxed"}>
                        {d.recommendedFix}
                      </div>
                    </td>

                    {/* Why — truncated */}
                    <td className="px-3 py-2 text-xs text-gray-400 align-top">
                      <div className={isExpanded ? "leading-relaxed" : "line-clamp-2 leading-relaxed"}>
                        {d.why || "\u2014"}
                      </div>
                    </td>

                    {/* Priority */}
                    <td className="px-2 py-2 text-center align-top">
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-full ${
                        d.severity === "tier1"
                          ? "bg-red-50 text-red-600 border border-red-200"
                          : "bg-amber-50 text-amber-600 border border-amber-200"
                      }`}>
                        {d.severity === "tier1" ? "HIGH" : "MED"}
                      </span>
                    </td>

                    {/* Decision */}
                    <td className="px-2 py-2 text-center align-top" onClick={(e) => e.stopPropagation()}>
                      {isPending ? (
                        <select
                          value={effectiveStatus}
                          onChange={(e) => handleDecision(d._id, e.target.value, effectiveComment)}
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

                    {/* Comment with inline save indicator */}
                    <td className="px-3 py-2 align-top" onClick={(e) => e.stopPropagation()}>
                      {isPending ? (
                        <div className="relative">
                          <textarea
                            value={effectiveComment}
                            onChange={(e) => handleDecision(d._id, effectiveStatus, e.target.value)}
                            placeholder={effectiveStatus === "rejected" ? "Required for reject..." : "Optional note..."}
                            rows={1}
                            className={`text-xs rounded-md border px-2 py-1.5 w-full resize-none transition-colors pr-7 ${
                              effectiveStatus === "rejected" && !effectiveComment
                                ? "border-red-300 bg-red-50/50"
                                : "border-gray-200 focus:border-gray-300 focus:ring-1 focus:ring-gray-200"
                            }`}
                          />
                          {/* Unsaved dot indicator */}
                          {hasUnsaved && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-amber-400" title="Unsaved — click Save below" />
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 leading-relaxed">
                          {d.vinayComment || "\u2014"}
                        </span>
                      )}
                    </td>
                  </tr>

                  {/* Expanded detail row — source metadata */}
                  {isExpanded && (
                    <tr className={rowBg}>
                      <td colSpan={8} className="px-3 pb-3 pt-0">
                        <div className="flex items-center gap-4 pl-[52px] text-[10px] text-gray-400 py-1.5 border-t border-dashed border-gray-200/60">
                          <span>Source: <span className="font-medium text-gray-500 capitalize">{d.sourcePass}</span></span>
                          <span>Category: <span className="font-medium text-gray-500">{d.categoryId}</span></span>
                          {d.scoreImpact != null && <span>Impact: <span className="font-medium text-gray-500">+{d.scoreImpact} pts</span></span>}
                          {d.priority != null && <span>Priority: <span className="font-medium text-gray-500">#{d.priority}</span></span>}
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
          No directives match this filter
        </div>
      )}

      {/* Sticky save bar */}
      <FixDirectiveStickyBar
        unsavedCount={saveableCount}
        needsDecisionCount={needsDecisionCount}
        pendingCount={pendingCount}
        saving={saving}
        onSave={handleSave}
        onComplete={handleComplete}
      />
    </div>
  );
}
