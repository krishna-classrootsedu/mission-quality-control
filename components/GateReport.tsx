"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

type GateResult = {
  ruleId: string;
  ruleName: string;
  passed: boolean;
  evidence?: string;
  slideNumbers?: number[];
};

export default function GateReport({
  gates,
  overallPassed,
  title,
  defaultCollapsed = true,
}: {
  gates: GateResult[];
  overallPassed: boolean;
  title: string;
  defaultCollapsed?: boolean;
}) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  const passCount = gates.filter((g) => g.passed).length;
  const failCount = gates.length - passCount;

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-subtle overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">{title}</span>
          <span className="text-[11px] text-stone-400">
            {passCount}/{gates.length} passed
            {failCount > 0 && <span className="text-red-500 ml-1">({failCount} failed)</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`flex items-center gap-1 text-[11px] font-medium ${
            overallPassed ? "text-stone-600" : "text-red-500"
          }`}>
            <span className={overallPassed ? "text-stone-400" : "text-red-500"}>
              {overallPassed ? "\u2713" : "\u2717"}
            </span>
            {overallPassed ? "Passed" : "Failed"}
          </span>
          <svg className={`w-4 h-4 text-stone-400 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-3 border-t border-stone-100">
              <div className="space-y-2 mt-2.5">
                {gates.map((gate) => (
                  <div key={gate.ruleId} className="flex items-start gap-2.5">
                    <span className={`mt-0.5 text-[11px] shrink-0 ${
                      gate.passed ? "text-stone-400" : "text-red-500"
                    }`}>
                      {gate.passed ? "\u2713" : "\u2717"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] text-stone-700 font-medium">{gate.ruleName}</div>
                      {gate.evidence && <div className="text-[11px] text-stone-400 mt-0.5">{gate.evidence}</div>}
                      {gate.slideNumbers && gate.slideNumbers.length > 0 && (
                        <div className="text-[11px] text-stone-300 font-mono">Slides: {gate.slideNumbers.join(", ")}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
