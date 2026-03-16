"use client";

import { STATUS_LABELS } from "@/lib/types";

const STATUS_STYLES: Record<string, string> = {
  submitted: "bg-slate-100 text-slate-700",
  intake_complete: "bg-blue-100 text-blue-700",
  intake_flagged: "bg-yellow-100 text-yellow-700",
  intake_failed: "bg-red-100 text-red-700",
  gatekeeper_pass: "bg-green-100 text-green-700",
  gatekeeper_fail: "bg-red-100 text-red-700",
  designer_reviewing: "bg-indigo-100 text-indigo-700",
  teacher_reviewing: "bg-indigo-100 text-indigo-700",
  student_reviewing: "bg-indigo-100 text-indigo-700",
  all_reviews_complete: "bg-cyan-100 text-cyan-700",
  review_complete: "bg-amber-100 text-amber-700",
  vinay_reviewed: "bg-orange-100 text-orange-700",
  creator_fixing: "bg-orange-100 text-orange-700",
  ship_ready: "bg-emerald-100 text-emerald-700",
};

export default function StageBadge({ status }: { status: string }) {
  const style = STATUS_STYLES[status] ?? "bg-gray-100 text-gray-600";
  const label = STATUS_LABELS[status] ?? status;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${style}`}>
      {label}
    </span>
  );
}
