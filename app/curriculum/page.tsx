"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const CONCEPT_TYPES = ["Learn", "Practice", "Challenge"] as const;

type CurriculumEntry = {
  _id: Id<"curriculumMap">;
  moduleCode: string;
  thread?: string;
  strand?: string;
  tpCode?: string;
  tpDescription?: string;
  grade: number;
  chapterNumber: number;
  moduleNumber: number;
  chapterName?: string;
  conceptName?: string;
  conceptType?: string;
  conceptDescription?: string;
  proposedLOs?: string;
  createdAt: string;
  createdBy?: Id<"users">;
  createdByName?: string;
  lastEditedAt: string;
  lastEditedBy?: Id<"users">;
  lastEditedByName?: string;
};

type CSVRow = {
  moduleCode: string;
  thread?: string;
  strand?: string;
  tpCode?: string;
  tpDescription?: string;
  chapterName?: string;
  conceptName?: string;
  conceptType?: string;
  conceptDescription?: string;
  proposedLOs?: string;
};

// CSV column headers used in the downloaded template + shown in the import panel.
// Matches the header names Vinay's content team uses in their working CSV so the
// template doubles as a 1:1 reference for them. Our importer also accepts
// "Proposed LOs" as an alias for "ETP Learning Objective".
const CSV_HEADERS = [
  "Thread",
  "Strand",
  "TP Code",
  "TP Description",
  "Grade",
  "Chapter Name",
  "Concept Code",
  "Concept Name",
  "Concept Type",
  "Concept Description",
  "ETP Learning Objective",
];

// Normalized header → DB field. Accepts case/space/underscore variants.
// Multiple headers can alias to the same field (e.g. Vinay's team uses
// "ETP Learning Objective" for what we call "Proposed LOs").
const HEADER_MAP: Record<string, keyof CSVRow | "grade_ignored"> = {
  thread: "thread",
  strand: "strand",
  tpcode: "tpCode",
  tpdescription: "tpDescription",
  grade: "grade_ignored",          // validated against parsed moduleCode, not stored
  gradecode: "grade_ignored",      // Vinay's CSV uses "Grade Code" with G01/G02 format — same treatment
  chaptername: "chapterName",
  conceptcode: "moduleCode",
  modulecode: "moduleCode",        // accept both as aliases
  conceptname: "conceptName",
  concepttype: "conceptType",
  conceptdescription: "conceptDescription",
  proposedlos: "proposedLOs",
  etplearningobjective: "proposedLOs", // Vinay's team header for the same field
};

function normalizeHeader(h: string): string {
  return h.toLowerCase().replace(/[^a-z0-9]/g, "");
}

function parseModuleCodeLoose(code: string): { grade: number; chapterNumber: number; moduleNumber: number } | null {
  const m = code.trim().toUpperCase().match(/^G(\d+)C(\d+)M(\d+)$/);
  if (!m) return null;
  return { grade: parseInt(m[1], 10), chapterNumber: parseInt(m[2], 10), moduleNumber: parseInt(m[3], 10) };
}

