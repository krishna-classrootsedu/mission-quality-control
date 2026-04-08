"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ModuleBoardItem } from "@/lib/types";
import TrackerRow from "./TrackerRow";

interface TrackerChapterGroupProps {
  chapterName: string;
  modules: ModuleBoardItem[];
  storageKey: string;
}

export default function TrackerChapterGroup({
  chapterName,
  modules,
  storageKey,
}: TrackerChapterGroupProps) {
  const [open, setOpen] = useState(true);

  // Persist collapsed state per chapter
  useEffect(() => {
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) setOpen(stored === "1");
  }, [storageKey]);

  const toggle = () => {
    const next = !open;
    setOpen(next);
    localStorage.setItem(storageKey, next ? "1" : "0");
  };

  const pendingCount = modules.reduce(
    (sum, m) => sum + (m.recommendationCounts?.pending ?? 0),
    0
  );

  return (
    <div className="mb-0.5">
      {/* Chapter header */}
      <button
        onClick={toggle}
        className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left hover:bg-stone-50 transition-colors group"
      >
        <motion.span
          animate={{ rotate: open ? 90 : 0 }}
          transition={{ duration: 0.18, ease: "easeInOut" }}
          className="text-stone-300 group-hover:text-stone-500 transition-colors shrink-0"
        >
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M3 1.5l4 3.5-4 3.5" strokeWidth="0" />
          </svg>
        </motion.span>

        <span className="text-[12px] font-semibold text-stone-500 group-hover:text-stone-800 transition-colors flex-1 text-left tracking-wide uppercase">
          {chapterName}
        </span>

        {pendingCount > 0 && (
          <span className="text-[10px] font-semibold text-purple-700 bg-purple-100 border border-purple-200 rounded-full px-2 py-0.5 shrink-0">
            {pendingCount} pending
          </span>
        )}

        <span className="text-[11px] text-stone-300 font-mono shrink-0 ml-1">
          {modules.length}
        </span>
      </button>

      {/* Rows */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="ml-6 border-l border-stone-100 pl-2">
              {modules.map((item) => (
                <TrackerRow key={item.moduleId} item={item} />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
