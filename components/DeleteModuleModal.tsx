"use client";

import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";

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
  const [mounted, setMounted] = useState(false);
  const deleteMutation = useMutation(api.deleteModule.deleteModule);

  useEffect(() => {
    setMounted(true);
    return () => setMounted(false);
  }, []);

  const handleDelete = async () => {
    setDeleting(true);
    try {
      const result = await deleteMutation({ moduleId, version });
      alert(`Poof! "${title}" and ${result.deleted} child rows have been vaporized.`);
      onClose();
    } catch (err) {
      alert(err instanceof Error ? err.message : "Delete failed");
      setDeleting(false);
    }
  };

  const modal = (
    <div
      className="fixed inset-0 z-[9999] flex items-center justify-center"
      onClick={onClose}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-[2px]" />

      {/* Modal */}
      <div
        className="relative bg-white rounded-2xl shadow-2xl border border-gray-200/80 max-w-[420px] w-full mx-4 overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Red gradient top accent */}
        <div className="h-1 bg-gradient-to-r from-red-400 via-red-500 to-orange-400" />

        <div className="p-7">
          {/* Icon + Header */}
          <div className="text-center mb-5">
            <div className="w-16 h-16 rounded-full bg-red-50 border-2 border-red-100 flex items-center justify-center mx-auto mb-4">
              <svg className="w-8 h-8 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-gray-900 leading-tight">You sure about this, chief?</h2>
          </div>

          {/* Module info card */}
          <div className="bg-gray-50 rounded-xl border border-gray-200/80 px-4 py-3 mb-4">
            <div className="text-sm font-semibold text-gray-900 leading-snug">{title}</div>
            <div className="text-[11px] text-gray-400 mt-0.5 font-mono">Version {version}</div>
          </div>

          {/* Warning text */}
          <p className="text-[13px] text-gray-500 text-center leading-relaxed mb-6">
            All slides, scores, recommendations, flow maps, and gate checks will be permanently deleted.
            <span className="block text-[11px] text-gray-400 mt-1.5">The agents will never know it existed. No undo.</span>
          </p>

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2.5 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition-colors border border-gray-200/80"
            >
              Nah, let it live
            </button>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="flex-1 px-4 py-2.5 bg-red-600 text-white rounded-xl text-sm font-medium hover:bg-red-700 disabled:opacity-50 transition-all shadow-sm border border-red-700/20"
            >
              {deleting ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                  </svg>
                  Vaporizing...
                </span>
              ) : (
                "Yeet it into the void"
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );

  if (!mounted) return null;
  return createPortal(modal, document.body);
}