// Proper streaming CSV tokenizer — respects double-quoted fields that contain
// commas AND newlines. Returns rows of raw string cells. Does not trim; does
// not interpret headers.
function tokenizeCSV(text: string): string[][] {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;

  while (i < clean.length) {
    const ch = clean[i];
    if (inQuotes) {
      if (ch === '"' && clean[i + 1] === '"') {
        // escaped quote
        field += '"';
        i += 2;
        continue;
      }
      if (ch === '"') {
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    // not in quotes
    if (ch === '"') {
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      field = "";
      // drop rows where every cell is empty (stray blank lines)
      if (row.some((c) => c.length > 0)) rows.push(row);
      row = [];
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // final cell + row
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    if (row.some((c) => c.length > 0)) rows.push(row);
  }
  return rows;
}

type ParsedCSV = {
  rows: CSVRow[];
  errors: string[];    // non-fatal row-level parse issues
  fatal: string[];     // blocking errors — Import button disabled when non-empty
};

function parseCSV(text: string): ParsedCSV {
  const tokens = tokenizeCSV(text);
  if (tokens.length < 2) return { rows: [], errors: [], fatal: ["CSV must have a header row and at least one data row"] };

  const rawHeaders = tokens[0].map((h) => normalizeHeader(h));
  const hasConceptCode = rawHeaders.includes("conceptcode") || rawHeaders.includes("modulecode");
  if (!hasConceptCode) {
    return { rows: [], errors: [], fatal: ["CSV must include a 'Concept Code' (or 'Module Code') column"] };
  }

  const rows: CSVRow[] = [];
  const errors: string[] = [];
  // Track each moduleCode → list of CSV row numbers it appeared on, to catch duplicates
  const codeToRowNumbers = new Map<string, number[]>();

  for (let i = 1; i < tokens.length; i++) {
    const values = tokens[i];
    const obj: Partial<CSVRow> = {};
    let gradeFromColumn: number | null = null;

    rawHeaders.forEach((h, idx) => {
      const field = HEADER_MAP[h];
      if (!field) return; // unknown column — ignored
      const raw = (values[idx] ?? "").trim();
      if (!raw) return; // empty cells allowed
      if (field === "grade_ignored") {
        const g = parseInt(raw.replace(/^g/i, ""), 10);
        if (!isNaN(g)) gradeFromColumn = g;
        return;
      }
      obj[field] = raw;
    });

    if (!obj.moduleCode || !obj.moduleCode.trim()) {
      errors.push(`Row ${i + 1}: Concept Code is required`);
      continue;
    }

    const parsed = parseModuleCodeLoose(obj.moduleCode);
    if (!parsed) {
      errors.push(`Row ${i + 1}: invalid Concept Code "${obj.moduleCode}" — expected format G{grade}C{chapter}M{module}, e.g. G6C3M5`);
      continue;
    }

    // If CSV also has a Grade column, validate it matches what's parsed from the code
    if (gradeFromColumn !== null && gradeFromColumn !== parsed.grade) {
      errors.push(`Row ${i + 1}: Grade column (${gradeFromColumn}) does not match Concept Code grade (G${parsed.grade})`);
      continue;
    }

    const normalized = obj.moduleCode.trim().toUpperCase();
    const rowNumber = i + 1; // +1 because header is row 1, so first data row = CSV row 2
    const seen = codeToRowNumbers.get(normalized);
    if (seen) {
      seen.push(rowNumber);
    } else {
      codeToRowNumbers.set(normalized, [rowNumber]);
    }
    rows.push({ ...obj, moduleCode: normalized } as CSVRow);
  }

  // Fatal: any Concept Code appearing on more than one CSV row — upsert would
  // silently overwrite, causing data loss. Block the import until fixed.
  const fatal: string[] = [];
  Array.from(codeToRowNumbers.entries()).forEach(([code, rowNums]) => {
    if (rowNums.length > 1) {
      fatal.push(
        `Duplicate Concept Code "${code}" on CSV rows ${rowNums.join(", ")}. Each module must have a unique code. Rename one of them before importing.`
      );
    }
  });

  return { rows, errors, fatal };
}

// ─── Frozen-column table layout ───
const FROZEN_COL_W = [72, 220]; // px widths for Grade, Chapter
const FROZEN_TOTAL = FROZEN_COL_W.reduce((a, b) => a + b, 0);

function formatBlame(entry: CurriculumEntry): string {
  const who = entry.lastEditedByName ?? "—";
  const when = entry.lastEditedAt ? new Date(entry.lastEditedAt).toISOString().slice(0, 10) : "";
  return when ? `${who} · ${when}` : who;
}

export default function CurriculumPage() {
  const me = useQuery(api.users.me);
  const allEntries = useQuery(api.curriculumMap.listAll, me ? {} : "skip");
  const bulkImport = useMutation(api.curriculumMap.bulkImportCSV);
  const updateRow = useMutation(api.curriculumMap.updateRow);
  const deleteEntry = useMutation(api.curriculumMap.deleteEntry);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [showImport, setShowImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CSVRow[] | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [csvFatal, setCsvFatal] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<Id<"curriculumMap"> | null>(null);
  const [editForm, setEditForm] = useState<Partial<CurriculumEntry>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isAdmin = me?.role === "admin";
  const isManager = me?.role === "manager";
  const canEdit = isAdmin || isManager;

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4000);
    return () => clearTimeout(t);
  }, [toast]);

  const showToast = useCallback((message: string, type: "success" | "error" = "success") => {
    setToast({ message, type });
  }, []);

  if (me === undefined) {
    return <main className="flex items-center justify-center h-[calc(100vh-48px)]"><p className="text-sm text-stone-400">Loading...</p></main>;
  }
  if (me === null) {
    return (
      <main className="flex items-center justify-center h-[calc(100vh-48px)]">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h1 className="text-lg font-semibold text-stone-800">Sign in required</h1>
          <p className="text-sm text-stone-500 mt-2">Please sign in to view the curriculum.</p>
        </div>
      </main>
    );
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const { rows, errors, fatal } = parseCSV(text);
      setCsvPreview(rows);
      setCsvErrors(errors);
      setCsvFatal(fatal);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvPreview || csvPreview.length === 0) return;
    if (csvFatal.length > 0) return; // should be unreachable — button is disabled
    setImporting(true);
    setError(null);
    try {
      let totalInserted = 0;
      let totalUpdated = 0;
      const allErrors: string[] = [];
      for (let i = 0; i < csvPreview.length; i += 100) {
        const chunk = csvPreview.slice(i, i + 100);
        const result = await bulkImport({ rows: chunk });
        totalInserted += result.inserted;
        totalUpdated += result.updated;
        allErrors.push(...result.errors);
      }
      showToast(`Imported ${totalInserted} new, ${totalUpdated} updated`);
      setCsvPreview(null);
      setCsvErrors([]);
      setCsvFatal([]);
      setShowImport(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      if (allErrors.length > 0) setError(`Import warnings: ${allErrors.join("; ")}`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
    }
  }

  function startEdit(entry: CurriculumEntry) {
    setEditingId(entry._id);
    setEditForm({ ...entry });
  }

  async function saveEdit() {
    if (!editingId) return;
    setSaving(true);
    setError(null);
    try {
      await updateRow({
        id: editingId,
        thread: editForm.thread || undefined,
        strand: editForm.strand || undefined,
        tpCode: editForm.tpCode || undefined,
        tpDescription: editForm.tpDescription || undefined,
        chapterName: editForm.chapterName || undefined,
        conceptName: editForm.conceptName || undefined,
        conceptType: editForm.conceptType || undefined,
        conceptDescription: editForm.conceptDescription || undefined,
        proposedLOs: editForm.proposedLOs || undefined,
      });
      setEditingId(null);
      showToast("Entry updated");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: Id<"curriculumMap">) {
    if (!confirm("Delete this curriculum entry?")) return;
    try {
      await deleteEntry({ id });
      showToast("Entry deleted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  const entries: CurriculumEntry[] = (allEntries ?? []) as CurriculumEntry[];
  const filtered = gradeFilter === "all" ? entries : entries.filter((e) => e.grade === gradeFilter);

  // ─────────────────────────── RENDER ───────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden">
      {toast && (
        <div className={`fixed top-14 left-1/2 -translate-x-1/2 z-50 px-5 py-2.5 rounded-lg shadow-lg text-sm font-medium transition-all ${
          toast.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
        }`}>
          {toast.message}
        </div>
      )}

      {/* ── Toolbar ── */}
      <div className="shrink-0 px-6 py-3 border-b border-stone-200 bg-white flex items-center justify-between">
        <div>
          <h1 className="text-[15px] font-semibold text-stone-800">Curriculum Map</h1>
          <p className="text-[11px] text-stone-400 mt-0.5">
            {entries.length} entries across {new Set(entries.map((e) => e.grade)).size} grades
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="px-2.5 py-1.5 text-xs border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-stone-300"
          >
            <option value="all">All Grades</option>
            {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
          </select>
          {canEdit && (
            <button onClick={() => setShowImport(!showImport)}
              className="px-3 py-1.5 text-xs font-medium bg-stone-800 text-white rounded-md hover:bg-stone-700 transition-colors">
              Import CSV
            </button>
          )}
        </div>
      </div>

      {error && (
        <div className="shrink-0 mx-6 mt-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">dismiss</button>
        </div>
      )}

      {/* ── CSV Import Panel ── */}
      {showImport && canEdit && (
        <div className="shrink-0 mx-6 mt-2 bg-white rounded-lg border border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-stone-700">Import CSV</h2>
            <button onClick={() => { setShowImport(false); setCsvPreview(null); setCsvErrors([]); setCsvFatal([]); }}
              className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
          </div>
          <p className="text-[11px] text-stone-400">
            CSV columns: <span className="font-mono">{CSV_HEADERS.join(", ")}</span>. Only Concept Code is required — all other fields may be blank.{" "}
            <button type="button" onClick={() => {
              const blob = new Blob([CSV_HEADERS.join(",") + "\n"], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "curriculum-template.csv"; a.click();
              URL.revokeObjectURL(url);
            }} className="text-emerald-600 hover:text-emerald-700 underline underline-offset-2">Download template CSV</button>
          </p>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="text-xs text-stone-600" />

          {csvFatal.length > 0 && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-[11px] px-3 py-2 rounded-lg space-y-1 max-h-[160px] overflow-auto">
              <p className="font-semibold text-red-800 text-[11px]">Import blocked — fix these issues and re-upload:</p>
              {csvFatal.map((e, i) => <p key={i} className="leading-snug">· {e}</p>)}
            </div>
          )}

          {csvErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded-lg space-y-0.5 max-h-[120px] overflow-auto">
              {csvErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {csvPreview && csvPreview.length > 0 && (
            <div className="space-y-2">
              <p className="text-[11px] text-stone-500">{csvPreview.length} rows ready to import</p>
              <div className="max-h-[200px] overflow-auto border border-stone-200 rounded-lg">
                <table className="w-full text-[11px]">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Code</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Concept Name</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Type</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Concept Desc</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Thread</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Strand</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">TP</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">TP Desc</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Proposed LOs</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="px-2 py-1 font-mono">{row.moduleCode}</td>
                        <td className="px-2 py-1">{row.conceptName ?? ""}</td>
                        <td className="px-2 py-1">{row.conceptType ?? ""}</td>
                        <td className="px-2 py-1 max-w-[180px] truncate">{row.conceptDescription ?? ""}</td>
                        <td className="px-2 py-1">{row.thread ?? ""}</td>
                        <td className="px-2 py-1">{row.strand ?? ""}</td>
                        <td className="px-2 py-1">{row.tpCode ?? ""}</td>
                        <td className="px-2 py-1 max-w-[200px] truncate">{row.tpDescription ?? ""}</td>
                        <td className="px-2 py-1 max-w-[220px] truncate">{row.proposedLOs ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing || csvFatal.length > 0}
                title={csvFatal.length > 0 ? "Import blocked — fix the errors above first" : undefined}
                className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
                {importing ? "Importing..." : csvFatal.length > 0 ? "Import blocked" : `Import ${csvPreview.length} rows`}
              </button>
            </div>
          )}
        </div>
      )}

      {/* ── Main data table ── */}
      {allEntries === undefined ? (
        <div className="flex-1 flex items-center justify-center">
          <p className="text-sm text-stone-400">Loading curriculum data...</p>
        </div>
      ) : filtered.length === 0 ? (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <p className="text-sm text-stone-500">No curriculum entries{gradeFilter !== "all" ? ` for Grade ${gradeFilter}` : ""}.</p>
            {canEdit && <p className="text-[11px] text-stone-400 mt-1">Use Import CSV to get started.</p>}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-4 relative">
          {editingId && (
            <EditOverlay
              editForm={editForm}
              setEditForm={setEditForm}
              saving={saving}
              onSave={saveEdit}
              onCancel={() => setEditingId(null)}
            />
          )}

          <div className="h-full rounded-lg border border-stone-200 bg-white overflow-auto">
            <table className="w-full border-collapse text-[12px]" style={{ minWidth: FROZEN_TOTAL + 1900 }}>
              <thead className="sticky top-0 z-10">
                <tr className="bg-stone-50 border-b border-stone-200">
                  <th className="sticky left-0 z-20 bg-stone-50 text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider border-r border-stone-200"
                    style={{ width: FROZEN_COL_W[0], minWidth: FROZEN_COL_W[0] }}>
                    Grade
                  </th>
                  <th className="sticky z-20 bg-stone-50 text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider border-r border-stone-200"
                    style={{ left: FROZEN_COL_W[0], width: FROZEN_COL_W[1], minWidth: FROZEN_COL_W[1] }}>
                    Chapter
                  </th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 90 }}>Code</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 180 }}>Concept Name</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 80 }}>Type</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 220 }}>Concept Description</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 110 }}>Thread</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 140 }}>Strand</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 110 }}>TP Code</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 280 }}>TP Description</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 280 }}>Proposed LOs</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 150 }}>Last Edited</th>
                  {canEdit && (
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ width: 80 }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => {
                  const prev = idx > 0 ? filtered[idx - 1] : null;
                  const newGrade = !prev || prev.grade !== entry.grade;
                  const newChapter = !prev || prev.grade !== entry.grade || prev.chapterNumber !== entry.chapterNumber;

                  return (
                    <tr key={entry._id}
                      className={`border-b hover:bg-stone-50/80 transition-colors ${newChapter ? "border-stone-200" : "border-stone-100"}`}>
                      <td className={`sticky left-0 z-[5] px-3 py-2 font-mono text-stone-600 border-r border-stone-100 ${newGrade ? "bg-stone-50 font-semibold" : "bg-white"}`}
                        style={{ width: FROZEN_COL_W[0], minWidth: FROZEN_COL_W[0] }}>
                        {newGrade ? `G${entry.grade}` : ""}
                      </td>
                      <td className={`sticky z-[5] px-3 py-2 text-stone-700 border-r border-stone-100 ${newChapter ? "bg-stone-50 font-medium" : "bg-white"}`}
                        style={{ left: FROZEN_COL_W[0], width: FROZEN_COL_W[1], minWidth: FROZEN_COL_W[1] }}>
                        {newChapter ? (
                          <span>
                            <span className="text-stone-400 font-mono text-[11px]">C{entry.chapterNumber}</span>
                            {entry.chapterName && <>
                              <span className="mx-1 text-stone-300">&mdash;</span>
                              <span className="text-[12px]">{entry.chapterName}</span>
                            </>}
                          </span>
                        ) : ""}
                      </td>
                      <td className="px-3 py-2 font-mono text-stone-500 text-[11px]">{entry.moduleCode}</td>
                      <td className="px-3 py-2 text-stone-800 font-medium">{entry.conceptName ?? ""}</td>
                      <td className="px-3 py-2 text-stone-600">{entry.conceptType ?? ""}</td>
                      <td className="px-3 py-2 text-stone-600 leading-snug whitespace-pre-line">{entry.conceptDescription ?? ""}</td>
                      <td className="px-3 py-2 text-stone-500">{entry.thread ?? ""}</td>
                      <td className="px-3 py-2 text-stone-500">{entry.strand ?? ""}</td>
                      <td className="px-3 py-2 text-stone-500 font-mono text-[11px]">{entry.tpCode ?? ""}</td>
                      <td className="px-3 py-2 text-stone-600 leading-snug">{entry.tpDescription ?? ""}</td>
                      <td className="px-3 py-2 text-stone-600 leading-snug">{entry.proposedLOs ?? ""}</td>
                      <td className="px-3 py-2 text-stone-400 text-[11px]">{formatBlame(entry)}</td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(entry)}
                              className="px-1.5 py-0.5 text-[11px] text-stone-400 hover:text-stone-700 hover:bg-stone-100 rounded transition-colors">
                              Edit
                            </button>
                            {isAdmin && (
                              <button onClick={() => handleDelete(entry._id)}
                                className="px-1.5 py-0.5 text-[11px] text-red-300 hover:text-red-600 hover:bg-red-50 rounded transition-colors">
                                Del
                              </button>
                            )}
                          </div>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Edit overlay (modal-style) ───
function EditOverlay({
  editForm, setEditForm, saving, onSave, onCancel,
}: {
  editForm: Partial<CurriculumEntry>;
  setEditForm: (f: Partial<CurriculumEntry>) => void;
  saving: boolean;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 bg-stone-900/20 backdrop-blur-[2px] flex items-start justify-center pt-8 pb-8 overflow-auto">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl w-full max-w-2xl p-5 space-y-3 my-auto">
        <div>
          <h3 className="text-sm font-semibold text-stone-800">
            Edit <span className="font-mono">{editForm.moduleCode}</span>
          </h3>
          <p className="text-[10px] text-stone-400 mt-0.5">Concept Code cannot be edited. Delete and re-import to change it.</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Concept Name" value={editForm.conceptName ?? ""} onChange={(v) => setEditForm({ ...editForm, conceptName: v })} />
          <SelectField label="Concept Type" value={editForm.conceptType ?? ""} options={["", ...CONCEPT_TYPES]} onChange={(v) => setEditForm({ ...editForm, conceptType: v })} />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-0.5">Concept Description</label>
          <textarea value={editForm.conceptDescription ?? ""} onChange={(e) => setEditForm({ ...editForm, conceptDescription: e.target.value })}
            rows={2} className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-300" />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-0.5">Proposed LOs</label>
          <textarea value={editForm.proposedLOs ?? ""} onChange={(e) => setEditForm({ ...editForm, proposedLOs: e.target.value })}
            rows={4} className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-300" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Thread" value={editForm.thread ?? ""} onChange={(v) => setEditForm({ ...editForm, thread: v })} />
          <Field label="Strand" value={editForm.strand ?? ""} onChange={(v) => setEditForm({ ...editForm, strand: v })} />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="TP Code" value={editForm.tpCode ?? ""} onChange={(v) => setEditForm({ ...editForm, tpCode: v })} />
          <Field label="Chapter Name" value={editForm.chapterName ?? ""} onChange={(v) => setEditForm({ ...editForm, chapterName: v })} />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-0.5">TP Description</label>
          <textarea value={editForm.tpDescription ?? ""} onChange={(e) => setEditForm({ ...editForm, tpDescription: e.target.value })}
            rows={3} className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-300" />
        </div>

        <div className="flex gap-2 pt-1">
          <button onClick={onSave} disabled={saving}
            className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50">
            {saving ? "Saving..." : "Save"}
          </button>
          <button onClick={onCancel}
            className="px-4 py-1.5 text-xs text-stone-600 border border-stone-200 rounded-md hover:bg-stone-50">
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-0.5">{label}</label>
      <input value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-300" />
    </div>
  );
}

function SelectField({ label, value, options, onChange }: { label: string; value: string; options: string[]; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-0.5">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)}
        className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md bg-white focus:outline-none focus:ring-1 focus:ring-stone-300">
        {options.map((o) => <option key={o} value={o}>{o || "—"}</option>)}
      </select>
    </div>
  );
}
