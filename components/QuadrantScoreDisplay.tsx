"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
        <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em] mb-2">Quadrant Scores</h2>
        <p className="text-sm text-stone-300">No scores yet</p>
      </div>
    );
  }

  const components = reviewScores.map((rs) => rs.reviewPass);
  const selected = activeComponent ?? components[0];
  const selectedScores = reviewScores.find((rs) => rs.reviewPass === selected);

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Quadrant Scores</h2>
        {components.length > 1 && (
          <div className="flex gap-1">
            {components.map((c) => (
              <button
                key={c}
                onClick={() => setActiveComponent(c)}
                className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                  selected === c
                    ? "bg-stone-800 text-white"
                    : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                }`}
              >
                {c === "spine" ? "Spine" : c.replace("applet_", "Applet ")}
              </button>
            ))}
          </div>
        )}
      </div>

      {selectedScores && (
        <div className="grid grid-cols-2 gap-3">
          {QUADRANTS.map((q) => {
            const data = selectedScores.quadrantScores.find((qs) => qs.quadrantId === q.id);
            const score = data?.score ?? 0;
            const max = data?.maxPoints ?? q.maxPoints;
            const pct = max > 0 ? Math.round((score / max) * 100) : 0;
            const isExpanded = expandedQuadrant === `${selected}-${q.id}`;

            return (
              <div key={q.id}>
                <button
                  onClick={() => setExpandedQuadrant(isExpanded ? null : `${selected}-${q.id}`)}
                  className="w-full text-left border border-stone-200 rounded-lg p-5 hover:shadow-subtle transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-bold text-stone-500">{q.id}</span>
                    <span className="text-[11px] text-stone-400">{q.name}</span>
                  </div>
                  <div className="flex items-baseline gap-1 mt-1.5">
                    <span className="text-xl font-bold text-stone-900 tabular-nums">{score}</span>
                    <span className="text-[11px] text-stone-300 font-mono">/{max}</span>
                    <span className="text-[11px] text-stone-400 ml-auto">{pct}%</span>
                  </div>
                  <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden mt-2">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6, ease: "easeOut" }}
                      className="h-full rounded-full bg-stone-400"
                    />
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && data && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: "auto", opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-1 border border-stone-100 rounded-lg p-3 space-y-1.5">
                        {data.criteriaScores.map((cs) => {
                          const cPct = cs.maxPoints > 0 ? Math.round((cs.score / cs.maxPoints) * 100) : 0;
                          return (
                            <div key={cs.criterionId} className="flex items-center gap-2">
                              <span className="text-[11px] font-mono text-stone-400 w-6 shrink-0">{cs.criterionId}</span>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center justify-between">
                                  <span className="text-[11px] text-stone-600 truncate">{cs.criterionName}</span>
                                  <span className="text-[11px] font-mono text-stone-400 ml-2 shrink-0">{cs.score}/{cs.maxPoints}</span>
                                </div>
                                <div className="w-full h-0.5 bg-stone-100 rounded-full overflow-hidden mt-0.5">
                                  <div
                                    className="h-full rounded-full bg-stone-300"
                                    style={{ width: `${cPct}%` }}
                                  />
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
