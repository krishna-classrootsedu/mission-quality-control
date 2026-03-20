"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { sourceFileToComponent } from "@/lib/types";
import StageBadge from "@/components/StageBadge";
import ScoreBandBadge from "@/components/ScoreBandBadge";
import FlowMapTable from "@/components/FlowMapTable";
import QuadrantScoreDisplay from "@/components/QuadrantScoreDisplay";
import ComponentScoreSummary from "@/components/ComponentScoreSummary";
import SpineTabContent from "@/components/SpineTabContent";
import AppletTabContent from "@/components/AppletTabContent";
import VerdictBanner from "@/components/VerdictBanner";
import InlineRecommendation from "@/components/InlineRecommendation";

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;
  const [activeTab, setActiveTab] = useState("overview");
  const [decisions, setDecisions] = useState<Map<string, { status: string; comment: string }>>(new Map());
  const [saving, setSaving] = useState(false);

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
  const slidesWithUrls = useQuery(
    api.parsedSlides.byModuleWithUrls,
    moduleData ? { moduleId, version: moduleData.version } : "skip"
  );

  const reviewMutation = useMutation(api.recommendations.review);
  const completeMutation = useMutation(api.recommendations.completeVinayReview);

  const tabs = useMemo(() => {
    const baseTabs = [
      { key: "overview", label: "Overview" },
      { key: "global", label: "Global" },
      { key: "spine", label: "Spine" },
    ];

    const appletKeys: { key: string; label: string }[] = [];
    if (moduleData?.sourceFiles) {
      for (const sf of moduleData.sourceFiles) {
        if (sf.type === "applet") {
          const component = sourceFileToComponent(sf.label);
          appletKeys.push({
            key: component,
            label: sf.label.replace(/^A/, "Applet "),
          });
        }
      }
    } else if (reviewScores) {
      for (const rs of reviewScores) {
        if (rs.reviewPass.startsWith("applet_")) {
          appletKeys.push({
            key: rs.reviewPass,
            label: rs.reviewPass.replace("applet_", "Applet "),
          });
        }
      }
    }

    return [...baseTabs, ...appletKeys];
  }, [moduleData?.sourceFiles, reviewScores]);

  const handleDecisionChange = useCallback(
    (id: string, status: string, comment: string) => {
      setDecisions((prev) => {
        const next = new Map(prev);
        next.set(id, { status, comment });
        return next;
      });
    },
    []
  );

  const handleSave = async () => {
    setSaving(true);
    try {
      const saved = new Map(decisions);
      for (const [id, decision] of Array.from(decisions)) {
        if (decision.status === "pending") continue;
        await reviewMutation({
          recommendationId: id as Id<"recommendations">,
          reviewStatus: decision.status,
          vinayComment: decision.comment || undefined,
        });
        saved.delete(id);
      }
      setDecisions(saved);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    if (!moduleData) return;
    try {
      const result = await completeMutation({ moduleId, version: moduleData.version });
      alert(`Review complete! ${result.accepted} accepted, ${result.rejected} rejected.`);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Complete failed");
    }
  };

  const tabBadges = useMemo(() => {
    if (!recommendations) return {};
    const badges: Record<string, number> = {};
    for (const r of recommendations) {
      if (r.reviewStatus !== "pending") continue;
      if (r.slideNumber == null) {
        badges["global"] = (badges["global"] ?? 0) + 1;
      } else {
        badges[r.component] = (badges[r.component] ?? 0) + 1;
      }
    }
    return badges;
  }, [recommendations]);

  if (moduleData === undefined) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse bg-stone-100 rounded" />
          <div className="h-4 w-32 animate-pulse bg-stone-100 rounded" />
          <div className="h-64 w-[600px] animate-pulse bg-stone-100 rounded-lg" />
        </div>
      </div>
    );
  }

  if (moduleData === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-stone-400">Module not found: {moduleId}</div>
      </div>
    );
  }

  const recCount = recommendations?.length ?? 0;
  const pendingCount = recommendations?.filter((r) => r.reviewStatus === "pending").length ?? 0;
  const saveableCount = Array.from(decisions.values()).filter((d) => d.status !== "pending").length;
  const needsDecisionCount = decisions.size - saveableCount;

  return (
    <div className="h-[calc(100vh-48px)] flex flex-col">
      {/* Sub-header */}
      <div className="border-b border-stone-200/60 bg-white sticky top-12 z-10 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between py-3">
            <div>
              <h1 className="text-lg font-semibold text-stone-800 tracking-tight leading-tight">
                {moduleData.title}
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <StageBadge status={moduleData.status} />
                <span className="text-[11px] text-stone-400 font-mono">v{moduleData.version}</span>
                <span className="text-[11px] text-stone-400">Grade {moduleData.grade}</span>
              </div>
            </div>
            {moduleData.overallPercentage != null && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="font-display text-4xl text-stone-900 leading-none">
                    {moduleData.overallPercentage}<span className="text-3xl">%</span>
                  </div>
                  <div className="text-[11px] text-stone-400 font-mono mt-0.5">{moduleData.overallScore}/100</div>
                </div>
                <ScoreBandBadge band={moduleData.scoreBand ?? null} />
              </div>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-0 -mb-px overflow-x-auto">
            {tabs.map((tab) => (
              <TabButton
                key={tab.key}
                active={activeTab === tab.key}
                onClick={() => setActiveTab(tab.key)}
                badge={tabBadges[tab.key]}
              >
                {tab.label}
                {tab.key !== "overview" && recCount > 0 && recommendations && (() => {
                  const count = tab.key === "global"
                    ? recommendations.filter((r) => r.slideNumber == null).length
                    : tab.key === "spine"
                      ? recommendations.filter((r) => r.component === "spine" && r.slideNumber != null).length
                      : recommendations.filter((r) => r.component === tab.key && r.slideNumber != null).length;
                  return count > 0 ? <span className="text-stone-300 ml-1">{count}</span> : null;
                })()}
              </TabButton>
            ))}
          </div>
        </div>
      </div>

      {/* Content with crossfade */}
      <main className="flex-1 overflow-y-auto">
        <div className="max-w-[1400px] mx-auto px-6 py-4 pb-16">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
          >
            {activeTab === "overview" ? (
              <OverviewContent
                moduleData={moduleData}
                reviewScores={reviewScores ?? []}
                gatekeeperData={gatekeeperData ?? null}
                flowMapData={flowMapData ?? []}
              />
            ) : activeTab === "global" ? (
              <GlobalContent
                moduleData={moduleData}
                reviewScores={reviewScores ?? []}
                recommendations={recommendations ?? []}
                decisions={decisions}
                onDecisionChange={handleDecisionChange}
              />
            ) : activeTab === "spine" ? (
              <SpineTabContent
                reviewScores={reviewScores ?? []}
                gatekeeperData={gatekeeperData ?? null}
                slides={slidesWithUrls ?? []}
                recommendations={recommendations ?? []}
                decisions={decisions}
                onDecisionChange={handleDecisionChange}
              />
            ) : activeTab.startsWith("applet_") ? (
              <AppletTabContent
                appletKey={activeTab}
                appletLabel={tabs.find((t) => t.key === activeTab)?.label ?? activeTab}
                reviewScores={reviewScores ?? []}
                slides={slidesWithUrls ?? []}
                recommendations={recommendations ?? []}
                decisions={decisions}
                onDecisionChange={handleDecisionChange}
              />
            ) : null}
          </motion.div>
        </AnimatePresence>
        </div>
      </main>

      {/* Sticky save bar */}
      {recCount > 0 && activeTab !== "overview" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-stone-200/60 shadow-bar px-6 py-3.5 z-20">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="text-xs text-stone-500 flex items-center gap-3">
              {saveableCount > 0 && (
                <span className="text-stone-700 font-medium">{saveableCount} ready to save</span>
              )}
              {needsDecisionCount > 0 && (
                <span className="text-stone-400">
                  {needsDecisionCount} {needsDecisionCount === 1 ? "row needs" : "rows need"} Accept/Reject before saving
                </span>
              )}
              {saveableCount === 0 && needsDecisionCount === 0 && pendingCount > 0 && (
                <span className="text-stone-400">{pendingCount} recommendations still pending</span>
              )}
              {saveableCount === 0 && needsDecisionCount === 0 && pendingCount === 0 && (
                <span className="text-stone-600 font-medium">All recommendations reviewed</span>
              )}
            </div>
            <div className="flex gap-2.5">
              {saveableCount > 0 && (
                <button
                  onClick={handleSave}
                  disabled={saving}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-sm font-medium hover:bg-stone-800 disabled:opacity-50 transition-all"
                >
                  {saving ? "Saving..." : `Save ${saveableCount} ${saveableCount === 1 ? "Decision" : "Decisions"}`}
                </button>
              )}
              {pendingCount === 0 && saveableCount === 0 && needsDecisionCount === 0 && (
                <button
                  onClick={handleComplete}
                  className="px-4 py-2 bg-stone-800 text-white rounded-lg text-sm font-medium hover:bg-stone-900 transition-all"
                >
                  Complete Review
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Tab Button with sliding underline --- */
function TabButton({ active, onClick, badge, children }: {
  active: boolean; onClick: () => void; badge?: number; children: React.ReactNode;
}) {
  return (
    <button onClick={onClick} className={`relative px-4 py-2.5 text-[13px] font-medium transition-colors whitespace-nowrap ${active ? "text-stone-900" : "text-stone-400 hover:text-stone-600"}`}>
      <span className="flex items-center gap-1.5">
        {children}
        {badge != null && badge > 0 && (
          <span className="w-1.5 h-1.5 rounded-full bg-stone-800" />
        )}
      </span>
      {active && (
        <motion.span
          layoutId="tab-underline"
          className="absolute bottom-0 left-4 right-4 h-[2px] bg-stone-800 rounded-full"
          transition={{ type: "spring", stiffness: 500, damping: 30 }}
        />
      )}
    </button>
  );
}

/* --- Overview Tab --- */

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
        <div className="col-span-5 bg-white rounded-lg border border-stone-200 shadow-subtle p-4">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Learning Objective</span>
          <p className="text-[13px] text-stone-600 leading-relaxed mt-2">{moduleData.learningObjective}</p>
        </div>

        <div className="col-span-7 bg-white rounded-lg border border-stone-200 shadow-subtle p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Gatekeeper Rules</span>
            {gatekeeperData && (
              <span className={`text-[11px] font-medium ${
                gatekeeperData.passed ? "text-stone-600" : "text-red-500"
              }`}>
                {gatekeeperData.passed ? "PASSED" : "FAILED"}
              </span>
            )}
          </div>
          {gatekeeperData ? (
            <div className="grid grid-cols-3 gap-x-4 gap-y-1">
              {gatekeeperData.ruleResults.map((rule) => (
                <div key={rule.ruleId} className="flex items-center gap-2 py-0.5">
                  <span className={`text-[11px] shrink-0 ${
                    rule.passed ? "text-stone-400" : "text-red-500"
                  }`}>
                    {rule.passed ? "\u2713" : "\u2717"}
                  </span>
                  <span className="text-[13px] text-stone-600 truncate">{rule.ruleName}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-stone-300">Not yet checked</p>
          )}
        </div>
      </div>

      {flowMapData.length > 0 && (
        <FlowMapTable steps={flowMapData} />
      )}

      <ComponentScoreSummary
        overallScore={moduleData.overallScore ?? null}
        overallPercentage={moduleData.overallPercentage ?? null}
        scoreBand={moduleData.scoreBand ?? null}
        reviewScores={reviewScores}
      />

      <QuadrantScoreDisplay reviewScores={reviewScores} />
    </div>
  );
}

/* --- Global Tab --- */

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

function GlobalContent({
  moduleData,
  reviewScores,
  recommendations,
  decisions,
  onDecisionChange,
}: {
  moduleData: {
    overallScore?: number;
    overallPercentage?: number;
    scoreBand?: string;
  };
  reviewScores: ReviewScoreRow[];
  recommendations: Recommendation[];
  decisions: Map<string, { status: string; comment: string }>;
  onDecisionChange: (id: string, status: string, comment: string) => void;
}) {
  const globalRecs = recommendations.filter((r) => r.slideNumber == null);
  const allQuadrants = reviewScores.flatMap((rs) => rs.quadrantScores);

  return (
    <div className="space-y-3">
      <VerdictBanner
        score={moduleData.overallScore ?? null}
        maxPoints={100}
        band={moduleData.scoreBand ?? null}
        quadrantScores={allQuadrants}
        componentLabel="Overall Module Score"
      />

      {globalRecs.length > 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
          <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em] mb-3">
            Module-wide Recommendations ({globalRecs.length})
          </h3>
          <div className="space-y-2">
            {globalRecs
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
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-8 text-center">
          <p className="text-sm text-stone-400">No module-wide recommendations</p>
        </div>
      )}
    </div>
  );
}
