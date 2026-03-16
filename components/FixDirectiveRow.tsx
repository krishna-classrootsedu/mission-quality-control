"use client";

import { memo } from "react";
import type { Id } from "@/convex/_generated/dataModel";

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
};

type LocalDecision = { status: string; comment: string } | undefined;

const ROW_BG: Record<string, string> = {
  accepted: "bg-emerald-50",
  rejected: "bg-red-50",
  pending: "",
};

const FixDirectiveRow = memo(function FixDirectiveRow({
  directive,
  localDecision,
  onDecision,
}: {
  directive: FixDirective;
  localDecision: LocalDecision;
  onDecision: (id: string, status: string, comment: string) => void;
}) {
  const effectiveStatus = localDecision?.status ?? directive.reviewStatus;
  const effectiveComment = localDecision?.comment ?? directive.vinayComment ?? "";
  const isDecided = effectiveStatus !== "pending";
  const bgClass = localDecision ? "bg-amber-50/50" : ROW_BG[directive.reviewStatus] ?? "";

  return (
    <tr className={bgClass}>
      <td className="px-3 py-2 text-xs text-gray-500 font-mono">
        {directive.slideNumber ?? "—"}
      </td>
      <td className="px-3 py-2 text-xs text-gray-700 max-w-xs">
        <div className="line-clamp-3">{directive.issue}</div>
      </td>
      <td className="px-3 py-2">
        <span className="text-xs font-bold text-gray-600">{directive.categoryId}</span>
      </td>
      <td className="px-3 py-2 text-xs text-gray-700 max-w-sm">
        <div className="line-clamp-3">{directive.recommendedFix}</div>
      </td>
      <td className="px-3 py-2 text-xs text-gray-500 max-w-xs">
        <div className="line-clamp-2">{directive.why ?? "—"}</div>
      </td>
      <td className="px-3 py-2 text-center">
        <span className={`text-xs font-medium px-2 py-0.5 rounded ${
          directive.severity === "tier1" ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"
        }`}>
          {directive.severity === "tier1" ? "T1" : "T2"}
        </span>
      </td>
      <td className="px-3 py-2 text-center text-xs text-gray-500">
        {directive.scoreImpact ? `+${directive.scoreImpact}` : "—"}
      </td>
      <td className="px-3 py-2">
        <select
          value={effectiveStatus}
          onChange={(e) => onDecision(directive._id, e.target.value, effectiveComment)}
          disabled={directive.reviewStatus !== "pending"}
          className={`text-xs rounded border px-2 py-1 w-full ${
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
      </td>
      <td className="px-3 py-2">
        {directive.reviewStatus === "pending" ? (
          <textarea
            value={effectiveComment}
            onChange={(e) => onDecision(directive._id, effectiveStatus, e.target.value)}
            placeholder={effectiveStatus === "rejected" ? "Required for reject..." : "Optional..."}
            rows={1}
            className={`text-xs rounded border px-2 py-1 w-full resize-none ${
              effectiveStatus === "rejected" && !effectiveComment
                ? "border-red-300 bg-red-50"
                : "border-gray-200"
            }`}
          />
        ) : (
          <span className="text-xs text-gray-500">{directive.vinayComment || "—"}</span>
        )}
      </td>
    </tr>
  );
});

export default FixDirectiveRow;
