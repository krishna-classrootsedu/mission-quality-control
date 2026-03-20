"use client";

import VerdictBanner from "./VerdictBanner";
import SlideReviewList from "./SlideReviewList";
import { sourceFileToComponent } from "@/lib/types";

type QuadrantScore = {
  quadrantId: string;
  quadrantName: string;
  maxPoints: number;
  score: number;
  criteriaScores: Array<{
    criterionId: string;
    criterionName: string;
    maxPoints: number;
    score: number;
    type?: string;
    evidence?: string;
    slideNumbers?: number[];
  }>;
};

type ReviewScoreRow = {
  reviewPass: string;
  quadrantScores: QuadrantScore[];
  totalPoints: number;
  maxPoints: number;
};

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

export default function AppletTabContent({
  appletKey,
  appletLabel,
  reviewScores,
  slides,
  recommendations,
  decisions,
  onDecisionChange,
}: {
  appletKey: string;
  appletLabel: string;
  reviewScores: ReviewScoreRow[];
  slides: Slide[];
  recommendations: Recommendation[];
  decisions: Map<string, Decision>;
  onDecisionChange: (id: string, status: string, comment: string) => void;
}) {
  const appletScores = reviewScores.find((rs) => rs.reviewPass === appletKey);

  const appletSlides = slides.filter((s) => {
    if (!s.sourceFile) return false;
    return sourceFileToComponent(s.sourceFile) === appletKey;
  });

  const appletRecs = recommendations.filter((r) => r.component === appletKey);

  return (
    <div className="space-y-3">
      <VerdictBanner
        score={appletScores?.totalPoints ?? null}
        maxPoints={appletScores?.maxPoints ?? 100}
        band={null}
        quadrantScores={appletScores?.quadrantScores ?? []}
        componentLabel={`${appletLabel} Review`}
      />

      <SlideReviewList
        slides={appletSlides}
        recommendations={appletRecs}
        decisions={decisions}
        onDecisionChange={onDecisionChange}
      />
    </div>
  );
}
