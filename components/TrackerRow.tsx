"use client";

import Link from "next/link";
import { ModuleBoardItem, BAND_PILL_COLORS } from "@/lib/types";
import StagePill from "./StagePill";
import OwnerChip from "./OwnerChip";

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d`;
  const months = Math.floor(days / 30);
  return `${months}mo`;
}

function ScoreCell({ item }: { item: ModuleBoardItem }) {
  if (item.corrections && item.corrections.totalRecs > 0) {
    return (
      <span className="inline-flex items-center gap-1">
        <span className="font-display text-base text-stone-400 leading-none">{item.corrections.previousScore}%</span>
        <span className="text-stone-300 text-xs">→</span>
        <span className="font-display text-lg text-stone-900 leading-none">{item.corrections.projectedScore}%</span>
      </span>
    );
  }
  if (item.overallPercentage != null) {
    return (
      <span className="font-display text-lg text-stone-900 leading-none">
        {item.overallPercentage}%
      </span>
    );
  }
  return <span className="text-stone-300 text-base">—</span>;
}

function BandPill({ band }: { band: string | null }) {
  if (!band) return <span className="text-stone-300 text-sm">—</span>;
  const colors = BAND_PILL_COLORS[band];
  if (!colors) return <span className="text-stone-400 text-[11px]">{band}</span>;

  const labels: Record<string, string> = {
    ship_ready: "Ship-ready",
    upgradeable: "Upgradeable",
    rework: "Rework",
    redesign: "Redesign",
  };

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors.bg} ${colors.text} ${colors.border} whitespace-nowrap`}>
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
      {labels[band] ?? band}
    </span>
  );
}

function OpenRecsCell({ item }: { item: ModuleBoardItem }) {
  const pending = item.recommendationCounts?.pending ?? 0;
  const total = item.recommendationCounts?.total ?? 0;
  if (total === 0) return <span className="text-stone-300 text-sm">—</span>;
  if (pending === 0) {
    return <span className="text-[12px] text-emerald-700 font-medium">All reviewed</span>;
  }
  return (
    <span className="text-[12px] font-medium text-stone-600">
      {pending}
      <span className="text-stone-400 font-normal">/{total}</span>
    </span>
  );
}

interface TrackerRowProps {
  item: ModuleBoardItem;
}

export default function TrackerRow({ item }: TrackerRowProps) {
  return (
    <Link href={`/module/${item.moduleId}`} className="block group">
      <div className="grid tracker-row-grid items-center px-4 py-3 hover:bg-stone-50 hover:shadow-[inset_3px_0_0_#44403c] transition-all border-b border-stone-100/50 last:border-b-0 cursor-pointer">
        {/* Mod # */}
        <div className="text-[12px] font-mono font-medium text-stone-600 whitespace-nowrap">
          {item.moduleNumber != null ? `M${item.moduleNumber}` : "—"}
        </div>

        {/* Title */}
        <div className="min-w-0 pr-4">
          <span className="text-[13px] text-stone-800 font-medium leading-snug line-clamp-1 group-hover:text-stone-900 transition-colors">
            {item.title}
          </span>
        </div>

        {/* Creator */}
        <div>
          <OwnerChip name={item.submittedBy} />
        </div>

        {/* Reviewer */}
        <div>
          <OwnerChip name={item.reviewerName ?? null} />
        </div>

        {/* Stage */}
        <div>
          <StagePill column={item.column} />
        </div>

        {/* Score */}
        <div className="text-right">
          <ScoreCell item={item} />
        </div>

        {/* Band */}
        <div>
          <BandPill band={item.scoreBand} />
        </div>

        {/* Version */}
        <div className="text-[11px] font-mono text-stone-400 whitespace-nowrap">
          v{item.version}
        </div>

        {/* Open recs */}
        <div className="text-right">
          <OpenRecsCell item={item} />
        </div>

        {/* Last updated */}
        <div className="text-[11px] text-stone-400 text-right whitespace-nowrap">
          {timeAgo(item.updatedAt)}
        </div>

        {/* Arrow */}
        <div className="flex justify-end">
          <svg
            className="w-3.5 h-3.5 text-stone-300 group-hover:text-stone-500 transition-colors"
            fill="none"
            viewBox="0 0 16 16"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 8h10M9 4l4 4-4 4" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
