"use client";

import { ModuleBoardItem, BoardColumn, COLUMN_CONFIG } from "@/lib/types";
import ModuleCard from "./ModuleCard";

export default function ModuleBoardColumn({
  column,
  modules,
}: {
  column: BoardColumn;
  modules: ModuleBoardItem[];
}) {
  const config = COLUMN_CONFIG[column];

  return (
    <div className={`flex flex-col rounded-xl border ${config.border} ${config.bg} min-w-[280px] max-w-[320px] w-full`}>
      {/* Header */}
      <div className={`flex items-center justify-between px-3 py-2 ${config.headerBg} rounded-t-xl border-b ${config.border}`}>
        <h2 className="text-sm font-semibold text-gray-700">{column}</h2>
        <span className={`inline-flex items-center justify-center w-6 h-6 rounded-full text-xs font-bold ${config.count}`}>
          {modules.length}
        </span>
      </div>

      {/* Cards */}
      <div className="flex flex-col gap-2 p-2 overflow-y-auto max-h-[calc(100vh-160px)]">
        {modules.length === 0 ? (
          <p className="text-xs text-gray-400 text-center py-4">No modules</p>
        ) : (
          modules.map((m) => <ModuleCard key={m._id} module={m} />)
        )}
      </div>
    </div>
  );
}
