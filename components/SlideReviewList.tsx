"use client";

import { useMemo } from "react";
import SlideRow from "./SlideRow";
import InlineRecommendation from "./InlineRecommendation";

type Slide = {
  slideNumber: number;
  slideType?: string;
  sourceSlideNumber?: number;
  thumbnailUrl: string | null;
  sourceFile?: string;
};

type Recommendation = {
  _id: string;
  directiveIndex: number;
  slideNumber?: number;
  issue: string;
  quadrantId: string;
  recommendedFix: string;
  why?: string;
  operationType: string;
  confidence: string;
  sourceAttribution?: string;
  component: string;
  pointsRecoverable?: number;
  sourcePass: string;
  priority?: number;
  reviewStatus: string;
  vinayComment?: string;
};

type Decision = { status: string; comment: string };

export default function SlideReviewList({
  slides,
  recommendations,
  decisions,
  onDecisionChange,
}: {
  slides: Slide[];
  recommendations: Recommendation[];
  decisions: Map<string, Decision>;
  onDecisionChange: (id: string, status: string, comment: string) => void;
}) {
  const { slideRecs, generalRecs, sortedSlides } = useMemo(() => {
    // Group recommendations by slideNumber
    const slideMap = new Map<number, Recommendation[]>();
    const general: Recommendation[] = [];

    for (const r of recommendations) {
      if (r.slideNumber != null) {
        const arr = slideMap.get(r.slideNumber) ?? [];
        arr.push(r);
        slideMap.set(r.slideNumber, arr);
      } else {
        general.push(r);
      }
    }

    // Sort slides by slideNumber
    let sorted = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);

    // If no actual slides but recs have slideNumbers, create synthetic placeholders
    if (sorted.length === 0 && slideMap.size > 0) {
      sorted = Array.from(slideMap.keys())
        .sort((a, b) => a - b)
        .map((num) => ({
          slideNumber: num,
          thumbnailUrl: null,
        }));
    }

    return { slideRecs: slideMap, generalRecs: general, sortedSlides: sorted };
  }, [slides, recommendations]);

  if (sortedSlides.length === 0 && recommendations.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-8 text-center">
        <p className="text-sm text-gray-400">No slides or recommendations for this component</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {/* Slide-by-slide review */}
      {sortedSlides.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm px-5 py-2">
          {sortedSlides.map((slide) => (
            <SlideRow
              key={slide.slideNumber}
              slide={slide}
              recommendations={slideRecs.get(slide.slideNumber) ?? []}
              decisions={decisions}
              onDecisionChange={onDecisionChange}
            />
          ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
          <p className="text-xs text-gray-400 mb-3">Slides not yet parsed. Showing recommendations only.</p>
          <div className="space-y-2">
            {recommendations
              .sort((a, b) => (b.pointsRecoverable ?? 0) - (a.pointsRecoverable ?? 0))
              .map((r) => (
                <InlineRecommendation
                  key={r._id}
                  recommendation={r}
                  decision={decisions.get(r._id)}
                  onDecisionChange={onDecisionChange}
                />
              ))}
          </div>
        </div>
      ) : null}

      {/* General section: recs with no slide number */}
      {generalRecs.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5 mt-3">
          <h3 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-3">
            General / Module-wide ({generalRecs.length})
          </h3>
          <div className="space-y-2">
            {generalRecs
              .sort((a, b) => (b.pointsRecoverable ?? 0) - (a.pointsRecoverable ?? 0))
              .map((r) => (
                <InlineRecommendation
                  key={r._id}
                  recommendation={r}
                  decision={decisions.get(r._id)}
                  onDecisionChange={onDecisionChange}
                />
              ))}
          </div>
        </div>
      )}
    </div>
  );
}
