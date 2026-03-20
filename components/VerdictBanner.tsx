"use client";

import { motion } from "framer-motion";
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
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">{componentLabel}</span>
        <p className="text-sm text-stone-300 mt-2">Scoring not complete</p>
      </div>
    );
  }

  const pct = maxPoints > 0 ? Math.round((score / maxPoints) * 100) : 0;
  const effectiveBand = band ?? getBand(pct);

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
      <div className="flex items-center gap-5">
        <div className="text-center">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em] block mb-1">{componentLabel}</span>
          <div className="font-display text-5xl text-stone-900 leading-none">
            {pct}<span className="text-3xl">%</span>
          </div>
          <div className="text-[11px] text-stone-400 font-mono mt-1">{score}/{maxPoints} pts</div>
        </div>

        <div className="space-y-1.5">
          <ScoreBandBadge band={effectiveBand} />
        </div>

        <div className="ml-auto flex gap-3">
          {QUADRANTS.map((q) => {
            const data = quadrantScores.find((qs) => qs.quadrantId === q.id);
            const qScore = data?.score ?? 0;
            const qMax = data?.maxPoints ?? q.maxPoints;
            const qPct = qMax > 0 ? Math.round((qScore / qMax) * 100) : 0;

            return (
              <div key={q.id} className="text-center w-12">
                <span className="text-[11px] font-bold text-stone-400">{q.id}</span>
                <div className="w-full h-1.5 bg-stone-100 rounded-full overflow-hidden mt-1">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${qPct}%` }}
                    transition={{ duration: 0.6, ease: "easeOut" }}
                    className="h-full rounded-full bg-stone-400"
                  />
                </div>
                <span className="text-[11px] font-mono text-stone-400 mt-0.5">{qScore}/{qMax}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
