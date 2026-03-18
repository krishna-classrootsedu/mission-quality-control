"use client";

import ScoreBandBadge from "./ScoreBandBadge";
import { CATEGORIES } from "@/lib/types";

type ReviewScore = {
  categoryScores: Array<{
    categoryId: string;
    categoryName: string;
    maxPoints: number;
    score: number;
    tier: string;
  }>;
  totalPoints: number;
  maxPoints: number;
};

const TIER1_THRESHOLD = 0.7;

export default function ScoreSummary({
  overallScore,
  overallPercentage,
  scoreBand,
  tier1AllPassed,
  reviewScores,
}: {
  overallScore: number | null;
  overallPercentage: number | null;
  scoreBand: string | null;
  tier1AllPassed: boolean | null;
  reviewScores: ReviewScore[];
}) {
  if (overallScore === null) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Score Summary</h2>
        <p className="text-sm text-gray-300">Scoring not yet complete</p>
      </div>
    );
  }

  const categoryMap = new Map<string, { score: number; max: number; tier: string }>();
  for (const rs of reviewScores) {
    for (const cs of rs.categoryScores) {
      categoryMap.set(cs.categoryId, { score: cs.score, max: cs.maxPoints, tier: cs.tier });
    }
  }

  const tier1Categories = CATEGORIES.filter((c) => c.tier === "tier1");

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 space-y-5">
      <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Score Summary</h2>

      <div className="flex items-center gap-5">
        <div className="text-5xl font-bold text-gray-900 tabular-nums tracking-tight">{overallPercentage}%</div>
        <div className="space-y-1.5">
          <ScoreBandBadge band={scoreBand} />
          <div className="text-xs text-gray-400 font-mono">{overallScore}/120 pts</div>
        </div>
      </div>

      <div>
        <div className="flex items-center gap-2.5 mb-3">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Tier 1 Gates</h3>
          {tier1AllPassed !== null && (
            <span className={`text-[11px] font-semibold ${tier1AllPassed ? "text-emerald-600" : "text-red-500"}`}>
              {tier1AllPassed ? "All passed" : "Some failed"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tier1Categories.map((cat) => {
            const data = categoryMap.get(cat.id);
            if (!data) return <GateIndicator key={cat.id} id={cat.id} name={cat.name} status="pending" />;
            const pct = data.score / data.max;
            return (
              <GateIndicator
                key={cat.id}
                id={cat.id}
                name={cat.name}
                status={pct >= TIER1_THRESHOLD ? "pass" : "fail"}
                score={`${data.score}/${data.max}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GateIndicator({ id, name, status, score }: { id: string; name: string; status: "pass" | "fail" | "pending"; score?: string }) {
  const styles = {
    pass: "bg-emerald-50 border-emerald-200 text-emerald-700",
    fail: "bg-red-50 border-red-200 text-red-600",
    pending: "bg-gray-50 border-gray-200 text-gray-300",
  };
  const icons = { pass: "\u2713", fail: "\u2717", pending: "\u2014" };

  return (
    <div className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg border ${styles[status]}`} title={name}>
      <span className="text-[11px] font-bold">{id}</span>
      {score && <span className="text-[10px] font-mono opacity-70">{score}</span>}
      <span className="text-xs">{icons[status]}</span>
    </div>
  );
}
