"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { ModuleBoardItem } from "@/lib/types";
import ScoreBandBadge from "./ScoreBandBadge";
import StageBadge from "./StageBadge";
import HealthBar from "./HealthBar";
import DeleteModuleModal from "./DeleteModuleModal";

export default function ModuleCard({ module, index = 0 }: { module: ModuleBoardItem; index?: number }) {
  const [showDelete, setShowDelete] = useState(false);
  const me = useQuery(api.users.me);
  const canDelete = me?.role === "manager" || me?.role === "admin";

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 6 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25, delay: index * 0.03, ease: "easeOut" }}
        className="relative group"
      >
        <Link href={`/module/${module.moduleId}`}>
          <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-4 hover:shadow-card hover:border-stone-300 hover:-translate-y-px transition-all cursor-pointer space-y-2.5">
            <div className="flex items-start justify-between gap-2">
              <h3 className="text-[13px] font-semibold text-stone-800 leading-snug line-clamp-1">
                {module.title}
              </h3>
              <span className="text-[11px] font-mono text-stone-400 shrink-0 mt-0.5">v{module.version}</span>
            </div>

            <div className="flex items-center gap-1.5 flex-wrap">
              <StageBadge status={module.status} />
              <HealthBar updatedAt={module.updatedAt} />
            </div>

            {module.overallPercentage !== null && (
              <div className="flex items-center gap-2.5">
                <span className="font-display text-2xl text-stone-900">
                  {module.overallPercentage}%
                </span>
                <ScoreBandBadge band={module.scoreBand} />
              </div>
            )}

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
              <div className="text-[11px] text-stone-400">
                {module.recommendationCounts.pending > 0 ? (
                  <span>{module.recommendationCounts.pending} pending / {module.recommendationCounts.total} recommendations</span>
                ) : (
                  <span className="text-stone-600">All {module.recommendationCounts.total} reviewed</span>
                )}
              </div>
            )}

            <div className="flex items-center justify-between text-[11px] text-stone-400 pt-0.5">
              <span>
                G{module.grade}
                {module.chapterNumber != null && ` · Ch${module.chapterNumber}`}
                {module.moduleNumber != null && ` · M${module.moduleNumber}`}
              </span>
              {module.submittedBy && <span>{module.submittedBy}</span>}
            </div>
          </div>
        </Link>

        {/* Delete button — appears on hover */}
        {canDelete && (
          <button
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setShowDelete(true);
            }}
            className="absolute top-2 right-2 w-7 h-7 flex items-center justify-center opacity-0 group-hover:opacity-100 hover:text-red-500 transition-all text-stone-300"
            title="Delete module"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        )}
      </motion.div>

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
      className={`inline-flex items-center justify-center w-5 h-5 rounded text-[11px] font-bold transition-colors ${
        done ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-300 border border-stone-200"
      }`}
    >
      {label}
    </span>
  );
}
