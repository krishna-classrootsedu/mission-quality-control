"use client";

import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

type Reviewer = {
  userId: Id<"users">;
  name: string | null;
  email: string | null;
  role: string;
};

type ModuleRow = {
  moduleId: string;
  title: string;
  grade: number;
  status: string;
  scoreBand: string | null;
  version: number;
};

function statusLabel(status: string): string {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function ScoreBandDot({ band }: { band: string | null }) {
  if (!band) return <span className="text-stone-300">--</span>;
  const colors: Record<string, string> = {
    "Ship-ready": "bg-emerald-500",
    Upgradeable: "bg-amber-500",
    Rework: "bg-orange-500",
    Redesign: "bg-red-500",
  };
  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`w-2 h-2 rounded-full ${colors[band] ?? "bg-stone-300"}`} />
      <span className="text-stone-600">{band}</span>
    </span>
  );
}

function ReviewerChip({
  name,
  onRemove,
  busy,
}: {
  name: string;
  onRemove: () => void;
  busy: boolean;
}) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-stone-100 text-stone-700 rounded text-[11px] font-medium">
      {name}
      <button
        onClick={onRemove}
        disabled={busy}
        className="text-stone-400 hover:text-stone-700 disabled:opacity-30 ml-0.5 leading-none"
        title="Unassign"
      >
        &times;
      </button>
    </span>
  );
}

