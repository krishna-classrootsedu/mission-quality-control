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
        <div className="text-gray-400">Loading module...</div>
      </div>
    );
  }

  if (moduleData === null) {
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
              <h1 className="text-lg font-bold text-gray-900">{moduleData.title}</h1>
              <div className="flex items-center gap-2 mt-1">
                <StageBadge status={moduleData.status} />
                <span className="text-xs text-gray-400">v{moduleData.version}</span>
                <span className="text-xs text-gray-400">Grade {moduleData.grade}</span>
              </div>
            </div>
            {moduleData.overallPercentage !== null && (
              <div className="text-right">
                <div className="text-3xl font-bold text-gray-900">{moduleData.overallPercentage}%</div>
                <div className="text-xs text-gray-400">{moduleData.overallScore}/120</div>
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
          <p className="text-sm text-gray-700">{moduleData.learningObjective}</p>
        </div>

        {/* Score Summary */}
        <ScoreSummary
          overallScore={moduleData.overallScore ?? null}
          overallPercentage={moduleData.overallPercentage ?? null}
          scoreBand={moduleData.scoreBand ?? null}
          tier1AllPassed={moduleData.tier1AllPassed ?? null}
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
            version={moduleData.version}
          />
        )}
      </main>
    </div>
  );
}
