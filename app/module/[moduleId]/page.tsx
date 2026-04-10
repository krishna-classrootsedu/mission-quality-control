"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
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
import ModuleSidebar from "@/components/ModuleSidebar";
import CustomRecsPanel from "@/components/CustomRecsPanel";

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;
  const [activeSection, setActiveSection] = useState("overview");
  const [autoOpenCustomForm, setAutoOpenCustomForm] = useState(false);
  const [decisions, setDecisions] = useState<Map<string, { status: string; comment: string }>>(new Map());
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [selectedVersion, setSelectedVersion] = useState<number | null>(null);
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState("");
  const [titleSaving, setTitleSaving] = useState(false);
  const [titleError, setTitleError] = useState<string | null>(null);
  const me = useQuery(api.users.me);

  const allVersions = useQuery(api.modules.allVersions, me ? { moduleId } : "skip");
  const moduleData = useQuery(
    api.modules.detail,
    me
      ? selectedVersion != null
        ? { moduleId, version: selectedVersion }
        : { moduleId }
      : "skip"
  );
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

  const isCorrectionsVersion = moduleData?.status === "corrections_review_complete" || moduleData?.status === "corrections_intake_complete";
  const prevVersionData = useQuery(
    api.modules.detail,
    moduleData && isCorrectionsVersion && moduleData.version > 1
      ? { moduleId, version: moduleData.version - 1 }
      : "skip"
  );

  // Compute projected corrections score client-side
  const correctionsProjection = useMemo(() => {
    if (!isCorrectionsVersion || !prevVersionData || !recommendations) return null;
    const prevScore = prevVersionData.overallScore ?? 0;
    const checkRecs = recommendations.filter((r: { sourcePass: string }) => r.sourcePass === "corrections_check");
    if (checkRecs.length === 0) return null;
    let recovered = 0;
    let fixedCount = 0;
    let partialCount = 0;
    let notFixedCount = 0;
    for (const r of checkRecs) {
      const pts = (r as { pointsRecoverable?: number }).pointsRecoverable ?? 0;
      const status = (r as { fixStatus?: string }).fixStatus;
      if (status === "fixed") { recovered += pts; fixedCount++; }
      else if (status === "partially_fixed") { recovered += pts * 0.5; partialCount++; }
      else { notFixedCount++; }
    }
    return {
      previousScore: prevScore,
      projectedScore: Math.min(Math.round(prevScore + recovered), 100),
      fixedCount,
      partialCount,
      notFixedCount,
    };
  }, [isCorrectionsVersion, prevVersionData, recommendations]);
  const unexpectedChanges = useQuery(
    api.correctionsDiff.unexpectedChanges,
    moduleData && isCorrectionsVersion && moduleData.version > 1
      ? { moduleId, version: moduleData.version }
      : "skip"
  );

  const reviewMutation = useMutation(api.recommendations.review);
  const completeMutation = useMutation(api.recommendations.completeVinayReview);
  const finalizeCorrections = useMutation(api.modules.finalizeCorrectionsReview);
  const markShipReadyMutation = useMutation(api.modules.markShipReady);
  const updateTitleMutation = useMutation(api.modules.updateTitle);

  useEffect(() => {
    if (moduleData?.title) {
      setEditedTitle(moduleData.title);
      setIsEditingTitle(false);
      setTitleError(null);
    }
  }, [moduleData?.title, moduleData?.version]);

  // Build applet keys for sidebar (same logic as before, now for sidebar rendering)
  const appletKeys = useMemo(() => {
    const keys: { key: string; label: string }[] = [];
    if (moduleData?.sourceFiles) {
      for (const sf of moduleData.sourceFiles) {
        if (sf.type === "applet") {
          const component = sourceFileToComponent(sf.label);
          keys.push({ key: component, label: sf.label.replace(/^A/, "Applet ") });
        }
      }
    } else if (reviewScores) {
      for (const rs of reviewScores) {
        if (rs.reviewPass.startsWith("applet_")) {
          keys.push({ key: rs.reviewPass, label: rs.reviewPass.replace("applet_", "Applet ") });
        }
      }
    }
    return keys;
  }, [moduleData?.sourceFiles, reviewScores]);

  const handleDecisionChange = useCallback(
    (id: string, status: string, comment: string) => {
      setSaveError(null);
      setDecisions((prev) => {
        const next = new Map(prev);
        next.set(id, { status, comment });
        return next;
      });
    },
    []
  );

  const handleSave = async () => {
    const canReview = me?.role === "lead_reviewer" || me?.role === "manager" || me?.role === "admin";
    if (!canReview) {
      alert("Permission denied");
      return;
    }
    const rejectedWithoutComment = Array.from(decisions.values()).filter(
      (d) => d.status === "rejected" && !d.comment.trim()
    ).length;
    if (rejectedWithoutComment > 0) {
      setSaveError(
        `${rejectedWithoutComment} rejected ${
          rejectedWithoutComment === 1 ? "recommendation is" : "recommendations are"
        } missing comment. Add a comment for each rejected item before saving.`
      );
      return;
    }

    setSaveError(null);
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
      setSaveError(null);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Save failed";
      if (msg.includes("Comment is mandatory when rejecting a recommendation.")) {
        setSaveError("Rejected recommendations require a comment before saving.");
      } else {
        setSaveError(msg);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleComplete = async () => {
    const canReview = me?.role === "lead_reviewer" || me?.role === "manager" || me?.role === "admin";
    if (!canReview) {
      alert("Permission denied");
      return;
    }
    if (!moduleData) return;
    try {
      if (moduleData.status === "corrections_review_complete") {
        const result = await finalizeCorrections({ moduleId, version: moduleData.version });
        alert(
          `Corrections review complete!\n` +
          `Previous score: ${result.previousScore}/100\n` +
          `Recovered: +${result.recoveredPoints} pts\n` +
          `New score: ${result.newScore}/100 (${result.scoreBand})\n` +
          `Fixed: ${result.fixedCount} | Partial: ${result.partialCount} | Not fixed: ${result.notFixedCount}`
        );
      } else {
        const result = await completeMutation({ moduleId, version: moduleData.version });
        alert(`Review complete! ${result.accepted} accepted, ${result.rejected} rejected.`);
      }
    } catch (err) {
      alert(err instanceof Error ? err.message : "Complete failed");
    }
  };

  const handleMarkShipReady = async () => {
    if (me?.role !== "manager" && me?.role !== "admin") {
      alert("Only managers or admins can mark a module ship-ready");
      return;
    }
    if (!moduleData) return;
    try {
      await markShipReadyMutation({ moduleId, version: moduleData.version });
      alert("Module marked ship-ready.");
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to mark module ship-ready");
    }
  };

  const handleSaveTitle = async () => {
    if (!moduleData) return;
    const trimmed = editedTitle.trim();
    if (!trimmed) {
      setTitleError("Title cannot be empty.");
      return;
    }
    if (trimmed === moduleData.title) {
      setIsEditingTitle(false);
      setTitleError(null);
      return;
    }
    setTitleSaving(true);
    setTitleError(null);
    try {
      await updateTitleMutation({ moduleId, version: moduleData.version, title: trimmed });
      setIsEditingTitle(false);
    } catch (err) {
      setTitleError(err instanceof Error ? err.message : "Failed to update title");
    } finally {
      setTitleSaving(false);
    }
  };

  // Pending badge counts per section key (agent recs only, not custom)
  const pendingBadges = useMemo(() => {
    if (!recommendations) return {};
    const badges: Record<string, number> = {};
    for (const r of recommendations) {
      if (r.reviewStatus !== "pending") continue;
      if (r.source === "reviewer") continue; // custom recs tracked separately
      if (r.component === "module") {
        badges["global"] = (badges["global"] ?? 0) + 1;
      } else {
        badges[r.component] = (badges[r.component] ?? 0) + 1;
      }
    }
    return badges;
  }, [recommendations]);

  // Total custom recs count (for sidebar badge)
  const customRecCount = useMemo(() => {
    if (!recommendations) return 0;
    return recommendations.filter((r) => r.source === "reviewer").length;
  }, [recommendations]);

  if (me === undefined || moduleData === undefined) {
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

  if (me === null) {
    return (
      <div className="h-full flex items-center justify-center">
        <div className="text-stone-500">Sign in required to view this module.</div>
      </div>
    );
  }

  const canReview = me?.role === "lead_reviewer" || me?.role === "manager" || me?.role === "admin";
  const canEditTitle = me?.role === "manager" || me?.role === "admin";
  const canPrivilegedMarkShipReady =
    (me?.role === "manager" || me?.role === "admin") &&
    ["review_complete", "vinay_reviewed", "corrections_intake_complete", "corrections_review_complete"].includes(
      moduleData.status
    );
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
              <div className="flex items-center gap-2">
                {isEditingTitle ? (
                  <>
                    <input
                      value={editedTitle}
                      onChange={(e) => setEditedTitle(e.target.value)}
                      className="text-lg font-semibold text-stone-800 tracking-tight leading-tight border border-stone-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-stone-400"
                      maxLength={120}
                      autoFocus
                    />
                    <button
                      onClick={handleSaveTitle}
                      disabled={titleSaving}
                      className="text-xs px-2 py-1 rounded bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60"
                    >
                      {titleSaving ? "Saving..." : "Save"}
                    </button>
                    <button
                      onClick={() => {
                        setIsEditingTitle(false);
                        setEditedTitle(moduleData.title);
                        setTitleError(null);
                      }}
                      disabled={titleSaving}
                      className="text-xs px-2 py-1 rounded border border-stone-300 text-stone-600 hover:bg-stone-50 disabled:opacity-60"
                    >
                      Cancel
                    </button>
                  </>
                ) : (
                  <>
                    <h1 className="text-lg font-semibold text-stone-800 tracking-tight leading-tight">
                      {moduleData.title}
                    </h1>
                    {canEditTitle && (
                      <button
                        onClick={() => setIsEditingTitle(true)}
                        className="text-stone-400 hover:text-stone-700 transition-colors"
                        title="Edit title"
                      >
                        <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 20h9" />
                          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 3.5a2.121 2.121 0 013 3L7 19l-4 1 1-4 12.5-12.5z" />
                        </svg>
                      </button>
                    )}
                  </>
                )}
              </div>
              {titleError && (
                <p className="text-[11px] text-red-600 mt-1">{titleError}</p>
              )}
              <div className="flex items-center gap-2 mt-0.5">
                <StageBadge status={moduleData.status} />
                {allVersions && allVersions.length > 1 ? (
                  <select
                    value={moduleData.version}
                    onChange={(e) => {
                      const v = parseInt(e.target.value);
                      setSelectedVersion(v);
                      setDecisions(new Map());
                    }}
                    className="text-[11px] text-stone-400 font-mono bg-transparent border border-stone-200 rounded px-1.5 py-0.5 focus:outline-none focus:ring-1 focus:ring-stone-300"
                  >
                    {allVersions.map((av) => (
                      <option key={av.version} value={av.version}>v{av.version}</option>
                    ))}
                  </select>
                ) : (
                  <span className="text-[11px] text-stone-400 font-mono">v{moduleData.version}</span>
                )}
                <span className="text-[11px] text-stone-400">G{moduleData.grade}</span>
                {moduleData.chapterNumber != null && (
                  <span className="text-[11px] text-stone-400">
                    Ch{moduleData.chapterNumber}{moduleData.chapterName ? ` — ${moduleData.chapterName}` : ""}
                  </span>
                )}
                {moduleData.moduleNumber != null && (
                  <span className="text-[11px] text-stone-400">M{moduleData.moduleNumber}</span>
                )}
              </div>
            </div>
            <div className="flex items-center gap-3">
              {canPrivilegedMarkShipReady && (
                <button
                  onClick={handleMarkShipReady}
                  className="px-4 py-2 bg-emerald-700 text-white rounded-lg text-sm font-medium hover:bg-emerald-800 transition-all"
                >
                  Mark it Ship Ready
                </button>
              )}
              {correctionsProjection ? (
                <div className="text-right">
                  <div className="flex items-center gap-2 justify-end">
                    <span className="font-display text-2xl text-stone-400 leading-none">
                      {correctionsProjection.previousScore}<span className="text-xl">%</span>
                    </span>
                    <span className="text-stone-300">&rarr;</span>
                    <span className="font-display text-4xl text-stone-900 leading-none">
                      {correctionsProjection.projectedScore}<span className="text-3xl">%</span>
                    </span>
                  </div>
                  <div className="flex items-center gap-2.5 justify-end mt-1">
                    <span className="text-[10px] text-stone-400">projected</span>
                    <span className="text-[10px] font-mono text-stone-500">
                      {correctionsProjection.fixedCount > 0 && `${correctionsProjection.fixedCount} fixed`}
                      {correctionsProjection.fixedCount > 0 && correctionsProjection.partialCount > 0 && " · "}
                      {correctionsProjection.partialCount > 0 && `${correctionsProjection.partialCount} partial`}
                      {(correctionsProjection.fixedCount > 0 || correctionsProjection.partialCount > 0) && correctionsProjection.notFixedCount > 0 && " · "}
                      {correctionsProjection.notFixedCount > 0 && <span className="text-red-400">{correctionsProjection.notFixedCount} not fixed</span>}
                    </span>
                  </div>
                </div>
              ) : moduleData.overallPercentage != null ? (
                <>
                  <div className="text-right">
                    <div className="font-display text-4xl text-stone-900 leading-none">
                      {moduleData.overallPercentage}<span className="text-3xl">%</span>
                    </div>
                    <div className="text-[11px] text-stone-400 font-mono mt-0.5">{moduleData.overallScore}/100</div>
                  </div>
                  <ScoreBandBadge band={moduleData.scoreBand ?? null} />
                </>
              ) : null}
            </div>
          </div>

        </div>
      </div>

      {/* Unexpected changes warning */}
      {unexpectedChanges?.hasUnexpectedChanges && (
        <div className="bg-amber-50 border-b border-amber-200/60 px-6 py-2.5 flex-shrink-0">
          <div className="max-w-[1400px] mx-auto flex items-start gap-2.5">
            <span className="text-amber-600 text-sm mt-0.5 shrink-0">!</span>
            <div>
              <span className="text-[12px] font-semibold text-amber-700">Unexpected changes detected</span>
              <p className="text-[12px] text-amber-600 mt-0.5 leading-relaxed">
                {unexpectedChanges.summary} Consider a full re-review if these changes are significant.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Two-column body: Sidebar + Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <ModuleSidebar
          activeSection={activeSection}
          onSectionChange={(s) => {
            setActiveSection(s);
            setAutoOpenCustomForm(false);
          }}
          sourceFiles={moduleData.sourceFiles}
          pendingBadges={pendingBadges}
          customRecCount={customRecCount}
          canReview={canReview}
          onAddCustomRec={() => {
            setActiveSection("custom");
            setAutoOpenCustomForm(true);
          }}
        />

        {/* Main content area */}
        <main className="flex-1 overflow-y-auto min-w-0">
          <div className="max-w-[960px] mx-auto px-6 py-4 pb-24">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeSection}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {activeSection === "overview" ? (
                  <OverviewContent
                    moduleData={moduleData}
                    reviewScores={reviewScores ?? []}
                    allGateResults={allGateResults ?? []}
                  />
                ) : activeSection === "flow" ? (
                  <FlowTabContent flowMapData={flowMapData ?? []} />
                ) : activeSection === "custom" ? (
                  <CustomRecsPanel
                    moduleId={moduleId}
                    version={moduleData.version}
                    sourceFiles={moduleData.sourceFiles}
                    slides={slidesWithUrls ?? []}
                    recommendations={recommendations ?? []}
                    readOnly={!canReview}
                    autoOpenForm={autoOpenCustomForm}
                    onFormClosed={() => setAutoOpenCustomForm(false)}
                  />
                ) : activeSection === "global" ? (
                  <GlobalContent
                    moduleData={moduleData}
                    reviewScores={reviewScores ?? []}
                    recommendations={recommendations ?? []}
                    decisions={decisions}
                    onDecisionChange={handleDecisionChange}
                    readOnly={!canReview}
                  />
                ) : activeSection === "spine" ? (
                  <SpineTabContent
                    reviewScores={reviewScores ?? []}
                    gatekeeperData={(allGateResults ?? []).find((g) => g.component === "module") ?? null}
                    slides={slidesWithUrls ?? []}
                    recommendations={recommendations ?? []}
                    decisions={decisions}
                    onDecisionChange={handleDecisionChange}
                    readOnly={!canReview}
                  />
                ) : activeSection.startsWith("applet_") ? (
                  <AppletTabContent
                    appletKey={activeSection}
                    appletLabel={appletKeys.find((t) => t.key === activeSection)?.label ?? activeSection}
                    reviewScores={reviewScores ?? []}
                    gatekeeperData={(allGateResults ?? []).find((g) => g.component === activeSection) ?? null}
                    slides={slidesWithUrls ?? []}
                    recommendations={recommendations ?? []}
                    decisions={decisions}
                    onDecisionChange={handleDecisionChange}
                    readOnly={!canReview}
                  />
                ) : null}
              </motion.div>
            </AnimatePresence>
          </div>
        </main>
      </div>

      {/* Sticky save bar — reviewers only */}
      {canReview && recCount > 0 && activeSection !== "overview" && (
        <div className="fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-sm border-t border-stone-200/60 shadow-bar px-6 py-3.5 z-20">
          <div className="max-w-[1400px] mx-auto flex items-center justify-between">
            <div className="text-xs text-stone-500 flex items-center gap-3">
              {saveError && (
                <span className="text-red-600 font-medium">{saveError}</span>
              )}
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
                  {moduleData?.status === "corrections_review_complete"
                    ? "Complete Corrections Review"
                    : "Complete Review"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/* --- Overview Section --- */

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

/* --- Global Section --- */

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
  readOnly = false,
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
  readOnly?: boolean;
}) {
  const globalRecs = recommendations.filter((r) => r.component === "module" && r.source !== "reviewer");
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
                  readOnly={readOnly}
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
