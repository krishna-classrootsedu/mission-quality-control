"use client";

import VerdictBanner from "./VerdictBanner";
import GateReport from "./GateReport";
import SlideReviewList from "./SlideReviewList";

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

type GatekeeperResult = {
  passed: boolean;
  ruleResults: { ruleId: string; ruleName: string; passed: boolean; evidence?: string; slideNumbers?: number[] }[];
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

export default function SpineTabContent({
  reviewScores,
  gatekeeperData,
  slides,
  recommendations,
  decisions,
  onDecisionChange,
}: {
  reviewScores: ReviewScoreRow[];
  gatekeeperData: GatekeeperResult | null;
  slides: Slide[];
  recommendations: Recommendation[];
  decisions: Map<string, Decision>;
  onDecisionChange: (id: string, status: string, comment: string) => void;
}) {
  const spineScores = reviewScores.find((rs) => rs.reviewPass === "spine");
  const hasSourceFiles = slides.some((s) => s.sourceFile);
  const spineSlides = hasSourceFiles
    ? slides.filter((s) => s.sourceFile === "spine")
    : slides;
  const spineRecs = recommendations.filter((r) => r.component === "spine" && r.slideNumber != null);

  return (
    <div className="space-y-3">
      <VerdictBanner
        score={spineScores?.totalPoints ?? null}
        maxPoints={spineScores?.maxPoints ?? 100}
        band={null}
        quadrantScores={spineScores?.quadrantScores ?? []}
        componentLabel="Spine Review"
      />

      {gatekeeperData && (
        <GateReport
          gates={gatekeeperData.ruleResults}
          overallPassed={gatekeeperData.passed}
          title="Module Gates"
          defaultCollapsed
        />
      )}

      <SlideReviewList
        slides={spineSlides}
        recommendations={spineRecs}
        decisions={decisions}
        onDecisionChange={onDecisionChange}
      />
    </div>
  );
}
