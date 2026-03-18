"use client";

import { STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-slate-100 text-slate-600 border-slate-200",
  intake_complete: "bg-blue-50 text-blue-600 border-blue-200",
  intake_flagged: "bg-yellow-50 text-yellow-700 border-yellow-200",
  intake_failed: "bg-red-50 text-red-600 border-red-200",
  gatekeeper_pass: "bg-emerald-50 text-emerald-600 border-emerald-200",
  gatekeeper_fail: "bg-red-50 text-red-600 border-red-200",
  designer_reviewing: "bg-indigo-50 text-indigo-600 border-indigo-200",
  teacher_reviewing: "bg-indigo-50 text-indigo-600 border-indigo-200",
  student_reviewing: "bg-indigo-50 text-indigo-600 border-indigo-200",
  all_reviews_complete: "bg-cyan-50 text-cyan-600 border-cyan-200",
  review_complete: "bg-amber-50 text-amber-700 border-amber-200",
  vinay_reviewed: "bg-orange-50 text-orange-600 border-orange-200",
  creator_fixing: "bg-orange-50 text-orange-600 border-orange-200",
  ship_ready: "bg-emerald-50 text-emerald-700 border-emerald-200",
};

export default function StageBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-500 border-gray-200";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium border ${style}`}>
      {label}
    </span>
  );
}
