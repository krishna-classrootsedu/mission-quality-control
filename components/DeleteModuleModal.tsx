"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { motion } from "framer-motion";

export default function DeleteModuleModal({
  moduleId,
  version,
  title,
  onClose,
}: {
  moduleId: string;
  version: number;
  title: string;
  onClose: () => void;
}) {
  const [deleting, setDeleting] = useState(false);
  const [deleted, setDeleted] = useState<{ count: number } | null>(null);
  const [error, setError] = useState("");
  const [mounted, setMounted] = useState(false);
  const deleteMutation = useMutation(api.deleteModule.deleteModule);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    setError("");
    try {
      const result = await deleteMutation({ moduleId, version });
      setDeleted({ count: result.deleted });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={deleted ? onClose : undefined}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" />

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.15, ease: "easeOut" }}
        className="relative bg-white rounded-lg shadow-elevated border border-stone-200 max-w-[420px] w-full mx-4 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-6">
          {deleted ? (
            <>
              <div className="flex items-start gap-4 mb-5">
                <svg className="w-5 h-5 text-green-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
                <div>
                  <h2 className="text-[15px] font-semibold text-stone-800">Module deleted</h2>
                  <p className="text-[13px] text-stone-500 mt-1 leading-relaxed">
                    Removed &ldquo;{title}&rdquo; and {deleted.count} related records including stored files.
                  </p>
                </div>
              </div>
              <div className="flex justify-end">
                <button
                  onClick={onClose}
                  className="px-4 py-2 bg-stone-900 text-white rounded-lg text-[13px] font-medium hover:bg-stone-800 transition-all"
                >
                  Done
                </button>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-start gap-4 mb-5">
                <svg className="w-5 h-5 text-stone-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                </svg>
                <div>
                  <h2 className="text-[15px] font-semibold text-stone-800">Delete this module?</h2>
                  <p className="text-[13px] text-stone-500 mt-1 leading-relaxed">
                    All slides, scores, recommendations, flow maps, gate checks, and stored files will be permanently deleted.
                  </p>
                </div>
              </div>

              <div className="bg-stone-50 rounded-lg border border-stone-200 px-4 py-3 mb-5">
                <div className="text-[13px] font-medium text-stone-800">{title}</div>
                <div className="text-[11px] text-stone-400 mt-0.5 font-mono">Version {version}</div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 mb-4 text-[11px] text-red-700">{error}</div>
              )}

              <div className="flex gap-3 justify-end">
                <button
                  onClick={onClose}
                  disabled={deleting}
                  className="px-4 py-2 text-[13px] font-medium text-stone-600 hover:text-stone-800 disabled:opacity-40 transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="px-4 py-2 bg-red-600 text-white rounded-lg text-[13px] font-medium hover:bg-red-700 disabled:opacity-50 transition-all"
                >
                  {deleting ? "Deleting..." : "Delete permanently"}
                </button>
              </div>
            </>
          )}
        </div>
      </motion.div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
