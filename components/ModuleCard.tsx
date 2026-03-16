"use client";

import Link from "next/link";
import { ModuleBoardItem } from "@/lib/types";
import ScoreBandBadge from "./ScoreBandBadge";
import StageBadge from "./StageBadge";
import HealthBar from "./HealthBar";

export default function ModuleCard({ module }: { module: ModuleBoardItem }) {
  return (
    <Link href={`/module/${module.moduleId}`}>
      <div className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-md transition-shadow cursor-pointer space-y-2">
        {/* Title + version */}
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-sm font-semibold text-gray-900 leading-tight line-clamp-2">
            {module.title}
          </h3>
          <span className="text-[10px] font-mono text-gray-400 shrink-0">v{module.version}</span>
        </div>

        {/* Stage + health */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <StageBadge status={module.status} />
          <HealthBar updatedAt={module.updatedAt} />
        </div>

        {/* Score info (if available) */}
        {module.overallPercentage !== null && (
          <div className="flex items-center gap-2">
            <span className="text-lg font-bold text-gray-900">
              {module.overallPercentage}%
            </span>
            <ScoreBandBadge band={module.scoreBand} />
          </div>
        )}

        {/* Review pass indicators */}
        {module.column === "In Review" && (
          <div className="flex gap-1.5">
            <PassDot label="D" done={module.designerComplete} />
            <PassDot label="T" done={module.teacherComplete} />
            <PassDot label="S" done={module.studentComplete} />
          </div>
        )}

        {/* Directive counts for Vinay Review */}
        {module.directiveCounts && (
          <div className="text-xs text-gray-500">
            {module.directiveCounts.pending > 0 ? (
              <span>{module.directiveCounts.pending} pending / {module.directiveCounts.total} directives</span>
            ) : (
              <span>All {module.directiveCounts.total} reviewed</span>
            )}
          </div>
        )}

        {/* Grade + submitter */}
        <div className="flex items-center justify-between text-[11px] text-gray-400">
          <span>Grade {module.grade}</span>
          {module.submittedBy && <span>{module.submittedBy}</span>}
        </div>
      </div>
    </Link>
  );
}

function PassDot({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[10px] font-bold ${
        done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-400"
      }`}
    >
      {label}
    </span>
  );
}
