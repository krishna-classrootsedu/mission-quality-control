"use client";

import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export default function UsagePage() {
  const data = useQuery(api.tokenUsage.dailyAggregate, { limit: 500 });
  const [page, setPage] = useState(0);
  const pageSize = 20;

  if (data === undefined) {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <p className="text-sm text-stone-400">Loading...</p>
      </main>
    );
  }

  if (data.length === 0) {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-8">
        <h1 className="text-lg font-semibold text-stone-800 mb-4">Token Usage</h1>
        <div className="border border-stone-200 rounded-lg p-8 text-center">
          <p className="text-sm text-stone-400">No token usage data yet.</p>
          <p className="text-xs text-stone-300 mt-1">
            Data will appear after pipeline runs push token stats.
          </p>
        </div>
      </main>
    );
  }

  // Compute totals
  const totalTokens = data.reduce((s, r) => s + r.totalTokens, 0);
  const totalRuns = data.reduce((s, r) => s + r.runs, 0);

  // Paginate
  const totalPages = Math.ceil(data.length / pageSize);
  const pageData = data.slice(page * pageSize, (page + 1) * pageSize);

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-8">
      <h1 className="text-lg font-semibold text-stone-800 mb-6">Token Usage</h1>

      {/* Summary cards */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        <div className="border border-stone-200 rounded-lg p-4">
          <p className="text-xs text-stone-400 uppercase tracking-wide">Total Tokens</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">{formatTokens(totalTokens)}</p>
        </div>
        <div className="border border-stone-200 rounded-lg p-4">
          <p className="text-xs text-stone-400 uppercase tracking-wide">Total Runs</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">{totalRuns}</p>
        </div>
        <div className="border border-stone-200 rounded-lg p-4">
          <p className="text-xs text-stone-400 uppercase tracking-wide">Unique Dates</p>
          <p className="text-2xl font-semibold text-stone-800 mt-1">
            {new Set(data.map((r) => r.date)).size}
          </p>
        </div>
      </div>

      {/* Table */}
      <div className="border border-stone-200 rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-stone-50 border-b border-stone-200">
              <th className="text-left px-4 py-2.5 font-medium text-stone-500">Date</th>
              <th className="text-left px-4 py-2.5 font-medium text-stone-500">Agent</th>
              <th className="text-right px-4 py-2.5 font-medium text-stone-500">Total Tokens</th>
              <th className="text-right px-4 py-2.5 font-medium text-stone-500">Modules</th>
              <th className="text-right px-4 py-2.5 font-medium text-stone-500">Runs</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((row, i) => (
              <tr
                key={`${row.date}-${row.agentName}`}
                className={i % 2 === 0 ? "bg-white" : "bg-stone-50/50"}
              >
                <td className="px-4 py-2.5 text-stone-600 font-mono text-xs">{row.date}</td>
                <td className="px-4 py-2.5 text-stone-800">{row.agentName}</td>
                <td className="px-4 py-2.5 text-right text-stone-800 font-mono">
                  {formatTokens(row.totalTokens)}
                </td>
                <td className="px-4 py-2.5 text-right text-stone-500">{row.modulesCount}</td>
                <td className="px-4 py-2.5 text-right text-stone-500">{row.runs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-xs text-stone-400">
            Page {page + 1} of {totalPages}
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              disabled={page === 0}
              className="px-3 py-1.5 text-xs border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Previous
            </button>
            <button
              onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
              disabled={page >= totalPages - 1}
              className="px-3 py-1.5 text-xs border border-stone-200 rounded-md text-stone-600 hover:bg-stone-50 disabled:opacity-30 disabled:cursor-not-allowed"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
