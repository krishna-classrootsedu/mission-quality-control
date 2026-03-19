"use client";

import { useState } from "react";
import { QUADRANTS } from "@/lib/types";

type CriterionScore = {
  criterionId: string;
  criterionName: string;
  maxPoints: number;
  score: number;
  type?: string;
  evidence?: string;
  slideNumbers?: number[];
};

type QuadrantScore = {
  quadrantId: string;
  quadrantName: string;
  maxPoints: number;
  score: number;
  criteriaScores: CriterionScore[];
};

type ReviewScoreRow = {
  reviewPass: string;
  quadrantScores: QuadrantScore[];
  totalPoints: number;
  maxPoints: number;
};

export default function QuadrantScoreDisplay({ reviewScores }: { reviewScores: ReviewScoreRow[] }) {
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [expandedQuadrant, setExpandedQuadrant] = useState<string | null>(null);

  if (reviewScores.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Quadrant Scores</h2>
        <p className="text-sm text-gray-300">No scores yet</p>
      </div>
    );
  }

  // Group by component (reviewPass)
  const components = reviewScores.map((rs) => rs.reviewPass);
  const selected = activeComponent ?? components[0];
  const selectedScores = reviewScores.find((rs) => rs.reviewPass === selected);

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Quadrant Scores</h2>
        {/* Component tabs */}
        {components.length > 1 && (
          <div className="flex gap-1">
            {components.map((c) => (
              <button
                key={c}
                onClick={() => setActiveComponent(c)}
                className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
                  selected === c
                    ? "bg-gray-900 text-white"
                    : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                }`}
              >
                {c === "spine" ? "Spine" : c.replace("applet_", "Applet ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedScores && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {QUADRANTS.map((q) => {
            const data = selectedScores.quadrantScores.find((qs) => qs.quadrantId === q.id);
            const score = data?.score ?? 0;
            const max = data?.maxPoints ?? q.maxPoints;
            const pct = max > 0 ? Math.round((score / max) * 100) : 0;
            const isExpanded = expandedQuadrant === `${selected}-${q.id}`;
            const barColor = pct >= 90 ? "bg-emerald-400" : pct >= 75 ? "bg-amber-400" : pct >= 50 ? "bg-orange-400" : "bg-red-400";

            return (
              <div key={q.id}>
                <button
                  onClick={() => setExpandedQuadrant(isExpanded ? null : `${selected}-${q.id}`)}
                  className="w-full text-left border border-gray-200/80 rounded-lg p-4 hover:shadow-sm transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-gray-500">{q.id}</span>
                    <span className="text-[10px] text-gray-400">{q.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-xl font-bold text-gray-900 tabular-nums">{score}</span>
                    <span className="text-[11px] text-gray-300 font-mono">/{max}</span>
                    <span className="text-[11px] text-gray-400 ml-auto">{pct}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden mt-2">
                    <div className={`h-full rounded-full transition-all ${barColor}`} style={{ width: `${pct}%` }} />
                  </div>
                </button>

                {/* Expanded criteria breakdown */}
                {isExpanded && data && (
                  <div className="mt-1 border border-gray-100 rounded-lg p-3 space-y-1.5">
                    {data.criteriaScores.map((cs) => {
                      const cPct = cs.maxPoints > 0 ? Math.round((cs.score / cs.maxPoints) * 100) : 0;
                      return (
                        <div key={cs.criterionId} className="flex items-center gap-2">
                          <span className="text-[10px] font-mono text-gray-400 w-6 shrink-0">{cs.criterionId}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between">
                              <span className="text-[11px] text-gray-600 truncate">{cs.criterionName}</span>
                              <span className="text-[10px] font-mono text-gray-400 ml-2 shrink-0">{cs.score}/{cs.maxPoints}</span>
                            </div>
                            <div className="w-full h-0.5 bg-gray-100 rounded-full overflow-hidden mt-0.5">
                              <div
                                className={`h-full rounded-full ${cPct >= 75 ? "bg-emerald-300" : cPct >= 50 ? "bg-amber-300" : "bg-red-300"}`}
                                style={{ width: `${cPct}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
