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

// Tier 1 minimum thresholds (percentage of max) — categories must meet this to be Ship-ready
const TIER1_THRESHOLD = 0.7; // 70% of max

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
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Score Summary</h2>
        <p className="text-sm text-gray-400">Scoring not yet complete</p>
      </div>
    );
  }

  // Build category score map from all review passes
  const categoryMap = new Map<string, { score: number; max: number; tier: string }>();
  for (const rs of reviewScores) {
    for (const cs of rs.categoryScores) {
      categoryMap.set(cs.categoryId, { score: cs.score, max: cs.maxPoints, tier: cs.tier });
    }
  }

  // Get Tier 1 categories and their pass/fail status
  const tier1Categories = CATEGORIES.filter((c) => c.tier === "tier1");

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-4">
      <h2 className="text-sm font-semibold text-gray-500">Score Summary</h2>

      {/* Big score */}
      <div className="flex items-center gap-4">
        <div className="text-4xl font-bold text-gray-900">{overallPercentage}%</div>
        <div className="space-y-1">
          <ScoreBandBadge band={scoreBand} />
          <div className="text-xs text-gray-500">{overallScore}/120 points</div>
        </div>
      </div>

      {/* Tier 1 gates */}
      <div>
        <div className="flex items-center gap-2 mb-2">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Tier 1 Gates</h3>
          {tier1AllPassed !== null && (
            <span className={`text-xs font-medium ${tier1AllPassed ? "text-emerald-600" : "text-red-600"}`}>
              {tier1AllPassed ? "All passed" : "Some failed"}
            </span>
          )}
        </div>
        <div className="flex flex-wrap gap-2">
          {tier1Categories.map((cat) => {
            const data = categoryMap.get(cat.id);
            if (!data) return (
              <GateIndicator key={cat.id} id={cat.id} name={cat.name} status="pending" />
            );
            const pct = data.score / data.max;
            const passed = pct >= TIER1_THRESHOLD;
            return (
              <GateIndicator
                key={cat.id}
                id={cat.id}
                name={cat.name}
                status={passed ? "pass" : "fail"}
                score={`${data.score}/${data.max}`}
              />
            );
          })}
        </div>
      </div>
    </div>
  );
}

function GateIndicator({
  id,
  name,
  status,
  score,
}: {
  id: string;
  name: string;
  status: "pass" | "fail" | "pending";
  score?: string;
}) {
  const styles = {
    pass: "bg-emerald-50 border-emerald-300 text-emerald-700",
    fail: "bg-red-50 border-red-300 text-red-700",
    pending: "bg-gray-50 border-gray-200 text-gray-400",
  };

  return (
    <div className={`flex items-center gap-1.5 px-2 py-1 rounded border ${styles[status]}`} title={name}>
      <span className="text-xs font-bold">{id}</span>
      {score && <span className="text-[10px]">{score}</span>}
      <span className="text-xs">{status === "pass" ? "✓" : status === "fail" ? "✗" : "—"}</span>
    </div>
  );
}
