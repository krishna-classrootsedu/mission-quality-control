"use client";

import { useState, useMemo } from "react";
import { ModuleBoardItem, BOARD_COLUMNS, BoardColumn } from "@/lib/types";
import TrackerChapterGroup from "./TrackerChapterGroup";

const ITEMS_PER_PAGE = 50; // modules, not chapters — enough for comfortable scrolling

type SortKey = "moduleNumber" | "updatedAt" | "overallPercentage" | "status";
type SortDir = "asc" | "desc";

interface TrackerTableProps {
  modules: ModuleBoardItem[];
}

const STAGE_FILTER_OPTIONS: Array<{ label: string; value: BoardColumn | "all" }> = [
  { label: "All stages", value: "all" },
  { label: "Needs Vinay", value: "Vinay Review" },
  { label: "Creator Fix", value: "Creator Fix" },
  { label: "In Review", value: "In Review" },
  { label: "Integration", value: "Integration" },
  { label: "Gate Check", value: "Gate Check" },
  { label: "Ship-ready", value: "Ship-ready" },
];

export default function TrackerTable({ modules }: TrackerTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>("updatedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");
  const [stageFilter, setStageFilter] = useState<BoardColumn | "all">("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [page, setPage] = useState(1);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
    setPage(1);
  };

  // Filter
  const filtered = useMemo(() => {
    let items = modules;
    if (stageFilter !== "all") {
      items = items.filter((m) => m.column === stageFilter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(
        (m) =>
          m.title.toLowerCase().includes(q) ||
          (m.chapterName?.toLowerCase().includes(q) ?? false) ||
          (m.submittedBy?.toLowerCase().includes(q) ?? false) ||
          (m.reviewerName?.toLowerCase().includes(q) ?? false)
      );
    }
    return items;
  }, [modules, stageFilter, searchQuery]);

  // Sort within each chapter group
  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      // Primary: chapter number (group order)
      const chA = a.chapterNumber ?? 9999;
      const chB = b.chapterNumber ?? 9999;
      if (chA !== chB) return chA - chB;

      // Secondary: user-selected sort
      let cmp = 0;
      if (sortKey === "moduleNumber") {
        cmp = (a.moduleNumber ?? 0) - (b.moduleNumber ?? 0);
      } else if (sortKey === "updatedAt") {
        cmp = new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime();
      } else if (sortKey === "overallPercentage") {
        cmp = (a.overallPercentage ?? -1) - (b.overallPercentage ?? -1);
      } else if (sortKey === "status") {
        cmp = BOARD_COLUMNS.indexOf(a.column) - BOARD_COLUMNS.indexOf(b.column);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [filtered, sortKey, sortDir]);

  // Group into chapters
  const grouped = useMemo(() => {
    const map = new Map<string, { key: string; modules: ModuleBoardItem[] }>();
    for (const m of sorted) {
      const chName = m.chapterName ?? `Chapter ${m.chapterNumber ?? "?"}`;
      const key = `ch-${m.chapterNumber ?? "0"}-${chName}`;
      if (!map.has(key)) map.set(key, { key, modules: [] });
      map.get(key)!.modules.push(m);
    }
    return Array.from(map.values());
  }, [sorted]);

  // Pagination — paginate by modules, not chapters (we show full chapters on a page)
  const totalModules = filtered.length;
  const totalPages = Math.ceil(totalModules / ITEMS_PER_PAGE);

  const paginatedGroups = useMemo(() => {
    const start = (page - 1) * ITEMS_PER_PAGE;
    const end = start + ITEMS_PER_PAGE;
    let count = 0;
    const result: typeof grouped = [];
    for (const group of grouped) {
      if (count >= end) break;
      if (count + group.modules.length > start) {
        const sliceStart = Math.max(0, start - count);
        const sliceEnd = Math.min(group.modules.length, end - count);
        result.push({ key: group.key, modules: group.modules.slice(sliceStart, sliceEnd) });
      }
      count += group.modules.length;
    }
    return result;
  }, [grouped, page]);

  const SortIcon = ({ k }: { k: SortKey }) => {
    if (sortKey !== k) {
      return <span className="text-stone-300 ml-0.5">↕</span>;
    }
    return <span className="text-stone-600 ml-0.5">{sortDir === "asc" ? "↑" : "↓"}</span>;
  };

  const pendingNeedsVinay = modules.filter((m) => m.column === "Vinay Review").length;

  return (
    <div className="space-y-0">
      {/* Toolbar */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-stone-200/60 bg-white sticky top-[calc(48px+0px)] z-10 flex-wrap">
        {/* Search */}
        <div className="relative flex-1 min-w-[200px] max-w-[320px]">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400"
            fill="none"
            viewBox="0 0 16 16"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <circle cx="6.5" cy="6.5" r="4.5" />
            <path strokeLinecap="round" d="M10.5 10.5l3 3" />
          </svg>
          <input
            type="text"
            placeholder="Search modules, chapters, owners…"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setPage(1); }}
            className="w-full pl-8 pr-3 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 focus:border-stone-400 placeholder:text-stone-400 text-stone-700"
          />
        </div>

        {/* Stage filter */}
        <div className="flex items-center gap-1 flex-wrap">
          {pendingNeedsVinay > 0 && stageFilter === "all" && (
            <button
              onClick={() => { setStageFilter("Vinay Review"); setPage(1); }}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-medium bg-purple-100 text-purple-800 border border-purple-200 hover:bg-purple-200 transition-colors"
            >
              <span className="w-1.5 h-1.5 rounded-full bg-purple-600" />
              {pendingNeedsVinay} need{pendingNeedsVinay === 1 ? "s" : ""} Vinay
            </button>
          )}
          <select
            value={stageFilter}
            onChange={(e) => { setStageFilter(e.target.value as BoardColumn | "all"); setPage(1); }}
            className="px-2.5 py-1.5 text-[12px] bg-stone-50 border border-stone-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-stone-400 text-stone-600"
          >
            {STAGE_FILTER_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Sort controls */}
        <div className="flex items-center gap-1 ml-auto text-[11px] text-stone-400">
          <span>Sort:</span>
          {(["updatedAt", "moduleNumber", "overallPercentage", "status"] as SortKey[]).map((k) => {
            const labels: Record<SortKey, string> = {
              updatedAt: "Updated",
              moduleNumber: "Module #",
              overallPercentage: "Score",
              status: "Stage",
            };
            return (
              <button
                key={k}
                onClick={() => handleSort(k)}
                className={`px-2 py-1 rounded transition-colors ${sortKey === k ? "text-stone-800 font-medium bg-stone-100" : "hover:text-stone-600 hover:bg-stone-50"}`}
              >
                {labels[k]}
                <SortIcon k={k} />
              </button>
            );
          })}
        </div>

        {/* Module count */}
        <span className="text-[11px] text-stone-400 shrink-0">
          {totalModules} module{totalModules !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Column header row */}
      <div className="grid tracker-row-grid items-center px-4 py-2 bg-stone-50/80 border-b border-stone-200/60 sticky top-[calc(48px+45px)] z-10">
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em]">#</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Module</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Creator</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Reviewer</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Stage</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em] text-right">Score</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Band</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em]">Ver</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em] text-right">Open recs</div>
        <div className="text-[10px] font-semibold text-stone-400 uppercase tracking-[0.08em] text-right">Updated</div>
        <div />
      </div>

      {/* Chapter groups */}
      <div className="divide-y divide-stone-100/60">
        {paginatedGroups.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-stone-400 text-sm">No modules match the current filters.</p>
            <button
              onClick={() => { setStageFilter("all"); setSearchQuery(""); setPage(1); }}
              className="mt-3 text-xs text-stone-500 underline underline-offset-2 hover:text-stone-700 transition-colors"
            >
              Clear filters
            </button>
          </div>
        ) : (
          paginatedGroups.map((group) => (
            <TrackerChapterGroup
              key={group.key}
              chapterName={group.key.replace(/^ch-\d+-/, "")}
              modules={group.modules}
              storageKey={`tracker-collapsed-${group.key}`}
            />
          ))
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between px-4 py-3 border-t border-stone-200/60 bg-white">
          <span className="text-[12px] text-stone-500">
            Showing {(page - 1) * ITEMS_PER_PAGE + 1}–{Math.min(page * ITEMS_PER_PAGE, totalModules)} of {totalModules}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              className="px-3 py-1.5 text-[12px] rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              ← Prev
            </button>
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
              <button
                key={p}
                onClick={() => setPage(p)}
                className={`w-8 h-8 text-[12px] rounded-lg transition-colors ${
                  p === page
                    ? "bg-stone-800 text-white font-medium"
                    : "text-stone-600 hover:bg-stone-50 border border-stone-200"
                }`}
              >
                {p}
              </button>
            ))}
            <button
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
              disabled={page === totalPages}
              className="px-3 py-1.5 text-[12px] rounded-lg border border-stone-200 text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
