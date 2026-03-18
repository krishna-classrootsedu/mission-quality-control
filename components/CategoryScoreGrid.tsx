"use client";

import { CATEGORIES } from "@/lib/types";

type CategoryScore = { categoryId: string; categoryName: string; maxPoints: number; score: number; tier: string };
type ReviewScore = { reviewPass: string; categoryScores: CategoryScore[] };

export default function CategoryScoreGrid({ reviewScores }: { reviewScores: ReviewScore[] }) {
  const categoryMap = new Map<string, CategoryScore & { pass: string }>();
  for (const rs of reviewScores) {
    for (const cs of rs.categoryScores) {
      categoryMap.set(cs.categoryId, { ...cs, pass: rs.reviewPass });
    }
  }

  if (categoryMap.size === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Category Scores</h2>
        <p className="text-sm text-gray-300">No scores yet</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
      <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-4">Category Scores</h2>
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
        {CATEGORIES.map((cat) => {
          const data = categoryMap.get(cat.id);
          if (!data) return <CategoryCard key={cat.id} id={cat.id} name={cat.name} max={cat.maxPoints} tier={cat.tier} />;
          const pct = Math.round((data.score / data.maxPoints) * 100);
          return <CategoryCard key={cat.id} id={cat.id} name={cat.name} score={data.score} max={data.maxPoints} pct={pct} tier={cat.tier} />;
        })}
      </div>
    </div>
  );
}

function CategoryCard({ id, name, score, max, pct, tier }: { id: string; name: string; score?: number; max: number; pct?: number; tier: string }) {
  const tierStyle = tier === "tier1" ? "bg-red-50 text-red-500 border-red-200" : "bg-gray-50 text-gray-400 border-gray-200";
  const barColor = pct === undefined ? "bg-gray-100" : pct >= 85 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : pct >= 50 ? "bg-orange-400" : "bg-red-400";

  return (
    <div className="border border-gray-200/80 rounded-lg p-4 space-y-2 hover:shadow-sm transition-shadow">
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold text-gray-500">{id}</span>
        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold border ${tierStyle}`}>
          {tier === "tier1" ? "T1" : "T2"}
        </span>
      </div>
      <div className="text-[11px] text-gray-400 leading-snug line-clamp-2">{name}</div>
      <div className="flex items-baseline gap-1">
        <span className="text-xl font-bold text-gray-900 tabular-nums">{score !== undefined ? score : "\u2014"}</span>
        <span className="text-[11px] text-gray-300 font-mono">/ {max}</span>
      </div>
      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
        <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct ?? 0}%` }} />
      </div>
    </div>
  );
}
