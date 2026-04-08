"use client";

import { useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import CustomReviewForm from "./CustomReviewForm";

type SourceFile = { type: string; label: string };
type Slide = { slideNumber: number; sourceFile?: string };

type CustomRec = {
  _id: string;
  issue: string;
  recommendedFix: string;
  component: string;
  slideNumber?: number;
  sourceAttribution?: string;
  reviewStatus: string;
  source?: string;
  createdAt: string;
};

function componentLabel(component: string): { label: string; color: string } {
  if (component === "module") return { label: "Module-wide", color: "bg-stone-100 text-stone-600 border-stone-200" };
  if (component === "spine") return { label: "Spine", color: "bg-sky-100 text-sky-700 border-sky-200" };
  const match = component.match(/^applet_(\d+)$/);
  if (match) return { label: `Applet ${match[1]}`, color: "bg-violet-100 text-violet-700 border-violet-200" };
  return { label: component, color: "bg-stone-100 text-stone-600 border-stone-200" };
}

function statusChip(reviewStatus: string) {
  const map: Record<string, { label: string; cls: string }> = {
    pending:  { label: "Pending",  cls: "bg-amber-100 text-amber-800 border-amber-200" },
    accepted: { label: "Accepted", cls: "bg-emerald-100 text-emerald-800 border-emerald-200" },
    rejected: { label: "Rejected", cls: "bg-red-100 text-red-700 border-red-200" },
  };
  const { label, cls } = map[reviewStatus] ?? { label: reviewStatus, cls: "bg-stone-100 text-stone-600 border-stone-200" };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-medium border ${cls}`}>
      {label}
    </span>
  );
}

interface CustomRecsPanelProps {
  moduleId: string;
  version: number;
  sourceFiles?: SourceFile[];
  slides: Slide[];
  recommendations: CustomRec[];
  readOnly?: boolean;
  /** If true, the add form opens automatically */
  autoOpenForm?: boolean;
  onFormClosed?: () => void;
}

export default function CustomRecsPanel({
  moduleId,
  version,
  sourceFiles,
  slides,
  recommendations,
  readOnly = false,
  autoOpenForm = false,
  onFormClosed,
}: CustomRecsPanelProps) {
  const addCustomReview = useMutation(api.recommendations.addCustomReview);
  const softDelete = useMutation(api.recommendations.softDeleteRecommendation);
  const formRef = useRef<HTMLDivElement>(null);

  const customRecs = recommendations.filter((r) => r.source === "reviewer");

  // Auto-scroll to form when it opens
  useEffect(() => {
    if (autoOpenForm && formRef.current) {
      formRef.current.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, [autoOpenForm]);

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
    onFormClosed?.();
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this custom recommendation? This cannot be undone.")) return;
    await softDelete({ recommendationId: id as Id<"recommendations"> });
  };

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-[15px] font-semibold text-stone-800">Custom recommendations</h2>
          <p className="text-[12px] text-stone-400 mt-0.5">
            {customRecs.length > 0
              ? `${customRecs.length} reviewer-added rec${customRecs.length !== 1 ? "s" : ""}`
              : "No custom recs yet"}
          </p>
        </div>
      </div>

      {/* Add form */}
      {!readOnly && (
        <div ref={formRef}>
          <CustomReviewForm
            sourceFiles={sourceFiles}
            slides={slides}
            onSubmit={handleSubmit}
            autoOpen={autoOpenForm}
            onClose={onFormClosed}
          />
        </div>
      )}

      {/* Recs list */}
      <AnimatePresence initial={false}>
        {customRecs.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-2"
          >
            {customRecs.map((r) => {
              const { label, color } = componentLabel(r.component);
              return (
                <motion.div
                  key={r._id}
                  layout
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="group bg-white border border-stone-200 rounded-lg px-4 py-3.5 shadow-subtle"
                >
                  {/* Row 1: scope tag + status + delete */}
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border ${color}`}>
                      {label}
                    </span>
                    {r.slideNumber != null && (
                      <span className="text-[10px] font-mono text-stone-400">
                        Slide {r.slideNumber}
                      </span>
                    )}
                    {statusChip(r.reviewStatus)}
                    <div className="flex-1" />
                    {!readOnly && (
                      <button
                        onClick={() => handleDelete(r._id)}
                        className="opacity-0 group-hover:opacity-100 text-stone-300 hover:text-red-400 transition-all p-0.5 rounded"
                        title="Delete"
                      >
                        <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M2 3.5h9M4.5 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1M5 6v4M8 6v4M3.5 3.5l.5 7a.5.5 0 0 0 .5.5h4a.5.5 0 0 0 .5-.5l.5-7" />
                        </svg>
                      </button>
                    )}
                  </div>

                  {/* Issue */}
                  <p className="text-[13px] text-stone-700 leading-relaxed">{r.issue}</p>

                  {/* Fix */}
                  {r.recommendedFix && (
                    <p className="text-[12px] text-stone-500 mt-1.5 leading-relaxed">
                      <span className="font-medium text-stone-400 mr-1">Fix:</span>
                      {r.recommendedFix}
                    </p>
                  )}
                </motion.div>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {customRecs.length === 0 && (
        <div className="bg-stone-50/50 border border-dashed border-stone-200 rounded-lg py-10 text-center">
          <p className="text-[13px] text-stone-400">No custom recommendations yet.</p>
          {!readOnly && (
            <p className="text-[12px] text-stone-300 mt-1">Use the form above to add your own observations.</p>
          )}
        </div>
      )}
    </div>
  );
}
