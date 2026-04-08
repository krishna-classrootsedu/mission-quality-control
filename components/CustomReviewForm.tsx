"use client";

import { useState, useRef, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";

type SourceFile = {
  type: string;
  label: string;
};

type Slide = {
  slideNumber: number;
  sourceFile?: string;
};

type CustomReviewFormProps = {
  /** Available components derived from sourceFiles */
  sourceFiles?: SourceFile[];
  /** All slides for slide number picker */
  slides?: Slide[];
  /** Called on submit */
  onSubmit: (data: {
    issue: string;
    recommendedFix: string;
    slideNumber?: number;
    component: string;
  }) => Promise<void>;
  /** If true, open the form automatically on mount */
  autoOpen?: boolean;
  /** Called when form is closed or cancelled */
  onClose?: () => void;
};

export default function CustomReviewForm({
  sourceFiles,
  slides,
  onSubmit,
  autoOpen = false,
  onClose,
}: CustomReviewFormProps) {
  const [isOpen, setIsOpen] = useState(autoOpen);
  const [issue, setIssue] = useState("");
  const [fix, setFix] = useState("");
  const [component, setComponent] = useState("module");
  const [slideNumber, setSlideNumber] = useState<number | undefined>(undefined);
  const [submitting, setSubmitting] = useState(false);
  const [justSubmitted, setJustSubmitted] = useState(false);
  const issueRef = useRef<HTMLTextAreaElement>(null);

  // Build component options from sourceFiles
  const componentOptions = useMemo(() => {
    const options: { key: string; label: string }[] = [
      { key: "module", label: "Module-wide" },
    ];
    if (sourceFiles) {
      for (const sf of sourceFiles) {
        if (sf.type === "spine") {
          options.push({ key: "spine", label: "Spine" });
        } else if (sf.type === "applet") {
          const match = sf.label.match(/^A(\d+)$/);
          const key = match ? `applet_${match[1]}` : sf.label;
          options.push({ key, label: sf.label.replace(/^A/, "Applet ") });
        }
      }
    }
    return options;
  }, [sourceFiles]);

  // Get slide numbers for the selected component
  const slideNumbers = useMemo(() => {
    if (component === "module" || !slides) return [];
    return slides
      .filter((s) => {
        if (component === "spine") return !s.sourceFile || s.sourceFile === "spine";
        // For applets, match sourceFile label
        const match = component.match(/^applet_(\d+)$/);
        if (match) return s.sourceFile === `A${match[1]}`;
        return false;
      })
      .map((s) => s.slideNumber)
      .sort((a, b) => a - b);
  }, [component, slides]);

  useEffect(() => {
    if (isOpen && issueRef.current) {
      const t = setTimeout(() => issueRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [isOpen]);

  // Reset slide when component changes
  useEffect(() => {
    setSlideNumber(undefined);
  }, [component]);

  const handleSubmit = async () => {
    if (!issue.trim()) return;
    setSubmitting(true);
    try {
      await onSubmit({
        issue: issue.trim(),
        recommendedFix: fix.trim(),
        slideNumber: component === "module" ? undefined : slideNumber,
        component,
      });
      setIssue("");
      setFix("");
      setSlideNumber(undefined);
      setJustSubmitted(true);
      setTimeout(() => {
        setJustSubmitted(false);
        setIsOpen(false);
      }, 1200);
    } catch {
      // Error handling delegated to parent
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = () => {
    setIsOpen(false);
    onClose?.();
    setTimeout(() => {
      setIssue("");
      setFix("");
      setComponent("module");
      setSlideNumber(undefined);
    }, 200);
  };

  return (
    <div className="relative">
      <AnimatePresence mode="wait">
        {!isOpen ? (
          <motion.button
            key="trigger"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.12 }}
            onClick={() => setIsOpen(true)}
            className="w-full group text-left"
          >
            <div className="border border-dashed border-stone-200/80 rounded-lg px-4 py-3 flex items-center gap-3 transition-all hover:border-stone-300 hover:bg-stone-50/50">
              <span className="w-6 h-6 rounded-full border border-stone-200 flex items-center justify-center text-stone-300 group-hover:border-stone-400 group-hover:text-stone-500 transition-colors shrink-0">
                <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="6" y1="2" x2="6" y2="10" />
                  <line x1="2" y1="6" x2="10" y2="6" />
                </svg>
              </span>
              <span className="text-[13px] text-stone-400 group-hover:text-stone-500 transition-colors">
                Add custom review
              </span>
            </div>
          </motion.button>
        ) : justSubmitted ? (
          <motion.div
            key="success"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="border border-stone-200 rounded-lg px-4 py-3.5 bg-stone-50/50 flex items-center gap-2.5"
          >
            <span className="w-5 h-5 rounded-full bg-stone-800 flex items-center justify-center text-white text-[11px] shrink-0">
              &#10003;
            </span>
            <span className="text-[13px] text-stone-600 font-medium">Added</span>
          </motion.div>
        ) : (
          <motion.div
            key="form"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.18, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="border border-stone-200 rounded-lg bg-white shadow-subtle">
              {/* Header */}
              <div className="px-4 py-3 border-b border-stone-100 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-stone-400" />
                  <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">
                    Custom Review
                  </span>
                </div>
                <button
                  onClick={handleCancel}
                  className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors px-1"
                >
                  Cancel
                </button>
              </div>

              <div className="px-4 py-3 space-y-3">
                {/* Component picker */}
                {componentOptions.length > 1 && (
                  <div>
                    <label className="text-[11px] font-medium text-stone-400 block mb-1.5">
                      Applies to
                    </label>
                    <div className="flex flex-wrap gap-1">
                      {componentOptions.map((opt) => (
                        <button
                          key={opt.key}
                          onClick={() => setComponent(opt.key)}
                          className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                            component === opt.key
                              ? "bg-stone-800 text-white"
                              : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Slide picker (when component is not module-wide) */}
                {component !== "module" && slideNumbers.length > 0 && (
                  <div>
                    <label className="text-[11px] font-medium text-stone-400 block mb-1.5">
                      Slide <span className="font-normal text-stone-300">(optional)</span>
                    </label>
                    <div className="flex flex-wrap gap-1">
                      <button
                        onClick={() => setSlideNumber(undefined)}
                        className={`px-2.5 py-1 rounded text-[11px] font-medium transition-all ${
                          slideNumber === undefined
                            ? "bg-stone-800 text-white"
                            : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                        }`}
                      >
                        General
                      </button>
                      {slideNumbers.map((num) => (
                        <button
                          key={num}
                          onClick={() => setSlideNumber(num)}
                          className={`px-2.5 py-1 rounded text-[11px] font-mono font-medium transition-all ${
                            slideNumber === num
                              ? "bg-stone-800 text-white"
                              : "bg-stone-100 text-stone-500 hover:bg-stone-200"
                          }`}
                        >
                          {num}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Issue */}
                <div>
                  <label className="text-[11px] font-medium text-stone-400 block mb-1.5">
                    What did you observe?
                  </label>
                  <textarea
                    ref={issueRef}
                    value={issue}
                    onChange={(e) => setIssue(e.target.value)}
                    placeholder="Describe the issue..."
                    rows={3}
                    className="w-full text-[13px] text-stone-700 leading-relaxed rounded-lg border border-stone-200 px-3 py-2.5 resize-none placeholder:text-stone-300 focus:border-stone-300 focus:ring-1 focus:ring-stone-200 focus:outline-none transition-colors"
                  />
                </div>

                {/* Fix */}
                <div>
                  <label className="text-[11px] font-medium text-stone-400 block mb-1.5">
                    Suggested fix <span className="font-normal text-stone-300">(optional)</span>
                  </label>
                  <textarea
                    value={fix}
                    onChange={(e) => setFix(e.target.value)}
                    placeholder="How should it be fixed..."
                    rows={2}
                    className="w-full text-[13px] text-stone-700 leading-relaxed rounded-lg border border-stone-200 px-3 py-2.5 resize-none placeholder:text-stone-300 focus:border-stone-300 focus:ring-1 focus:ring-stone-200 focus:outline-none transition-colors"
                  />
                </div>
              </div>

              {/* Footer */}
              <div className="px-4 py-3 border-t border-stone-100 flex items-center justify-end gap-2">
                <button
                  onClick={handleCancel}
                  className="px-3.5 py-1.5 text-[13px] text-stone-500 hover:text-stone-700 transition-colors rounded-lg hover:bg-stone-50"
                >
                  Cancel
                </button>
                <button
                  onClick={handleSubmit}
                  disabled={!issue.trim() || submitting}
                  className="px-4 py-1.5 bg-stone-800 text-white text-[13px] font-medium rounded-lg hover:bg-stone-900 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                  {submitting ? "Adding..." : "Add Review"}
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
