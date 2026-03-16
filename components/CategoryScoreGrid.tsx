"use client";

import { CATEGORIES } from "@/lib/types";

type CategoryScore = {
  categoryId: string;
  categoryName: string;
  maxPoints: number;
  score: number;
  tier: string;
};

type ReviewScore = {
  reviewPass: string;
  categoryScores: CategoryScore[];
};

export default function CategoryScoreGrid({ reviewScores }: { reviewScores: ReviewScore[] }) {
  // Build category map from all passes
  const categoryMap = new Map<string, CategoryScore & { pass: string }>();
  for (const rs of reviewScores) {
    for (const cs of rs.categoryScores) {
      categoryMap.set(cs.categoryId, { ...cs, pass: rs.reviewPass });
    }
  }

  if (categoryMap.size === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-500 mb-2">Category Scores</h2>
        <p className="text-sm text-gray-400">No scores yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <h2 className="text-sm font-semibold text-gray-500 mb-3">Category Scores (12 categories)</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => {
          const data = categoryMap.get(cat.id);
          if (!data) return <CategoryCard key={cat.id} id={cat.id} name={cat.name} max={cat.maxPoints} tier={cat.tier} />;
          const pct = Math.round((data.score / data.maxPoints) * 100);
          return (
            <CategoryCard
              key={cat.id}
              id={cat.id}
              name={cat.name}
              score={data.score}
              max={data.maxPoints}
              pct={pct}
              tier={cat.tier}
            />
          );
        })}
      </div>
    </div>
  );
}

function CategoryCard({
  id,
  name,
  score,
  max,
  pct,
  tier,
}: {
  id: string;
  name: string;
  score?: number;
  max: number;
  pct?: number;
  tier: string;
}) {
  const tierBadge = tier === "tier1" ? "bg-red-100 text-red-700" : "bg-gray-100 text-gray-500";
  const barColor = pct === undefined ? "bg-gray-200" : pct >= 85 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : pct >= 50 ? "bg-orange-400" : "bg-red-400";

  return (
    <div className="border border-gray-200 rounded-lg p-3 space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-600">{id}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${tierBadge}`}>
          {tier === "tier1" ? "T1" : "T2"}
        </span>
      </div>
      <div className="text-xs text-gray-500 leading-tight line-clamp-2">{name}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-lg font-bold text-gray-900">
          {score !== undefined ? score : "—"}
        </span>
        <span className="text-xs text-gray-400">/ {max}</span>
      </div>
      {/* Progress bar */}
      <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full ${barColor}`}
          style={{ width: `${pct ?? 0}%` }}
        />
      </div>
    </div>
  );
}
