"use client";

import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type FlowMapStep = {
  _id: Id<"flowMap">;
  stepIndex: number;
  type: string;
  slideRange: string;
  concept: string;
  purpose: string;
  appletRef?: string;
  status: string;
  vinayFlag?: string;
  flaggedAt?: string;
};

export default function FlowMapTable({ steps }: { steps: FlowMapStep[] }) {
  const [flaggingId, setFlaggingId] = useState<string | null>(null);
  const [flagComment, setFlagComment] = useState("");
  const flagMutation = useMutation(api.flowMap.flag);

  const handleFlag = async (stepId: Id<"flowMap">) => {
    if (!flagComment.trim()) return;
    await flagMutation({ stepId, vinayFlag: flagComment.trim() });
    setFlaggingId(null);
    setFlagComment("");
  };

  if (steps.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm p-5">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider mb-2">Flow Map</h2>
        <p className="text-sm text-gray-300">Not yet mapped</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200/80 shadow-sm overflow-hidden">
      <div className="px-5 py-3 border-b border-gray-100">
        <h2 className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider">Flow Map</h2>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200/80">
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[44px]">#</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[72px]">Type</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[80px]">Slides</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: "30%" }}>Concept</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider" style={{ width: "35%" }}>Purpose</th>
              <th className="text-center px-3 py-2 text-[11px] font-semibold text-gray-400 uppercase tracking-wider w-[80px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => {
              const isFlagged = step.status === "flagged";
              const isFlagging = flaggingId === step._id;

              return (
                <tr
                  key={step._id}
                  className={`border-b border-gray-100 transition-colors ${
                    isFlagged ? "bg-amber-50/40" : "hover:bg-gray-50/60"
                  }`}
                >
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">{step.stepIndex}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border whitespace-nowrap ${
                      step.type === "applet"
                        ? "text-blue-600 bg-blue-50 border-blue-200"
                        : "text-gray-500 bg-gray-50 border-gray-200"
                    }`}>
                      {step.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs font-mono text-gray-500">{step.slideRange}</td>
                  <td className="px-3 py-2 text-xs text-gray-700">{step.concept}</td>
                  <td className="px-3 py-2 text-xs text-gray-600">{step.purpose}</td>
                  <td className="px-3 py-2 text-center">
                    {isFlagged ? (
                      <div>
                        <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded-full">
                          Flagged
                        </span>
                        {step.vinayFlag && (
                          <div className="text-[10px] text-amber-600 mt-1 text-left">{step.vinayFlag}</div>
                        )}
                      </div>
                    ) : isFlagging ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={flagComment}
                          onChange={(e) => setFlagComment(e.target.value)}
                          placeholder="Why?"
                          className="text-xs border border-gray-200 rounded px-2 py-1 w-full"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleFlag(step._id);
                            if (e.key === "Escape") { setFlaggingId(null); setFlagComment(""); }
                          }}
                        />
                        <button
                          onClick={() => handleFlag(step._id)}
                          className="text-[10px] font-medium text-amber-700 bg-amber-50 px-2 py-1 rounded border border-amber-200 hover:bg-amber-100 shrink-0"
                        >
                          Flag
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFlaggingId(step._id)}
                        className="text-[10px] text-gray-400 hover:text-amber-600 transition-colors"
                      >
                        Flag
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