function AssignDropdown({
  reviewers,
  allocatedIds,
  onAssign,
  busy,
}: {
  reviewers: Reviewer[];
  allocatedIds: Set<string>;
  onAssign: (userId: Id<"users">) => void;
  busy: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    if (open) document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const available = reviewers.filter((r) => !allocatedIds.has(r.userId));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={busy || available.length === 0}
        className="px-2 py-1 text-[11px] border border-stone-200 rounded text-stone-600 hover:bg-stone-50 disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {available.length === 0 ? "All assigned" : "+ Assign"}
      </button>
      {open && available.length > 0 && (
        <div className="absolute right-0 top-full mt-1 bg-white border border-stone-200 rounded-lg shadow-lg z-30 min-w-[180px] py-1">
          {available.map((r) => (
            <button
              key={r.userId}
              onClick={() => {
                onAssign(r.userId);
                setOpen(false);
              }}
              className="w-full text-left px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-50"
            >
              {r.name ?? r.email ?? "Unknown"}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default function AllocationsPage() {
  const me = useQuery(api.users.me);
  const modules = useQuery(
    api.modules.list,
    me?.role === "manager" || me?.role === "admin" ? {} : "skip"
  );
  const reviewers = useQuery(
    api.users.reviewers,
    me?.role === "manager" || me?.role === "admin" ? {} : "skip"
  );
  const allAllocations = useQuery(
    api.users.allAllocations,
    me?.role === "manager" || me?.role === "admin" ? {} : "skip"
  );

  const grantPermission = useMutation(api.users.grantModulePermissions);
  const revokePermission = useMutation(api.users.revokeModulePermissions);

  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [filter, setFilter] = useState("");

  async function handleAssign(moduleId: string, userId: Id<"users">) {
    const key = `${moduleId}:${userId}`;
    setBusyKey(key);
    try {
      await grantPermission({
        moduleId,
        userId,
        permissions: ["module:view", "module:review"],
        grantSource: "allocations_page",
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to assign");
    } finally {
      setBusyKey(null);
    }
  }

  async function handleUnassign(moduleId: string, userId: Id<"users">) {
    const key = `${moduleId}:${userId}`;
    setBusyKey(key);
    try {
      await revokePermission({ moduleId, userId });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Failed to unassign");
    } finally {
      setBusyKey(null);
    }
  }

  // Loading
  if (me === undefined) {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <p className="text-sm text-stone-400">Loading...</p>
      </main>
    );
  }

  // Not signed in
  if (me === null) {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h1 className="text-lg font-semibold text-stone-800">Sign in required</h1>
          <p className="text-sm text-stone-500 mt-2">Please sign in to manage allocations.</p>
        </div>
      </main>
    );
  }

  // Permission check
  if (me.role !== "manager" && me.role !== "admin") {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h1 className="text-lg font-semibold text-stone-800">Permission denied</h1>
          <p className="text-sm text-stone-500 mt-2">
            Only managers and admins can manage reviewer allocations.
          </p>
        </div>
      </main>
    );
  }

  // Data loading
  if (modules === undefined || reviewers === undefined || allAllocations === undefined) {
    return (
      <main className="max-w-[1400px] mx-auto px-6 py-6">
        <div className="space-y-3">
          <div className="h-8 w-48 animate-pulse bg-stone-100 rounded" />
          <div className="h-4 w-64 animate-pulse bg-stone-100 rounded" />
          <div className="h-64 w-full animate-pulse bg-stone-100 rounded-lg" />
        </div>
      </main>
    );
  }

  // Build module rows sorted by latest first
  const moduleRows: ModuleRow[] = modules
    .map((m) => ({
      moduleId: m.moduleId,
      title: m.title,
      grade: m.grade,
      status: m.status,
      scoreBand: m.scoreBand ?? null,
      version: m.version,
    }))
    .sort((a, b) => b.version - a.version);

  // Filter
  const filtered = filter
    ? moduleRows.filter(
        (m) =>
          m.title.toLowerCase().includes(filter.toLowerCase()) ||
          m.moduleId.toLowerCase().includes(filter.toLowerCase())
      )
    : moduleRows;

  const totalAllocated = Object.keys(allAllocations).length;

  return (
    <main className="max-w-[1400px] mx-auto px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Reviewer Allocations</h1>
          <p className="text-xs text-stone-500 mt-1">
            {moduleRows.length} modules &middot; {reviewers.length} reviewers &middot;{" "}
            {totalAllocated} modules with assignments
          </p>
        </div>
        <input
          type="text"
          placeholder="Filter modules..."
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg w-64 focus:outline-none focus:ring-2 focus:ring-stone-300"
        />
      </div>

      <div className="bg-white rounded-lg border border-stone-200 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-stone-400">
            {filter ? "No modules match your filter." : "No modules uploaded yet."}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-stone-50 border-b border-stone-200 text-stone-500">
                  <th className="text-left px-4 py-2.5 font-medium">Module</th>
                  <th className="text-left px-4 py-2.5 font-medium w-16">Grade</th>
                  <th className="text-left px-4 py-2.5 font-medium w-36">Status</th>
                  <th className="text-left px-4 py-2.5 font-medium w-28">Score</th>
                  <th className="text-left px-4 py-2.5 font-medium">Assigned Reviewers</th>
                  <th className="text-right px-4 py-2.5 font-medium w-28">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((m, i) => {
                  const allocated = allAllocations[m.moduleId] ?? [];
                  const allocatedIds = new Set(allocated.map((a) => a.userId));

                  return (
                    <tr
                      key={m.moduleId}
                      className={`border-b border-stone-100 ${i % 2 === 0 ? "bg-white" : "bg-stone-50/30"}`}
                    >
                      <td className="px-4 py-2.5">
                        <div className="text-stone-800 font-medium leading-tight">{m.title}</div>
                        <div className="text-[11px] text-stone-400 font-mono mt-0.5">v{m.version}</div>
                      </td>
                      <td className="px-4 py-2.5 text-stone-600">G{m.grade}</td>
                      <td className="px-4 py-2.5">
                        <span className="text-[11px] text-stone-500 bg-stone-100 px-2 py-0.5 rounded">
                          {statusLabel(m.status)}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-[12px]">
                        <ScoreBandDot band={m.scoreBand} />
                      </td>
                      <td className="px-4 py-2.5">
                        <div className="flex flex-wrap gap-1.5">
                          {allocated.length === 0 && (
                            <span className="text-[11px] text-stone-300 italic">None</span>
                          )}
                          {allocated.map((a) => (
                            <ReviewerChip
                              key={a.userId}
                              name={a.name ?? a.email ?? "Unknown"}
                              busy={busyKey === `${m.moduleId}:${a.userId}`}
                              onRemove={() =>
                                handleUnassign(m.moduleId, a.userId as Id<"users">)
                              }
                            />
                          ))}
                        </div>
                      </td>
                      <td className="px-4 py-2.5 text-right">
                        <AssignDropdown
                          reviewers={reviewers}
                          allocatedIds={allocatedIds}
                          onAssign={(userId) => handleAssign(m.moduleId, userId)}
                          busy={busyKey?.startsWith(m.moduleId + ":") ?? false}
                        />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
}
