"use client";

import { ModuleBoardItem, BoardColumn } from "@/lib/types";
import ModuleCard from "./ModuleCard";

export default function ModuleBoardColumn({
  column,
  modules,
}: {
  column: BoardColumn;
  modules: ModuleBoardItem[];
}) {
  return (
    <div className="flex flex-col rounded-lg border border-stone-200/60 bg-stone-50/60 w-[280px] flex-shrink-0 max-h-full">
      <div className="flex items-center justify-between px-3.5 py-2.5">
        <h2 className="text-[11px] uppercase tracking-[0.08em] font-semibold text-stone-500">{column}</h2>
        <span className="text-stone-400 font-mono text-[11px]">
          {modules.length}
        </span>
      </div>
      <div className="flex-1 flex flex-col gap-2 p-2 overflow-y-auto">
        {modules.length === 0 ? (
          <p className="text-[11px] text-stone-300 text-center py-6 italic">No modules</p>
        ) : (
          modules.map((m, i) => <ModuleCard key={m._id} module={m} index={i} />)
        )}
      </div>
    </div>
  );
}
