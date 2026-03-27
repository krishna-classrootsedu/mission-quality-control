"use client";

import { ModuleBoardItem, BoardColumn } from "@/lib/types";
import ModuleCard from "./ModuleCard";

type ChapterGroup = {
  key: string;
  grade: number | null;
  chapterNumber: number | null;
  chapterName: string | null;
  modules: ModuleBoardItem[];
};

function groupByChapter(modules: ModuleBoardItem[]): ChapterGroup[] {
  const groups = new Map<string, ChapterGroup>();
  for (const m of modules) {
    const key = m.chapterNumber != null ? `g${m.grade}-c${m.chapterNumber}` : "uncategorized";
    if (!groups.has(key)) {
      groups.set(key, {
        key,
        grade: m.grade ?? null,
        chapterNumber: m.chapterNumber ?? null,
        chapterName: m.chapterName ?? null,
        modules: [],
      });
    }
    groups.get(key)!.modules.push(m);
  }
  for (const group of Array.from(groups.values())) {
    group.modules.sort((a, b) => {
      if (a.moduleNumber != null && b.moduleNumber != null) return a.moduleNumber - b.moduleNumber;
      return 0;
    });
  }
  return Array.from(groups.values()).sort((a, b) => {
    if (a.chapterNumber == null) return 1;
    if (b.chapterNumber == null) return -1;
    if (a.grade !== b.grade) return (a.grade ?? 0) - (b.grade ?? 0);
    return a.chapterNumber - b.chapterNumber;
  });
}

export default function ModuleBoardColumn({
  column,
  modules,
}: {
  column: BoardColumn;
  modules: ModuleBoardItem[];
}) {
  const groups = groupByChapter(modules);
  const hasChapterInfo = groups.some((g) => g.chapterNumber != null);

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
        ) : hasChapterInfo ? (
          groups.map((group, gi) => (
            <div key={group.key}>
              {group.chapterNumber != null && (
                <div className="px-1 pt-1 pb-0.5">
                  <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-stone-400">
                    G{group.grade} · Ch{group.chapterNumber}{group.chapterName ? ` — ${group.chapterName}` : ""}
                  </span>
                </div>
              )}
              {group.chapterNumber == null && gi > 0 && (
                <div className="px-1 pt-1 pb-0.5">
                  <span className="text-[10px] uppercase tracking-[0.1em] font-semibold text-stone-300">Other</span>
                </div>
              )}
              <div className="flex flex-col gap-2">
                {group.modules.map((m, i) => <ModuleCard key={m._id} module={m} index={i} />)}
              </div>
            </div>
          ))
        ) : (
          modules.map((m, i) => <ModuleCard key={m._id} module={m} index={i} />)
        )}
      </div>
    </div>
  );
}
