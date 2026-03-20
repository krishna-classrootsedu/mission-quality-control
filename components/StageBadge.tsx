"use client";

import { STATUS_LABELS } from "@/lib/types";

const TERMINAL_STATUSES = new Set(["ship_ready"]);
const ERROR_STATUSES = new Set(["gatekeeper_fail", "intake_failed", "intake_flagged"]);

export default function StageBadge({ status }: { status: string }) {
  const label = STATUS_LABELS[status] ?? status;

  const style = ERROR_STATUSES.has(status)
    ? "bg-red-50 text-red-600 border-red-200"
    : TERMINAL_STATUSES.has(status)
      ? "bg-stone-800 text-white border-stone-800"
      : "bg-stone-100 text-stone-600 border-stone-200";

  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium border ${style}`}>
      {label}
    </span>
  );
}
