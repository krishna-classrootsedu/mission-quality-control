"use client";

import { useState } from "react";
import Link from "next/link";
import { ModuleBoardItem } from "@/lib/types";
import ScoreBandBadge from "./ScoreBandBadge";
import StageBadge from "./StageBadge";
import HealthBar from "./HealthBar";
import DeleteModuleModal from "./DeleteModuleModal";

export default function ModuleCard({ module }: { module: ModuleBoardItem }) {
  const [showDelete, setShowDelete] = useState(false);

  return (
    <>
      <div className="relative group">
        <Link href={`/module/${module.moduleId}`}>
          <div className="bg-white rounded-xl border border-gray-200/80 p-4 hover:shadow-md hover:border-gray-300/80 transition-all cursor-pointer space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-sm font-semibold text-gray-900 leading-snug line-clamp-2 group-hover:text-gray-700 transition-colors">
                {module.title}
              </h3>
              <span className="text-[11px] font-mono text-gray-400 shrink-0 mt-0.5">v{module.version}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <StageBadge status={module.status} />
              <HealthBar updatedAt={module.updatedAt} />
            </div>

            {module.overallPercentage !== null && (
              <div className="flex items-center gap-2.5">
                <span className="text-xl font-bold text-gray-900 tabular-nums">
                  {module.overallPercentage}%
                </span>
                <ScoreBandBadge band={module.scoreBand} />
              </div>
            )}

            {/* Spine + applet completion indicators */}
            {(module.spineComplete || module.totalApplets > 0) && (
              <div className="flex gap-1.5">
                <CompletionDot label="S" done={module.spineComplete} title="Spine" />
                {Array.from({ length: module.totalApplets }, (_, i) => (
                  <CompletionDot
                    key={i}
                    label={`A${i + 1}`}
                    done={i < module.completedAppletReviews}
                    title={`Applet ${i + 1}`}
                  />
                ))}
              </div>
            )}

            {module.recommendationCounts && (
              <div className="text-[11px] text-gray-400">
                {module.recommendationCounts.pending > 0 ? (
                  <span>{module.recommendationCounts.pending} pending / {module.recommendationCounts.total} recommendations</span>
                ) : (
                  <span className="text-emerald-500">All {module.recommendationCounts.total} reviewed</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-gray-400 pt-0.5">
              <span>Grade {module.grade}</span>
              {module.submittedBy && <span>{module.submittedBy}</span>}
            </div>
          </div>
        </Link>

        {/* Delete button — appears on hover */}
        <button
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            setShowDelete(true);
          }}
          className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-white/80 border border-gray-200/80 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:border-red-200 hover:text-red-500 transition-all text-gray-400 shadow-sm"
          title="Delete module"
        >
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {showDelete && (
        <DeleteModuleModal
          moduleId={module.moduleId}
          version={module.version}
          title={module.title}
          onClose={() => setShowDelete(false)}
        />
      )}
    </>
  );
}

function CompletionDot({ label, done, title }: { label: string; done: boolean; title: string }) {
  return (
    <span
      title={title}
      className={`inline-flex items-center justify-center px-1.5 h-5 rounded-full text-[10px] font-bold transition-colors ${
        done ? "bg-emerald-100 text-emerald-700" : "bg-gray-100 text-gray-300"
      }`}
    >
      {label}
    </span>
  );
}
