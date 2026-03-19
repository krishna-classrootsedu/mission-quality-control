"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import StageBadge from "@/components/StageBadge";
import ScoreBandBadge from "@/components/ScoreBandBadge";
import FlowMapTable from "@/components/FlowMapTable";
import QuadrantScoreDisplay from "@/components/QuadrantScoreDisplay";
import ComponentScoreSummary from "@/components/ComponentScoreSummary";
import RecommendationsSection from "@/components/RecommendationsSection";

type Tab = "overview" | "recommendations";

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const moduleData = useQuery(api.modules.detail, { moduleId });
  const reviewScores = useQuery(
    api.reviewScores.byModule,
    moduleData ? { moduleId, version: moduleData.version } : "skip"
  );
  const recommendations = useQuery(
    api.recommendations.byModule,
    moduleData ? { moduleId, version: moduleData.version } : "skip"
  );
  const gatekeeperData = useQuery(
    api.gatekeeperQuery.byModule,
    moduleData ? { moduleId, version: moduleData.version } : "skip"
  );
  const flowMapData = useQuery(
    api.flowMap.byModule,
    moduleData ? { moduleId, version: moduleData.version } : "skip"
  );

  if (moduleData === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="flex items-center gap-2.5 text-gray-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading module...
        </div>
      </div>
    );
  }

  if (moduleData === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Module not found: {moduleId}</div>
      </div>
    );
  }

  const recCount = recommendations?.length ?? 0;
  const pendingCount = recommendations?.filter((r) => r.reviewStatus === "pending").length ?? 0;

  return (
    <div className="min-h-screen">
      {/* Sub-header */}
      <div className="border-b border-gray-200/80 bg-white">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between py-3">
            <div>
              <h1 className="text-base font-semibold text-gray-900 tracking-tight leading-tight">
                {moduleData.title}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <StageBadge status={moduleData.status} />
                <span className="text-[11px] text-gray-400 font-mono">v{moduleData.version}</span>
                <span className="text-[11px] text-gray-400">Grade {moduleData.grade}</span>
              </div>
            </div>
            {moduleData.overallPercentage != null && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight leading-none">
                    {moduleData.overallPercentage}%
                  </div>
                  <div className="text-[11px] text-gray-400 font-mono mt-0.5">{moduleData.overallScore}/100</div>
                </div>
                <ScoreBandBadge band={moduleData.scoreBand ?? null} />
              </div>
            )}
          </div>
          {/* Tabs */}
          <div className="flex gap-0 -mb-px">
            <TabButton active={activeTab === "overview"} onClick={() => setActiveTab("overview")}>
              Overview
            </TabButton>
            <TabButton
              active={activeTab === "recommendations"}
              onClick={() => setActiveTab("recommendations")}
              badge={pendingCount > 0 ? pendingCount : undefined}
            >
              Recommendations
              {recCount > 0 && <span className="text-gray-300 ml-1">{recCount}</span>}
            </TabButton>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-4">
        {activeTab === "overview" ? (
          <OverviewContent
            moduleData={moduleData}
            reviewScores={reviewScores ?? []}
            gatekeeperData={gatekeeperData ?? null}
            flowMapData={flowMapData ?? []}
          />
        ) : (
          recommendations && recommendations.length > 0 ? (
            <RecommendationsSection recommendations={recommendations} moduleId={moduleId} version={moduleData.version} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-12 text-center">
              <p className="text-sm text-gray-400">No recommendations yet</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

/* --- Tab Button --- */
function TabButton({ active, onClick, badge, children }: {
  active: boolean; onClick: () => void; badge?: number; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors ${active ? "text-gray-900" : "text-gray-400 hover:text-gray-600"}`}>
      <span className="flex items-center gap-1.5">
        {children}
        {badge != null && (
          <span className="inline-flex items-center justify-center min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700">{badge}</span>
        )}
      </span>
      {active && <span className="absolute bottom-0 left-4 right-4 h-[2px] bg-gray-900 rounded-full" />}
    </button>
  );
}

/* --- Overview --- */

type ReviewScoreRow = {
  reviewPass: string;
  quadrantScores: Array<{
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
  }>;
  totalPoints: number;
  maxPoints: number;
};

type GatekeeperResult = {
  passed: boolean;
  ruleResults: { ruleId: string; ruleName: string; passed: boolean; evidence?: string; slideNumbers?: number[] }[];
};

function OverviewContent({
  moduleData,
  reviewScores,
  gatekeeperData,
  flowMapData,
}: {
  moduleData: {
    learningObjective: string;
    overallScore?: number;
    overallPercentage?: number;
    scoreBand?: string;
  };
  reviewScores: ReviewScoreRow[];
  gatekeeperData: GatekeeperResult | null;
  flowMapData: React.ComponentProps<typeof FlowMapTable>["steps"];
}) {
  return (
    <div className="space-y-3">
      {/* Row 1: LO + Gatekeeper */}
      <div className="grid grid-cols-12 gap-3">
        {/* Learning Objective */}
        <div className="col-span-5 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Learning Objective</span>
          <p className="text-[13px] text-gray-600 leading-relaxed mt-2">{moduleData.learningObjective}</p>
        </div>

        {/* Gatekeeper */}
        <div className="col-span-7 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Gatekeeper Rules</span>
            {gatekeeperData && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                gatekeeperData.passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
              }`}>
                {gatekeeperData.passed ? "PASSED" : "FAILED"}
              </span>
            )}
          </div>
          {gatekeeperData ? (
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              {gatekeeperData.ruleResults.map((rule) => (
                <div key={rule.ruleId} className="flex items-center gap-2 py-0.5">
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                    rule.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                  }`}>
                    {rule.passed ? "\u2713" : "\u2717"}
                  </span>
                  <span className="text-[13px] text-gray-600 truncate">{rule.ruleName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-400">Not yet checked</p>
          )}
        </div>
      </div>

      {/* Row 2: Flow Map */}
      {flowMapData.length > 0 && (
        <FlowMapTable steps={flowMapData} />
      )}

      {/* Row 3: Component Score Summary */}
      <ComponentScoreSummary
        overallScore={moduleData.overallScore ?? null}
        overallPercentage={moduleData.overallPercentage ?? null}
        scoreBand={moduleData.scoreBand ?? null}
        reviewScores={reviewScores}
      />

      {/* Row 4: Quadrant Scores */}
      <QuadrantScoreDisplay reviewScores={reviewScores} />
    </div>
  );
}
