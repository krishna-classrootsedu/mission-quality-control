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
      <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
        <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em] mb-2">Flow Map</h2>
        <p className="text-sm text-stone-300">Not yet mapped</p>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-stone-200 shadow-subtle overflow-hidden">
      <div className="px-5 py-3 border-b border-stone-100">
        <h2 className="text-[11px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Flow Map</h2>
      </div>
      <div className="overflow-auto">
        <table className="w-full border-collapse">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em] w-[44px]">#</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em] w-[72px]">Type</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em] w-[80px]">Slides</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em]" style={{ width: "30%" }}>Concept</th>
              <th className="text-left px-3 py-2 text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em]" style={{ width: "35%" }}>Purpose</th>
              <th className="text-center px-3 py-2 text-[11px] font-semibold text-stone-500 uppercase tracking-[0.08em] w-[80px]">Status</th>
            </tr>
          </thead>
          <tbody>
            {steps.map((step) => {
              const isFlagged = step.status === "flagged";
              const isFlagging = flaggingId === step._id;

              return (
                <tr
                  key={step._id}
                  className={`border-b border-stone-100 transition-colors ${
                    isFlagged ? "bg-stone-50" : "hover:bg-stone-50/60"
                  }`}
                >
                  <td className="px-3 py-2 text-[11px] font-mono text-stone-500">{step.stepIndex}</td>
                  <td className="px-3 py-2">
                    <span className={`text-[11px] font-medium ${
                      step.type === "applet" ? "text-stone-600" : "text-stone-400"
                    }`}>
                      {step.type}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-[11px] font-mono text-stone-500">{step.slideRange}</td>
                  <td className="px-3 py-2 text-[11px] text-stone-600">{step.concept}</td>
                  <td className="px-3 py-2 text-[11px] text-stone-600">{step.purpose}</td>
                  <td className="px-3 py-2 text-center">
                    {isFlagged ? (
                      <div>
                        <span className="text-[11px] font-medium text-stone-500">
                          Flagged
                        </span>
                        {step.vinayFlag && (
                          <div className="text-[11px] text-stone-400 mt-1 text-left">{step.vinayFlag}</div>
                        )}
                      </div>
                    ) : isFlagging ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={flagComment}
                          onChange={(e) => setFlagComment(e.target.value)}
                          placeholder="Why?"
                          className="text-[11px] border border-stone-200 rounded-lg px-2 py-1 w-full focus:ring-1 focus:ring-stone-200 focus:border-stone-300"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleFlag(step._id);
                            if (e.key === "Escape") { setFlaggingId(null); setFlagComment(""); }
                          }}
                        />
                        <button
                          onClick={() => handleFlag(step._id)}
                          className="text-[11px] font-medium text-stone-600 bg-stone-100 px-2 py-1 rounded border border-stone-200 hover:bg-stone-200 shrink-0"
                        >
                          Flag
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setFlaggingId(step._id)}
                        className="text-[11px] text-stone-400 hover:text-stone-600 transition-colors"
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
