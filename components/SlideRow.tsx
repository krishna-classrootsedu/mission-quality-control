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
    <div className="flex gap-4 py-3 border-b border-gray-100 last:border-b-0">
      {/* Thumbnail column */}
      <div className="w-[200px] shrink-0">
        <div className="sticky top-0">
          {slide.thumbnailUrl ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img
              src={slide.thumbnailUrl}
              alt={`Slide ${slide.sourceSlideNumber ?? slide.slideNumber}`}
              className="w-full rounded-lg border border-gray-200/80 shadow-sm"
            />
          ) : (
            <div className="w-full aspect-[16/9] bg-gray-100 rounded-lg border border-gray-200/80 flex items-center justify-center">
              <span className="text-xs text-gray-300">No thumbnail</span>
            </div>
          )}
          <div className="mt-1.5 flex items-center gap-1.5">
            <span className="text-xs font-mono font-semibold text-gray-500">
              #{slide.sourceSlideNumber ?? slide.slideNumber}
            </span>
            {slide.slideType && (
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">
                {slide.slideType}
              </span>
            )}
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
            <span className="w-5 h-5 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center text-[10px] font-bold">
              {"\u2713"}
            </span>
            <span className="text-xs text-emerald-600 font-medium">No issues on this slide</span>
          </div>
        )}
      </div>
    </div>
  );
}
