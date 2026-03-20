"use client";

import { motion } from "framer-motion";
import ScoreBandBadge from "./ScoreBandBadge";

type ReviewScoreRow = {
  reviewPass: string;
  totalPoints: number;
  maxPoints: number;
};

function getBand(pct: number): string {
  if (pct >= 90) return "ship_ready";
  if (pct >= 75) return "upgradeable";
  if (pct >= 50) return "rework";
  return "redesign";
}

export default function ComponentScoreSummary({
  overallScore,
  overallPercentage,
  scoreBand,
  reviewScores,
}: {
  overallScore: number | null;
  overallPercentage: number | null;
  scoreBand: string | null;
  reviewScores: ReviewScoreRow[];
}) {
  if (overallScore === null) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
        <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em] mb-2">Score Summary</h2>
        <p className="text-sm text-stone-300">Scoring not yet complete</p>
      </div>
    );
  }

  const spineScore = reviewScores.find((rs) => rs.reviewPass === "spine");
  const appletScores = reviewScores.filter((rs) => rs.reviewPass.startsWith("applet_"));

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5 space-y-4">
      <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Score Summary</h2>

      <div className="flex items-center gap-5">
        <div className="font-display text-5xl text-stone-900 tabular-nums tracking-tight">{overallPercentage}%</div>
        <div className="space-y-1.5">
          <ScoreBandBadge band={scoreBand} />
          <div className="text-[11px] text-stone-400 font-mono">{overallScore}/100 pts</div>
        </div>
      </div>

      {(spineScore || appletScores.length > 0) && (
        <div className="space-y-2">
          {spineScore && (
            <ComponentRow
              label="Spine"
              score={spineScore.totalPoints}
              max={spineScore.maxPoints}
            />
          )}
          {appletScores.map((a) => (
            <ComponentRow
              key={a.reviewPass}
              label={a.reviewPass.replace("applet_", "Applet ")}
              score={a.totalPoints}
              max={a.maxPoints}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function ComponentRow({ label, score, max }: { label: string; score: number; max: number }) {
  const pct = max > 0 ? Math.round((score / max) * 100) : 0;
  const band = getBand(pct);

  return (
    <div className="flex items-center gap-3">
      <span className="text-[11px] font-medium text-stone-600 w-20 shrink-0">{label}</span>
      <div className="flex-1">
        <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.6, ease: "easeOut" }}
            className="h-full rounded-full bg-stone-400"
          />
        </div>
      </div>
      <span className="text-[11px] font-mono text-stone-500 tabular-nums w-16 text-right">{score}/{max}</span>
      <ScoreBandBadge band={band} />
    </div>
  );
}
