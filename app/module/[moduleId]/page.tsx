"use client";

import { useParams } from "next/navigation";
import Link from "next/link";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import StageBadge from "@/components/StageBadge";
import ScoreSummary from "@/components/ScoreSummary";
import CategoryScoreGrid from "@/components/CategoryScoreGrid";
import GatekeeperResults from "@/components/GatekeeperResults";
import FixDirectiveTable from "@/components/FixDirectiveTable";

export default function ModuleDetailPage() {
  const params = useParams();
  const moduleId = params.moduleId as string;

  const module = useQuery(api.modules.detail, { moduleId });
  const reviewScores = useQuery(
    api.reviewScores.byModule,
    module ? { moduleId, version: module.version } : "skip"
  );
  const directives = useQuery(
    api.fixDirectives.byModule,
    module ? { moduleId, version: module.version } : "skip"
  );

  const gatekeeperData = useQuery(
    api.gatekeeperQuery.byModule,
    module ? { moduleId, version: module.version } : "skip"
  );

  if (module === undefined) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-400">Loading module...</div>
      </div>
    );
  }

  if (module === null) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-gray-500">Module not found: {moduleId}</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="px-6 py-3">
          <Link href="/board" className="text-xs text-blue-600 hover:underline mb-1 inline-block">
            ← Back to Board
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-lg font-bold text-gray-900">{module.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StageBadge status={module.status} />
                <span className="text-xs text-gray-400">v{module.version}</span>
                <span className="text-xs text-gray-400">Grade {module.grade}</span>
              </div>
            </div>
            {module.overallPercentage !== null && (
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{module.overallPercentage}%</div>
                <div className="text-xs text-gray-400">{module.overallScore}/120</div>
              </div>
            )}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Learning Objective */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h2 className="text-xs font-semibold text-gray-500 mb-1">Learning Objective</h2>
          <p className="text-sm text-gray-700">{module.learningObjective}</p>
        </div>

        {/* Score Summary */}
        <ScoreSummary
          overallScore={module.overallScore ?? null}
          overallPercentage={module.overallPercentage ?? null}
          scoreBand={module.scoreBand ?? null}
          tier1AllPassed={module.tier1AllPassed ?? null}
          reviewScores={reviewScores ?? []}
        />

        {/* Gatekeeper Results */}
        <GatekeeperResults result={gatekeeperData ?? null} />

        {/* Category Score Grid */}
        <CategoryScoreGrid reviewScores={reviewScores ?? []} />

        {/* Fix Directive Table */}
        {directives && directives.length > 0 && (
          <FixDirectiveTable
            directives={directives}
            moduleId={moduleId}
            version={module.version}
          />
        )}
      </main>
    </div>
  );
}
