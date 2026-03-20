"use client";

import InlineRecommendation from "./InlineRecommendation";

type Slide = {
  slideNumber: number;
  slideType?: string;
  sourceSlideNumber?: number;
  thumbnailUrl: string | null;
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

export default function SlideRow({
  slide,
  recommendations,
  decisions,
  onDecisionChange,
}: {
  slide: Slide;
  recommendations: Recommendation[];
  decisions: Map<string, Decision>;
  onDecisionChange: (id: string, status: string, comment: string) => void;
}) {
  const sorted = [...recommendations].sort((a, b) => {
    const pa = a.pointsRecoverable ?? 0;
    const pb = b.pointsRecoverable ?? 0;
    if (pa !== pb) return pb - pa;
    return a.directiveIndex - b.directiveIndex;
  });

  const hasIssues = sorted.length > 0;

  return (
    <div className="flex gap-4 py-5 border-b border-stone-100 last:border-b-0">
      {/* Thumbnail column */}
      <div className="w-[180px] shrink-0">
        <div className="sticky top-0">
          {slide.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={slide.thumbnailUrl}
              alt={`Slide ${slide.sourceSlideNumber ?? slide.slideNumber}`}
              className="w-full rounded-lg ring-1 ring-stone-200 hover:scale-[1.02] transition-transform"
            />
          ) : (
            <div className="w-full aspect-[16/9] bg-stone-100 rounded-lg ring-1 ring-stone-200 flex items-center justify-center">
              <span className="text-[11px] text-stone-300">No thumbnail</span>
            </div>
          )}
          <div className="mt-1.5">
            <span className="text-[11px] font-mono text-stone-500">
              #{slide.sourceSlideNumber ?? slide.slideNumber}
            </span>
          </div>
        </div>
      </div>

      {/* Recommendations column */}
      <div className="flex-1 min-w-0">
        {hasIssues ? (
          <div className="space-y-2">
            {sorted.map((r) => (
              <InlineRecommendation
                key={r._id}
                recommendation={r}
                decision={decisions.get(r._id)}
                onDecisionChange={onDecisionChange}
              />
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 py-4">
            <span className="text-stone-300 text-[11px]">&#10003;</span>
            <span className="text-[11px] text-stone-300 italic">Clean</span>
          </div>
        )}
      </div>
    </div>
  );
}
