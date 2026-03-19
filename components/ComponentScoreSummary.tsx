"use client";

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
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Score Summary</h2>
        <p className="text-sm text-gray-300">Scoring not yet complete</p>
      </div>
    );
  }

  const spineScore = reviewScores.find((rs) => rs.reviewPass === "spine");
  const appletScores = reviewScores.filter((rs) => rs.reviewPass.startsWith("applet_"));

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-4">
      <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Score Summary</h2>

      {/* Overall */}
      <div className="flex items-center gap-5">
        <div className="text-5xl font-bold text-gray-900 tabular-nums tracking-tight">{overallPercentage}%</div>
        <div className="space-y-1.5">
          <ScoreBandBadge band={scoreBand} />
          <div className="text-xs text-gray-400 font-mono">{overallScore}/100 pts</div>
        </div>
      </div>

      {/* Per-component breakdown */}
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
  const barColor = pct >= 90 ? "bg-emerald-400" : pct >= 75 ? "bg-amber-400" : pct >= 50 ? "bg-orange-400" : "bg-red-400";

  return (
    <div className="flex items-center gap-3">
      <span className="text-xs font-medium text-gray-600 w-20 shrink-0">{label}</span>
      <div className="flex-1">
        <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
        </div>
      </div>
      <span className="text-xs font-mono text-gray-500 tabular-nums w-16 text-right">{score}/{max}</span>
      <ScoreBandBadge band={band} />
    </div>
  );
}
