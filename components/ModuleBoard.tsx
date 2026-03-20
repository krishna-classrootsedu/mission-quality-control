"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { BOARD_COLUMNS, BoardColumn, ModuleBoardItem } from "@/lib/types";
import ModuleBoardColumn from "./ModuleBoardColumn";

export default function ModuleBoard() {
  const boardData = useQuery(api.board.getBoard);

  if (boardData === undefined) {
    return (
      <div className="flex items-center justify-center h-64">
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

  const grouped = new Map<BoardColumn, ModuleBoardItem[]>();
  for (const col of BOARD_COLUMNS) grouped.set(col, []);
  for (const item of boardData) {
    const col = item.column as BoardColumn;
    grouped.get(col)?.push(item);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 px-5">
      {BOARD_COLUMNS.map((col) => (
        <ModuleBoardColumn key={col} column={col} modules={grouped.get(col) ?? []} />
      ))}
    </div>
  );
}
