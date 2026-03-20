"use client";

import { useState } from "react";

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
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <button
        onClick={() => setCollapsed(!collapsed)}
        className="w-full px-4 py-3 flex items-center justify-between hover:bg-gray-50/50 transition-colors"
      >
        <div className="flex items-center gap-2.5">
          <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">{title}</span>
          <span className="text-[10px] text-gray-400">
            {passCount}/{gates.length} passed
            {failCount > 0 && <span className="text-red-500 ml-1">({failCount} failed)</span>}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md ${
            overallPassed ? "bg-emerald-50 text-emerald-600" : "bg-red-50 text-red-500"
          }`}>
            {overallPassed ? "PASSED" : "FAILED"}
          </span>
          <svg className={`w-4 h-4 text-gray-400 transition-transform ${collapsed ? "" : "rotate-180"}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {!collapsed && (
        <div className="px-4 pb-3 border-t border-gray-100">
          <div className="space-y-2 mt-2.5">
            {gates.map((gate) => (
              <div key={gate.ruleId} className="flex items-start gap-2.5">
                <span className={`mt-0.5 w-4 h-4 rounded-full flex items-center justify-center text-[9px] font-bold shrink-0 ${
                  gate.passed ? "bg-emerald-100 text-emerald-600" : "bg-red-100 text-red-500"
                }`}>
                  {gate.passed ? "\u2713" : "\u2717"}
                </span>
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] text-gray-700 font-medium">{gate.ruleName}</div>
                  {gate.evidence && <div className="text-[11px] text-gray-400 mt-0.5">{gate.evidence}</div>}
                  {gate.slideNumbers && gate.slideNumbers.length > 0 && (
                    <div className="text-[11px] text-gray-300 font-mono">Slides: {gate.slideNumbers.join(", ")}</div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
