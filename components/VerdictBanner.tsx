"use client";

import ScoreBandBadge from "./ScoreBandBadge";
import { QUADRANTS } from "@/lib/types";

type QuadrantScore = {
  quadrantId: string;
  quadrantName: string;
  maxPoints: number;
  score: number;
};

function getBand(pct: number): string {
  if (pct >= 90) return "ship_ready";
  if (pct >= 75) return "upgradeable";
  if (pct >= 50) return "rework";
  return "redesign";
}

const BAND_BORDER: Record<string, string> = {
  ship_ready: "border-l-emerald-400",
  upgradeable: "border-l-amber-400",
  rework: "border-l-orange-400",
  redesign: "border-l-red-400",
};

export default function VerdictBanner({
  score,
  maxPoints,
  band,
  quadrantScores,
  componentLabel,
}: {
  score: number | null;
  maxPoints: number;
  band: string | null;
  quadrantScores: QuadrantScore[];
  componentLabel: string;
}) {
  if (score === null) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{componentLabel}</span>
        <p className="text-sm text-gray-300 mt-2">Scoring not complete</p>
      </div>
    );
  }

  const pct = maxPoints > 0 ? Math.round((score / maxPoints) * 100) : 0;
  const effectiveBand = band ?? getBand(pct);
  const borderColor = BAND_BORDER[effectiveBand] ?? "border-l-gray-300";

  return (
    <div className={`bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 border-l-4 ${borderColor}`}>
      <div className="flex items-center gap-5">
        {/* Score circle */}
        <div className="text-center">
          <div className="text-4xl font-bold text-gray-900 tabular-nums tracking-tight leading-none">{pct}%</div>
          <div className="text-[11px] text-gray-400 font-mono mt-1">{score}/{maxPoints} pts</div>
        </div>

        {/* Band + label */}
        <div className="space-y-1.5">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{componentLabel}</span>
          <div><ScoreBandBadge band={effectiveBand} /></div>
        </div>

        {/* Quadrant mini-bars */}
        <div className="ml-auto flex gap-3">
          {QUADRANTS.map((q) => {
            const data = quadrantScores.find((qs) => qs.quadrantId === q.id);
            const qScore = data?.score ?? 0;
            const qMax = data?.maxPoints ?? q.maxPoints;
            const qPct = qMax > 0 ? Math.round((qScore / qMax) * 100) : 0;
            const barColor = qPct >= 90 ? "bg-emerald-400" : qPct >= 75 ? "bg-amber-400" : qPct >= 50 ? "bg-orange-400" : "bg-red-400";

            return (
              <div key={q.id} className="text-center w-12">
                <span className="text-[10px] font-bold text-gray-400">{q.id}</span>
                <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-1">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${qPct}%` }} />
                </div>
                <span className="text-[10px] font-mono text-gray-400 mt-0.5">{qScore}/{qMax}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
