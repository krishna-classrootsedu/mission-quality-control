"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BOARD_COLUMNS, BoardColumn, ModuleBoardItem } from "@/lib/types";
import ModuleBoardColumn from "./ModuleBoardColumn";
import ScoreBandBadge from "./ScoreBandBadge";

const BAND_LEGEND = [
  { key: "ship_ready", range: "90–100" },
  { key: "upgradeable", range: "75–89" },
  { key: "rework", range: "50–74" },
  { key: "redesign", range: "0–49" },
];

export default function ModuleBoard() {
  const me = useQuery(api.users.me);
  const shouldLoadBoard = me !== null && me !== undefined;
  const boardData = useQuery(api.board.getBoard, shouldLoadBoard ? {} : "skip");

  if (me === undefined || (shouldLoadBoard && boardData === undefined)) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex items-center gap-2 text-stone-400 text-sm">
          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Loading pipeline...
        </div>
      </div>
    );
  }
  if (me === null) {
    return (
      <div className="flex items-center justify-center h-full">
        <p className="text-sm text-stone-500">Sign in required to view board.</p>
      </div>
    );
  }

  const grouped = new Map<BoardColumn, ModuleBoardItem[]>();
  for (const col of BOARD_COLUMNS) grouped.set(col, []);
  for (const item of boardData ?? []) {
    const col = item.column as BoardColumn;
    grouped.get(col)?.push(item);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Score band legend */}
      <div className="flex items-center gap-4 px-5 pt-3 pb-2 flex-shrink-0">
        <span className="text-[11px] text-stone-400 font-medium">Score bands:</span>
        {BAND_LEGEND.map((b) => (
          <div key={b.key} className="flex items-center gap-1.5">
            <ScoreBandBadge band={b.key} />
            <span className="text-[10px] text-stone-400">{b.range}</span>
          </div>
        ))}
      </div>
      {/* Board columns */}
      <div className="flex items-start gap-3 flex-1 overflow-x-auto overflow-y-hidden px-5 pb-4">
        {BOARD_COLUMNS.map((col) => (
          <ModuleBoardColumn key={col} column={col} modules={grouped.get(col) ?? []} />
        ))}
        <div className="flex-shrink-0 w-1" />
      </div>
    </div>
  );
}
