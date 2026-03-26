"use client";

import { useState, useCallback, useMemo } from "react";
import { useParams } from "next/navigation";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { motion, AnimatePresence } from "framer-motion";
import { sourceFileToComponent, QUADRANTS } from "@/lib/types";
import StageBadge from "@/components/StageBadge";
import ScoreBandBadge from "@/components/ScoreBandBadge";
import FlowMapTable from "@/components/FlowMapTable";
import SpineTabContent from "@/components/SpineTabContent";
import AppletTabContent from "@/components/AppletTabContent";
import VerdictBanner from "@/components/VerdictBanner";
import InlineRecommendation from "@/components/InlineRecommendation";
import CustomReviewForm from "@/components/CustomReviewForm";

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
  const allGateResults = useQuery(
    api.gatekeeperQuery.allByModule,
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
      { key: "flow", label: "Flow" },
      { key: "custom", label: "Custom" },
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
                {tab.key !== "overview" && tab.key !== "flow" && recommendations && (() => {
                  const count = tab.key === "custom"
                    ? recommendations.filter((r) => r.source === "reviewer").length
                    : tab.key === "global"
                      ? recommendations.filter((r) => r.slideNumber == null && r.source !== "reviewer").length
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
                allGateResults={allGateResults ?? []}
              />
            ) : activeTab === "flow" ? (
              <FlowTabContent flowMapData={flowMapData ?? []} />
            ) : activeTab === "custom" ? (
              <CustomTabContent
                moduleId={moduleId}
                version={moduleData.version}
                sourceFiles={moduleData.sourceFiles}
                slides={slidesWithUrls ?? []}
                recommendations={recommendations ?? []}
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
                gatekeeperData={(allGateResults ?? []).find((g) => g.component === "module") ?? null}
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
                gatekeeperData={(allGateResults ?? []).find((g) => g.component === activeTab) ?? null}
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
  component: string;
  passed: boolean;
  ruleResults: { ruleId: string; ruleName: string; passed: boolean; evidence?: string; slideNumbers?: number[] }[];
};

function OverviewContent({
  moduleData,
  reviewScores,
  allGateResults,
}: {
  moduleData: {
    learningObjective: string;
    overallScore?: number;
    overallPercentage?: number;
    scoreBand?: string;
  };
  reviewScores: ReviewScoreRow[];
  allGateResults: GatekeeperResult[];
}) {
  const [activeComponent, setActiveComponent] = useState<string | null>(null);
  const [expandedQuadrant, setExpandedQuadrant] = useState<string | null>(null);

  const moduleGates = allGateResults.find((g) => g.component === "module");
  const appletGates = allGateResults
    .filter((g) => g.component.startsWith("applet_"))
    .sort((a, b) => a.component.localeCompare(b.component));

  const components = reviewScores.map((rs) => rs.reviewPass);
  const selected = activeComponent ?? components[0];
  const selectedScores = reviewScores.find((rs) => rs.reviewPass === selected);

  // Build applet gate names from first applet (all applets share same 5 gate names)
  const appletGateNames = appletGates.length > 0
    ? appletGates[0].ruleResults.map((r) => ({ id: r.ruleId, name: r.ruleName }))
    : [];

  return (
    <div className="space-y-3">
      {/* Row 1: LO — full width */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle px-5 py-3">
        <div className="flex items-start gap-3">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em] shrink-0 mt-0.5">LO</span>
          <p className="text-[13px] text-stone-600 leading-relaxed">{moduleData.learningObjective}</p>
        </div>
      </div>

      {/* Row 2: Gate Check — module list (left) + applet table (right) */}
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
        <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Gate Check</span>

        {moduleGates || appletGates.length > 0 ? (
          <div className="flex gap-8 mt-3">
            {/* Left: Module gates — table format matching applet side */}
            {moduleGates && (
              <div className="shrink-0" style={{ width: appletGates.length > 0 ? "35%" : "100%" }}>
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-medium text-stone-500 uppercase tracking-wider pb-1.5">Module</th>
                      <th className="text-center text-[11px] font-medium text-stone-500 pb-1.5 w-[50px]"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {moduleGates.ruleResults.map((rule) => (
                      <tr key={rule.ruleId} className="border-t border-stone-100/60">
                        <td className="text-[12px] text-stone-600 py-1.5">{rule.ruleName}</td>
                        <td className="text-center py-1.5">
                          <span className={`text-[12px] ${rule.passed ? "text-stone-400" : "text-red-400 font-semibold"}`}>
                            {rule.passed ? "\u2713" : "\u2717"}
                          </span>
                        </td>
                      </tr>
                    ))}
                    <tr className="border-t border-stone-200">
                      <td className="text-[11px] font-medium text-stone-500 py-1.5">Result</td>
                      <td className="text-center py-1.5">
                        <span className={`text-[11px] font-semibold ${moduleGates.passed ? "text-stone-600" : "text-red-500"}`}>
                          {moduleGates.passed ? "Pass" : "Fail"}
                        </span>
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}

            {/* Divider */}
            {moduleGates && appletGates.length > 0 && (
              <div className="w-px bg-stone-200 shrink-0" />
            )}

            {/* Right: Applet gates — same table format */}
            {appletGates.length > 0 && (
              <div className="flex-1 min-w-0">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-left text-[11px] font-medium text-stone-500 uppercase tracking-wider pb-1.5">Applets</th>
                      {appletGates.map((ag) => (
                        <th key={ag.component} className="text-center text-[11px] font-medium text-stone-500 pb-1.5 px-2 w-[50px]">
                          {ag.component.replace("applet_", "A")}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {appletGateNames.map((gate) => (
                      <tr key={gate.id} className="border-t border-stone-100/60">
                        <td className="text-[12px] text-stone-600 py-1.5">{gate.name}</td>
                        {appletGates.map((ag) => {
                          const rule = ag.ruleResults.find((r) => r.ruleId === gate.id);
                          return (
                            <td key={ag.component} className="text-center py-1.5 px-2">
                              <span className={`text-[12px] ${rule?.passed ? "text-stone-400" : "text-red-400 font-semibold"}`}>
                                {rule?.passed ? "\u2713" : "\u2717"}
                              </span>
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                    <tr className="border-t border-stone-200">
                      <td className="text-[11px] font-medium text-stone-500 py-1.5">Result</td>
                      {appletGates.map((ag) => (
                        <td key={ag.component} className="text-center py-1.5 px-2">
                          <span className={`text-[11px] font-semibold ${ag.passed ? "text-stone-600" : "text-red-500"}`}>
                            {ag.passed ? "Pass" : "Fail"}
                          </span>
                        </td>
                      ))}
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-stone-300 mt-3">Not yet checked</p>
        )}
      </div>

      {/* Row 3: Quadrant Scores — 4-col grid with component pills */}
      {reviewScores.length > 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Quadrant Scores</span>
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
                    {c === "spine" ? "Spine" : c.replace("applet_", "A")}
                  </button>
                ))}
              </div>
            )}
          </div>
          {selectedScores && (
            <div className="grid grid-cols-4 gap-3">
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
                      className={`w-full text-left rounded-lg p-3 transition-all border ${
                        isExpanded
                          ? "border-stone-300 shadow-card bg-stone-50/50"
                          : "border-stone-200 hover:border-stone-300 hover:shadow-subtle"
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-[12px] font-bold text-stone-500">{q.id}</span>
                        <span className="text-[11px] text-stone-400">{q.name}</span>
                      </div>
                      <div className="flex items-baseline gap-1 mt-1.5">
                        <span className="font-display text-xl text-stone-900 tabular-nums">{score}</span>
                        <span className="text-[11px] text-stone-300 font-mono">/{max}</span>
                        <span className="text-[11px] text-stone-400 ml-auto tabular-nums">{pct}%</span>
                      </div>
                      <div className="w-full h-1 bg-stone-100 rounded-full overflow-hidden mt-1.5">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.6, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            pct >= 90 ? "bg-stone-800" : pct >= 75 ? "bg-stone-500" : pct >= 50 ? "bg-stone-400" : "bg-red-400"
                          }`}
                        />
                      </div>
                    </button>
                    <AnimatePresence>
                      {isExpanded && data && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: "auto", opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.15 }}
                          className="overflow-hidden"
                        >
                          <div className="mt-1.5 border border-stone-100 rounded-lg p-2.5 space-y-0.5">
                            {data.criteriaScores.map((cs) => (
                              <div key={cs.criterionId} className="flex items-center gap-2">
                                <span className="text-[11px] font-mono text-stone-400 w-5 shrink-0">{cs.criterionId}</span>
                                <span className="text-[11px] text-stone-600 flex-1 min-w-0 truncate">{cs.criterionName}</span>
                                <span className="text-[11px] font-mono text-stone-400 shrink-0">{cs.score}/{cs.maxPoints}</span>
                              </div>
                            ))}
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
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-4">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Quadrant Scores</span>
          <p className="text-sm text-stone-300 mt-2">No scores yet</p>
        </div>
      )}
    </div>
  );
}

/* --- Flow Tab --- */

function FlowTabContent({ flowMapData }: { flowMapData: React.ComponentProps<typeof FlowMapTable>["steps"] }) {
  if (flowMapData.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-8 text-center">
        <p className="text-sm text-stone-400">Flow map not yet generated</p>
      </div>
    );
  }
  return <FlowMapTable steps={flowMapData} />;
}

/* --- Custom Tab --- */

type CustomRecommendation = {
  _id: string;
  issue: string;
  recommendedFix: string;
  component: string;
  slideNumber?: number;
  sourceAttribution?: string;
  agentName?: string;
  source?: string;
  createdAt: string;
};

function CustomTabContent({
  moduleId,
  version,
  sourceFiles,
  slides,
  recommendations,
}: {
  moduleId: string;
  version: number;
  sourceFiles?: { type: string; label: string }[];
  slides: { slideNumber: number; sourceFile?: string }[];
  recommendations: CustomRecommendation[];
}) {
  const addCustomReview = useMutation(api.recommendations.addCustomReview);
  const customRecs = recommendations.filter((r) => r.source === "reviewer");

  const handleSubmit = async (data: {
    issue: string;
    recommendedFix: string;
    slideNumber?: number;
    component: string;
  }) => {
    await addCustomReview({
      moduleId,
      version,
      issue: data.issue,
      recommendedFix: data.recommendedFix,
      component: data.component,
      slideNumber: data.slideNumber,
      reviewerName: "Vinay",
    });
  };

  const componentLabel = (component: string) => {
    if (component === "module") return "Module-wide";
    if (component === "spine") return "Spine";
    const match = component.match(/^applet_(\d+)$/);
    if (match) return `Applet ${match[1]}`;
    return component;
  };

  return (
    <div className="space-y-3">
      <CustomReviewForm
        sourceFiles={sourceFiles}
        slides={slides}
        onSubmit={handleSubmit}
      />

      {customRecs.length > 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
          <h3 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em] mb-3">
            Custom Reviews ({customRecs.length})
          </h3>
          <div className="space-y-2">
            {customRecs.map((r) => (
              <div
                key={r._id}
                className="border border-stone-200 rounded-lg border-l-2 border-l-stone-600 bg-white px-3 py-2.5"
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-[11px] font-medium text-stone-500 flex items-center gap-1.5">
                    <span className="w-1 h-1 rounded-full bg-stone-500" />
                    {componentLabel(r.component)}
                    {r.slideNumber != null && (
                      <span className="font-mono text-stone-400"> &middot; Slide {r.slideNumber}</span>
                    )}
                  </span>
                  <span className="text-[11px] text-stone-300 ml-auto">
                    {r.sourceAttribution ?? r.agentName}
                  </span>
                </div>
                <p className="text-[13px] text-stone-700 leading-relaxed">{r.issue}</p>
                {r.recommendedFix && (
                  <p className="text-[13px] text-stone-500 mt-1 leading-relaxed">
                    <span className="font-medium text-stone-400">Fix:</span> {r.recommendedFix}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-8 text-center">
          <p className="text-sm text-stone-400">No custom reviews yet</p>
        </div>
      )}
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
  source?: string;
  agentName?: string;
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
  const globalRecs = recommendations.filter((r) => r.slideNumber == null && r.source !== "reviewer");
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
