"use client";

import { useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import StageBadge from "@/components/StageBadge";
import ScoreBandBadge from "@/components/ScoreBandBadge";
import FixDirectiveSection from "@/components/FixDirectiveSection";
import { CATEGORIES } from "@/lib/types";

type Tab = "overview" | "directives";

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;
  const [activeTab, setActiveTab] = useState<Tab>("overview");

  const moduleData = useQuery(api.modules.detail, { moduleId });
  const reviewScores = useQuery(
    api.reviewScores.byModule,
    moduleData ? { moduleId, version: moduleData.version } : "skip"
  );
  const directives = useQuery(
    api.fixDirectives.byModule,
    moduleData ? { moduleId, version: moduleData.version } : "skip"
  );
  const gatekeeperData = useQuery(
    api.gatekeeperQuery.byModule,
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

  const directiveCount = directives?.length ?? 0;
  const pendingCount = directives?.filter((d) => d.reviewStatus === "pending").length ?? 0;

  // Build category map from all review passes
  const categoryMap = new Map<string, { score: number; max: number }>();
  const passTotals: { pass: string; score: number; max: number; pct: number }[] = [];
  if (reviewScores) {
    for (const rs of reviewScores) {
      for (const cs of rs.categoryScores) {
        categoryMap.set(cs.categoryId, { score: cs.score, max: cs.maxPoints });
      }
      passTotals.push({
        pass: rs.reviewPass,
        score: rs.totalPoints,
        max: rs.maxPoints,
        pct: Math.round((rs.totalPoints / rs.maxPoints) * 100),
      });
    }
  }

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between py-3">
            <div className="flex items-center gap-4">
              <Link href="/board" className="text-gray-300 hover:text-gray-500 transition-colors">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
                </svg>
              </Link>
              <div>
                <h1 className="text-[15px] font-semibold text-gray-900 tracking-tight leading-tight">
                  {moduleData.title}
                </h1>
                <div className="flex items-center gap-2 mt-0.5">
                  <StageBadge status={moduleData.status} />
                  <span className="text-[11px] text-gray-300 font-mono">v{moduleData.version}</span>
                  <span className="text-[11px] text-gray-300">Grade {moduleData.grade}</span>
                </div>
              </div>
            </div>
            {moduleData.overallPercentage != null && (
              <div className="flex items-center gap-3">
                <div className="text-right">
                  <div className="text-3xl font-bold text-gray-900 tabular-nums tracking-tight leading-none">
                    {moduleData.overallPercentage}%
                  </div>
                  <div className="text-[11px] text-gray-300 font-mono mt-0.5">{moduleData.overallScore}/120</div>
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
              active={activeTab === "directives"}
              onClick={() => setActiveTab("directives")}
              badge={pendingCount > 0 ? pendingCount : undefined}
            >
              Fix Directives
              {directiveCount > 0 && <span className="text-gray-300 ml-1">{directiveCount}</span>}
            </TabButton>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-[1400px] mx-auto px-6 py-4">
        {activeTab === "overview" ? (
          <OverviewContent
            moduleData={moduleData}
            categoryMap={categoryMap}
            passTotals={passTotals}
            gatekeeperData={gatekeeperData ?? null}
          />
        ) : (
          directives && directives.length > 0 ? (
            <FixDirectiveSection directives={directives} moduleId={moduleId} version={moduleData.version} />
          ) : (
            <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-12 text-center">
              <p className="text-sm text-gray-400">No fix directives yet</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

/* ─── Tab Button ─── */
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

/* ─── Overview — Single-fold dashboard ─── */

const TIER1_THRESHOLD = 0.7;
const PASS_LABELS: Record<string, { label: string; icon: string }> = {
  designer: { label: "Designer", icon: "D" },
  teacher: { label: "Teacher", icon: "T" },
  student: { label: "Student", icon: "S" },
};

function OverviewContent({
  moduleData,
  categoryMap,
  passTotals,
  gatekeeperData,
}: {
  moduleData: {
    learningObjective: string;
    tier1AllPassed?: boolean;
  };
  categoryMap: Map<string, { score: number; max: number }>;
  passTotals: { pass: string; score: number; max: number; pct: number }[];
  gatekeeperData: {
    passed: boolean;
    ruleResults: { ruleId: string; ruleName: string; passed: boolean; evidence?: string }[];
  } | null;
}) {
  const tier1Cats = CATEGORIES.filter((c) => c.tier === "tier1");

  return (
    <div className="space-y-3">
      {/* Row 1: Tier 1 Gates + Review Passes */}
      <div className="grid grid-cols-12 gap-3">
        {/* Tier 1 Gates — the most critical info */}
        <div className="col-span-7 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tier 1 Gates</span>
            {moduleData.tier1AllPassed != null && (
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-md ${
                moduleData.tier1AllPassed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
              }`}>
                {moduleData.tier1AllPassed ? "All passed" : "Below threshold"}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {tier1Cats.map((cat) => {
              const data = categoryMap.get(cat.id);
              const pct = data ? data.score / data.max : 0;
              const passed = data ? pct >= TIER1_THRESHOLD : false;
              const status = data ? (passed ? "pass" : "fail") : "pending";
              return (
                <div
                  key={cat.id}
                  className={`rounded-lg border px-2.5 py-2 ${
                    status === "pass" ? "border-emerald-200 bg-emerald-50/40"
                      : status === "fail" ? "border-red-200 bg-red-50/40"
                      : "border-gray-200 bg-gray-50/40"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-gray-500 leading-tight line-clamp-1">{cat.name}</span>
                    <span className={`text-[10px] ml-1 shrink-0 ${
                      status === "pass" ? "text-emerald-500" : status === "fail" ? "text-red-400" : "text-gray-300"
                    }`}>
                      {status === "pass" ? "\u2713" : status === "fail" ? "\u2717" : ""}
                    </span>
                  </div>
                  <div className={`text-[13px] font-bold tabular-nums mt-0.5 ${
                    status === "pass" ? "text-emerald-600" : status === "fail" ? "text-red-500" : "text-gray-300"
                  }`}>
                    {data ? `${data.score}/${data.max}` : "\u2014"}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Review Passes */}
        <div className="col-span-5 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Review Passes</span>
          {passTotals.length > 0 ? (
            <div className="mt-2.5 space-y-2.5">
              {passTotals.map((p) => {
                const info = PASS_LABELS[p.pass] || { label: p.pass, icon: "?" };
                return (
                  <div key={p.pass} className="flex items-center gap-3">
                    <span className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${
                      p.pct >= 70 ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                    }`}>{info.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between mb-0.5">
                        <span className="text-[13px] font-medium text-gray-600">{info.label}</span>
                        <span className="text-[12px] font-mono text-gray-400 tabular-nums">
                          {p.score}/{p.max} <span className="text-gray-300">({p.pct}%)</span>
                        </span>
                      </div>
                      <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${p.pct >= 85 ? "bg-emerald-400" : p.pct >= 70 ? "bg-amber-400" : "bg-red-400"}`}
                          style={{ width: `${p.pct}%` }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="text-sm text-gray-300 mt-3">No reviews yet</div>
          )}
        </div>
      </div>

      {/* Row 2: LO + Gatekeeper */}
      <div className="grid grid-cols-12 gap-3">
        {/* Learning Objective */}
        <div className="col-span-5 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Learning Objective</span>
          <p className="text-[13px] text-gray-600 leading-relaxed mt-2">{moduleData.learningObjective}</p>
        </div>

        {/* Gatekeeper — compact inline */}
        <div className="col-span-7 bg-white rounded-xl border border-gray-200/80 shadow-sm p-4">
          <div className="flex items-center justify-between mb-2.5">
            <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Gatekeeper Rules</span>
            {gatekeeperData && (
              <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
                gatekeeperData.passed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
              }`}>
                {gatekeeperData.passed ? "PASSED" : "FAILED"}
              </span>
            )}
          </div>
          {gatekeeperData ? (
            <div className="grid grid-cols-2 gap-x-4 gap-y-1">
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
            <p className="text-sm text-gray-300">Not yet checked</p>
          )}
        </div>
      </div>

      {/* Row 3: All 12 categories */}
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <span className="text-xs font-semibold text-gray-400 uppercase tracking-wider">All 12 Categories</span>
        <div className="grid grid-cols-6 gap-2.5 mt-3">
          {CATEGORIES.map((cat) => {
            const data = categoryMap.get(cat.id);
            const pct = data ? Math.round((data.score / data.max) * 100) : undefined;
            const barColor = pct === undefined ? "bg-gray-100" : pct >= 85 ? "bg-emerald-400" : pct >= 70 ? "bg-amber-400" : pct >= 50 ? "bg-orange-400" : "bg-red-400";
            return (
              <div key={cat.id} className="border border-gray-100 rounded-lg p-3">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-gray-500 leading-snug line-clamp-1 flex-1">{cat.name}</span>
                  <span className={`text-[9px] font-bold px-1 py-0.5 rounded ml-1.5 shrink-0 ${
                    cat.tier === "tier1" ? "bg-red-50 text-red-400" : "bg-gray-50 text-gray-300"
                  }`}>
                    {cat.tier === "tier1" ? "T1" : "T2"}
                  </span>
                </div>
                <div className="flex items-baseline gap-1 mt-1.5">
                  <span className="text-lg font-bold text-gray-900 tabular-nums">{data ? data.score : "\u2014"}</span>
                  <span className="text-xs text-gray-300 font-mono">/{cat.maxPoints}</span>
                </div>
                <div className="w-full h-1 bg-gray-100 rounded-full overflow-hidden mt-1.5">
                  <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct ?? 0}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
