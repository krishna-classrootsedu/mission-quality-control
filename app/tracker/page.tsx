"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import TrackerTable from "@/components/TrackerTable";

export default function TrackerPage() {
  const me = useQuery(api.users.me);
  const shouldLoad = me !== null && me !== undefined;
  const trackerData = useQuery(api.board.getTrackerData, shouldLoad ? {} : "skip");

  if (me === undefined || (shouldLoad && trackerData === undefined)) {
    return (
      <main className="flex items-center justify-center h-[calc(100vh-48px)]">
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading tracker…
        </div>
      </main>
    );
  }

  if (me === null) {
    return (
      <main className="flex items-center justify-center h-[calc(100vh-48px)]">
        <p className="text-sm text-stone-500">Sign in required to view the tracker.</p>
      </main>
    );
  }

  return (
    <main className="min-h-[calc(100vh-48px)] bg-white">
      {/* Page header */}
      <div className="border-b border-stone-200/60 px-6 py-4 bg-white">
        <div className="max-w-[1400px] mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-stone-800 tracking-tight">Tracker</h1>
            <p className="text-[12px] text-stone-400 mt-0.5">
              {trackerData?.length ?? 0} module{(trackerData?.length ?? 0) !== 1 ? "s" : ""}
              {trackerData && (() => {
                const needsVinay = trackerData.filter((m) => m.column === "Vinay Review").length;
                const shipReady = trackerData.filter((m) => m.column === "Ship-ready").length;
                return (
                  <span>
                    {needsVinay > 0 && <span className="ml-2 text-purple-600 font-medium">{needsVinay} need{needsVinay === 1 ? "s" : ""} Vinay</span>}
                    {shipReady > 0 && <span className="ml-2 text-emerald-600 font-medium">{shipReady} ship-ready</span>}
                  </span>
                );
              })()}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-[1400px] mx-auto">
        <TrackerTable modules={trackerData ?? []} />
      </div>
    </main>
  );
}
