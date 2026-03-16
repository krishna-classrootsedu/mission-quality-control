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
        <div className="text-gray-400 text-sm">Loading pipeline...</div>
      </div>
    );
  }

  // Group modules by column
  const grouped = new Map<BoardColumn, ModuleBoardItem[]>();
  for (const col of BOARD_COLUMNS) {
    grouped.set(col, []);
  }
  for (const item of boardData) {
    const col = item.column as BoardColumn;
    grouped.get(col)?.push(item);
  }

  return (
    <div className="flex gap-3 overflow-x-auto pb-4 px-4">
      {BOARD_COLUMNS.map((col) => (
        <ModuleBoardColumn key={col} column={col} modules={grouped.get(col) ?? []} />
      ))}
    </div>
  );
}
