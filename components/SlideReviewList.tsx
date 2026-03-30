"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
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
  source?: string;
};

type Decision = { status: string; comment: string };

export default function SlideReviewList({
  slides,
  recommendations,
  decisions,
  onDecisionChange,
  readOnly = false,
}: {
  slides: Slide[];
  recommendations: Recommendation[];
  decisions: Map<string, Decision>;
  onDecisionChange: (id: string, status: string, comment: string) => void;
  readOnly?: boolean;
}) {
  const { slideRecs, sortedSlides } = useMemo(() => {
    const slideMap = new Map<number, Recommendation[]>();

    for (const r of recommendations) {
      if (r.slideNumber != null) {
        const arr = slideMap.get(r.slideNumber) ?? [];
        arr.push(r);
        slideMap.set(r.slideNumber, arr);
      }
    }

    let sorted = [...slides].sort((a, b) => a.slideNumber - b.slideNumber);

    if (sorted.length === 0 && slideMap.size > 0) {
      sorted = Array.from(slideMap.keys())
        .sort((a, b) => a - b)
        .map((num) => ({
          slideNumber: num,
          thumbnailUrl: null,
        }));
    }

    return { slideRecs: slideMap, sortedSlides: sorted };
  }, [slides, recommendations]);

  if (sortedSlides.length === 0 && recommendations.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-8 text-center">
        <p className="text-sm text-stone-400">No slides or recommendations for this component</p>
      </div>
    );
  }

  return (
    <div className="space-y-0">
      {sortedSlides.length > 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle px-5 py-2">
          {sortedSlides.map((slide, i) => (
            <motion.div
              key={slide.slideNumber}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.2, delay: i * 0.04 }}
            >
              <SlideRow
                slide={slide}
                recommendations={slideRecs.get(slide.slideNumber) ?? []}
                decisions={decisions}
                onDecisionChange={onDecisionChange}
                readOnly={readOnly}
              />
            </motion.div>
          ))}
        </div>
      ) : recommendations.length > 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
          <p className="text-[11px] text-stone-400 mb-3">Slides not yet parsed. Showing recommendations only.</p>
          <div className="space-y-2">
            {recommendations
              .sort((a, b) => (b.pointsRecoverable ?? 0) - (a.pointsRecoverable ?? 0))
              .map((r) => (
                <InlineRecommendation
                  key={r._id}
                  recommendation={r}
                  decision={decisions.get(r._id)}
                  onDecisionChange={onDecisionChange}
                  readOnly={readOnly}
                />
              ))}
          </div>
        </div>
      ) : null}

    </div>
  );
}
