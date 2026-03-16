"use client";

import { useState, useCallback } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import FixDirectiveRow from "./FixDirectiveRow";

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
};

type Filter = "all" | "tier1" | "tier2" | "pending" | "accepted" | "rejected";

export default function FixDirectiveTable({
  directives,
  moduleId,
  version,
}: {
  directives: FixDirective[];
  moduleId: string;
  version: number;
}) {
  const [filter, setFilter] = useState<Filter>("all");
  const [decisions, setDecisions] = useState<Map<string, { status: string; comment: string }>>(new Map());
  const [saving, setSaving] = useState(false);

  const reviewMutation = useMutation(api.fixDirectives.review);
  const completeMutation = useMutation(api.fixDirectives.completeVinayReview);

  // Filter directives
  const filtered = directives.filter((d) => {
    switch (filter) {
      case "tier1": return d.severity === "tier1";
      case "tier2": return d.severity === "tier2";
      case "pending": return d.reviewStatus === "pending";
      case "accepted": return d.reviewStatus === "accepted";
      case "rejected": return d.reviewStatus === "rejected";
      default: return true;
    }
  });

  const handleDecision = useCallback((id: string, status: string, comment: string) => {
    setDecisions((prev) => {
      const next = new Map(prev);
      next.set(id, { status, comment });
      return next;
    });
  }, []);

  const pendingCount = directives.filter((d) => d.reviewStatus === "pending").length;
  const decidedCount = decisions.size;
  const totalPending = pendingCount;

  const handleSave = async () => {
    setSaving(true);
    try {
      // Save each decision
      for (const [id, decision] of Array.from(decisions)) {
        await reviewMutation({
          directiveId: id as Id<"fixDirectives">,
          reviewStatus: decision.status,
          vinayComment: decision.comment || undefined,
        });
      }
      setDecisions(new Map());
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

  const filters: { label: string; value: Filter; count: number }[] = [
    { label: "All", value: "all", count: directives.length },
    { label: "Tier 1", value: "tier1", count: directives.filter((d) => d.severity === "tier1").length },
    { label: "Tier 2", value: "tier2", count: directives.filter((d) => d.severity === "tier2").length },
    { label: "Pending", value: "pending", count: directives.filter((d) => d.reviewStatus === "pending").length },
    { label: "Accepted", value: "accepted", count: directives.filter((d) => d.reviewStatus === "accepted").length },
    { label: "Rejected", value: "rejected", count: directives.filter((d) => d.reviewStatus === "rejected").length },
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200">
      {/* Header + filters */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold text-gray-500">
            Fix Directives ({directives.length})
          </h2>
        </div>
        <div className="flex gap-2 flex-wrap">
          {filters.map((f) => (
            <button
              key={f.value}
              onClick={() => setFilter(f.value)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${
                filter === f.value
                  ? "bg-gray-900 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {f.label} ({f.count})
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-16">Slide</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Issue</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-16">Cat</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500">Fix</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-64">Why</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">Severity</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-20">Impact</th>
              <th className="text-center px-3 py-2 text-xs font-semibold text-gray-500 w-28">Decision</th>
              <th className="text-left px-3 py-2 text-xs font-semibold text-gray-500 w-48">Comment</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filtered.map((d) => (
              <FixDirectiveRow
                key={d._id}
                directive={d}
                localDecision={decisions.get(d._id)}
                onDecision={handleDecision}
              />
            ))}
          </tbody>
        </table>
      </div>

      {filtered.length === 0 && (
        <div className="text-center py-8 text-sm text-gray-400">
          No directives match this filter
        </div>
      )}

      {/* Sticky save bar */}
      <div className="sticky bottom-0 bg-white border-t border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="text-sm text-gray-500">
          {decidedCount > 0 && (
            <span className="text-amber-600 font-medium">{decidedCount} unsaved decisions</span>
          )}
          {decidedCount === 0 && totalPending > 0 && (
            <span>{totalPending} directives still pending</span>
          )}
          {decidedCount === 0 && totalPending === 0 && (
            <span className="text-emerald-600">All directives reviewed</span>
          )}
        </div>
        <div className="flex gap-2">
          {decidedCount > 0 && (
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50"
            >
              {saving ? "Saving..." : `Save ${decidedCount} Decisions`}
            </button>
          )}
          {totalPending === 0 && decidedCount === 0 && (
            <button
              onClick={handleComplete}
              className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700"
            >
              Complete Review
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
