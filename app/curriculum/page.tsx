"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

type CurriculumEntry = {
  _id: Id<"curriculumMap">;
  grade: number;
  chapterNumber: number;
  chapterName: string;
  moduleNumber: number;
  moduleName: string;
  learningOutcomes: string;
  topic?: string;
  cp?: string;
  tp?: string;
  phase?: string;
  prerequisites?: string;
  keyVocabulary?: string;
  conceptsCovered?: string;
};

type CSVRow = {
  grade: number;
  chapterNumber: number;
  chapterName: string;
  moduleNumber: number;
  moduleName: string;
  learningOutcomes: string;
  topic?: string;
  cp?: string;
  tp?: string;
  phase?: string;
  prerequisites?: string;
  keyVocabulary?: string;
  conceptsCovered?: string;
};

function parseCSV(text: string): { rows: CSVRow[]; errors: string[] } {
  const clean = text.replace(/^\uFEFF/, "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  const lines = clean.split("\n").filter((l) => l.trim().length > 0);
  if (lines.length < 2) return { rows: [], errors: ["CSV must have a header row and at least one data row"] };

  const headers = parseCSVLine(lines[0]).map((h) => h.trim().toLowerCase());
  const requiredHeaders = ["grade", "chapternumber", "chaptername", "modulenumber", "modulename", "learningoutcomes"];
  const missing = requiredHeaders.filter((h) => !headers.includes(h));
  if (missing.length > 0) return { rows: [], errors: [`Missing required headers: ${missing.join(", ")}`] };

  const rows: CSVRow[] = [];
  const errors: string[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i]);
    const obj: Record<string, string> = {};
    headers.forEach((h, idx) => { obj[h] = (values[idx] ?? "").trim(); });

    const grade = parseInt(obj["grade"]);
    const chapterNumber = parseInt(obj["chapternumber"]);
    const moduleNumber = parseInt(obj["modulenumber"]);

    if (isNaN(grade) || grade < 1 || grade > 10) { errors.push(`Row ${i + 1}: invalid grade`); continue; }
    if (isNaN(chapterNumber) || chapterNumber < 1) { errors.push(`Row ${i + 1}: invalid chapterNumber`); continue; }
    if (isNaN(moduleNumber) || moduleNumber < 1) { errors.push(`Row ${i + 1}: invalid moduleNumber`); continue; }
    if (!obj["chaptername"]) { errors.push(`Row ${i + 1}: chapterName is required`); continue; }
    if (!obj["modulename"]) { errors.push(`Row ${i + 1}: moduleName is required`); continue; }
    if (!obj["learningoutcomes"]) { errors.push(`Row ${i + 1}: learningOutcomes is required`); continue; }

    rows.push({
      grade, chapterNumber, chapterName: obj["chaptername"], moduleNumber,
      moduleName: obj["modulename"], learningOutcomes: obj["learningoutcomes"],
      topic: obj["topic"] || undefined, cp: obj["cp"] || undefined, tp: obj["tp"] || undefined,
      phase: obj["phase"] || undefined, prerequisites: obj["prerequisites"] || undefined,
      keyVocabulary: obj["keyvocabulary"] || undefined, conceptsCovered: obj["conceptscovered"] || undefined,
    });
  }
  return { rows, errors };
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') { current += '"'; i++; }
      else if (ch === '"') { inQuotes = false; }
      else { current += ch; }
    } else {
      if (ch === '"') { inQuotes = true; }
      else if (ch === ",") { result.push(current); current = ""; }
      else { current += ch; }
    }
  }
  result.push(current);
  return result;
}

// ─── Frozen-column table styles (CSS-in-JS for sticky positioning) ───
const FROZEN_COL_W = [64, 220]; // px widths for Grade, Chapter
const FROZEN_TOTAL = FROZEN_COL_W.reduce((a, b) => a + b, 0);

export default function CurriculumPage() {
  const me = useQuery(api.users.me);
  const allEntries = useQuery(api.curriculumMap.listAll, me ? {} : "skip");
  const bulkImport = useMutation(api.curriculumMap.bulkImportCSV);
  const upsertEntry = useMutation(api.curriculumMap.upsertEntry);
  const deleteEntry = useMutation(api.curriculumMap.deleteEntry);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [gradeFilter, setGradeFilter] = useState<number | "all">("all");
  const [showImport, setShowImport] = useState(false);
  const [csvPreview, setCsvPreview] = useState<CSVRow[] | null>(null);
  const [csvErrors, setCsvErrors] = useState<string[]>([]);
  const [importing, setImporting] = useState(false);
  const [editingId, setEditingId] = useState<Id<"curriculumMap"> | null>(null);
  const [editForm, setEditForm] = useState<Partial<CurriculumEntry>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);

  const isAdmin = me?.role === "admin";
  const isManager = me?.role === "manager";
  const canEdit = isAdmin || isManager;

  // Auto-dismiss toast
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
      const { rows, errors } = parseCSV(text);
      setCsvPreview(rows);
      setCsvErrors(errors);
    };
    reader.readAsText(file);
  }

  async function handleImport() {
    if (!csvPreview || csvPreview.length === 0) return;
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
      showToast(`Imported ${totalInserted} new entries${totalUpdated > 0 ? `, ${totalUpdated} updated` : ""}`);
      setCsvPreview(null);
      setCsvErrors([]);
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
    if (!editForm.grade || !editForm.chapterNumber || !editForm.moduleNumber || !editForm.chapterName || !editForm.moduleName || !editForm.learningOutcomes) return;
    setSaving(true);
    setError(null);
    try {
      await upsertEntry({
        grade: editForm.grade, chapterNumber: editForm.chapterNumber, chapterName: editForm.chapterName,
        moduleNumber: editForm.moduleNumber, moduleName: editForm.moduleName, learningOutcomes: editForm.learningOutcomes,
        topic: editForm.topic || undefined, cp: editForm.cp || undefined, tp: editForm.tp || undefined,
        phase: editForm.phase || undefined, prerequisites: editForm.prerequisites || undefined,
        keyVocabulary: editForm.keyVocabulary || undefined, conceptsCovered: editForm.conceptsCovered || undefined,
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

  const entries = allEntries ?? [];
  const filtered = gradeFilter === "all" ? entries : entries.filter((e) => e.grade === gradeFilter);

  // ─────────────────────────── RENDER ───────────────────────────

  return (
    <div className="flex flex-col h-[calc(100vh-48px)] overflow-hidden">
      {/* ── Toast notification ── */}
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

      {/* ── Error bar ── */}
      {error && (
        <div className="shrink-0 mx-6 mt-2 bg-red-50 border border-red-200 text-red-700 text-xs px-4 py-2 rounded-lg">
          {error}
          <button onClick={() => setError(null)} className="ml-2 text-red-400 hover:text-red-600">dismiss</button>
        </div>
      )}

      {/* ── CSV Import Panel (slides down) ── */}
      {showImport && canEdit && (
        <div className="shrink-0 mx-6 mt-2 bg-white rounded-lg border border-stone-200 p-4 space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-medium text-stone-700">Import CSV</h2>
            <button onClick={() => { setShowImport(false); setCsvPreview(null); setCsvErrors([]); }}
              className="text-xs text-stone-400 hover:text-stone-600">Cancel</button>
          </div>
          <p className="text-[11px] text-stone-400">
            Upload a CSV with your curriculum data.{" "}
            <button type="button" onClick={() => {
              const headers = "grade,chapterNumber,chapterName,moduleNumber,moduleName,learningOutcomes,topic,cp,tp,phase,prerequisites,keyVocabulary,conceptsCovered";
              const blob = new Blob([headers + "\n"], { type: "text/csv" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url; a.download = "curriculum-template.csv"; a.click();
              URL.revokeObjectURL(url);
            }} className="text-emerald-600 hover:text-emerald-700 underline underline-offset-2">Download template CSV</button>
          </p>
          <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileSelect} className="text-xs text-stone-600" />

          {csvErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-[11px] px-3 py-2 rounded-lg space-y-0.5">
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
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Gr</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Ch</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Chapter</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">M#</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Module</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Learning Outcomes</th>
                      <th className="px-2 py-1.5 text-left text-stone-500 font-medium">Topic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="px-2 py-1">{row.grade}</td>
                        <td className="px-2 py-1">{row.chapterNumber}</td>
                        <td className="px-2 py-1">{row.chapterName}</td>
                        <td className="px-2 py-1">{row.moduleNumber}</td>
                        <td className="px-2 py-1">{row.moduleName}</td>
                        <td className="px-2 py-1 max-w-[220px] truncate">{row.learningOutcomes}</td>
                        <td className="px-2 py-1">{row.topic ?? ""}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={handleImport} disabled={importing}
                className="px-4 py-1.5 text-xs font-medium bg-emerald-600 text-white rounded-md hover:bg-emerald-700 disabled:opacity-50 transition-colors">
                {importing ? "Importing..." : `Import ${csvPreview.length} rows`}
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
            {isAdmin && <p className="text-[11px] text-stone-400 mt-1">Use Import CSV to get started.</p>}
          </div>
        </div>
      ) : (
        <div className="flex-1 min-h-0 p-4 relative">
          {/* Edit overlay */}
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
            <table className="w-full border-collapse text-[12px]" style={{ minWidth: FROZEN_TOTAL + 800 }}>
              {/* ── Frozen header ── */}
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
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ width: 48 }}>M#</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 160 }}>Module Name</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 280 }}>Learning Outcomes</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 100 }}>Topic</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 200 }}>Concepts Covered</th>
                  <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ minWidth: 140 }}>Prerequisites</th>
                  {canEdit && (
                    <th className="text-left px-3 py-2.5 text-[10px] font-semibold text-stone-500 uppercase tracking-wider" style={{ width: 80 }}></th>
                  )}
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, idx) => {
                  // Determine if this is the first row of a grade or chapter group (for visual grouping)
                  const prev = idx > 0 ? filtered[idx - 1] : null;
                  const newGrade = !prev || prev.grade !== entry.grade;
                  const newChapter = !prev || prev.grade !== entry.grade || prev.chapterNumber !== entry.chapterNumber;

                  return (
                    <tr key={entry._id}
                      className={`border-b hover:bg-stone-50/80 transition-colors ${newChapter ? "border-stone-200" : "border-stone-100"}`}>
                      {/* ── Frozen: Grade ── */}
                      <td className={`sticky left-0 z-[5] px-3 py-2 font-mono text-stone-600 border-r border-stone-100 ${newGrade ? "bg-stone-50 font-semibold" : "bg-white"}`}
                        style={{ width: FROZEN_COL_W[0], minWidth: FROZEN_COL_W[0] }}>
                        {newGrade ? `G${entry.grade}` : ""}
                      </td>
                      {/* ── Frozen: Chapter ── */}
                      <td className={`sticky z-[5] px-3 py-2 text-stone-700 border-r border-stone-100 ${newChapter ? "bg-stone-50 font-medium" : "bg-white"}`}
                        style={{ left: FROZEN_COL_W[0], width: FROZEN_COL_W[1], minWidth: FROZEN_COL_W[1] }}>
                        {newChapter ? (
                          <span>
                            <span className="text-stone-400 font-mono text-[11px]">C{entry.chapterNumber}</span>
                            <span className="mx-1 text-stone-300">&mdash;</span>
                            <span className="text-[12px]">{entry.chapterName}</span>
                          </span>
                        ) : ""}
                      </td>
                      {/* ── Scrollable columns ── */}
                      <td className="px-3 py-2 font-mono text-stone-500 text-center">{entry.moduleNumber}</td>
                      <td className="px-3 py-2 text-stone-800 font-medium">{entry.moduleName}</td>
                      <td className="px-3 py-2 text-stone-600 leading-snug">{entry.learningOutcomes}</td>
                      <td className="px-3 py-2 text-stone-500">{entry.topic ?? ""}</td>
                      <td className="px-3 py-2 text-stone-500 leading-snug">{entry.conceptsCovered ?? ""}</td>
                      <td className="px-3 py-2 text-stone-500">{entry.prerequisites ?? ""}</td>
                      {canEdit && (
                        <td className="px-3 py-2">
                          <div className="flex gap-1">
                            <button onClick={() => startEdit(entry as CurriculumEntry)}
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
    <div className="absolute inset-0 z-30 bg-stone-900/20 backdrop-blur-[2px] flex items-start justify-center pt-12">
      <div className="bg-white rounded-lg border border-stone-200 shadow-xl w-full max-w-lg p-5 space-y-3">
        <h3 className="text-sm font-semibold text-stone-800">
          Edit: G{editForm.grade} C{editForm.chapterNumber} M{editForm.moduleNumber}
        </h3>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Module Name" value={editForm.moduleName ?? ""} onChange={(v) => setEditForm({ ...editForm, moduleName: v })} />
          <Field label="Topic" value={editForm.topic ?? ""} onChange={(v) => setEditForm({ ...editForm, topic: v })} />
        </div>

        <div>
          <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-wider mb-0.5">Learning Outcomes</label>
          <textarea value={editForm.learningOutcomes ?? ""} onChange={(e) => setEditForm({ ...editForm, learningOutcomes: e.target.value })}
            rows={3} className="w-full px-2.5 py-1.5 text-[13px] border border-stone-200 rounded-md focus:outline-none focus:ring-1 focus:ring-stone-300" />
        </div>

        <div className="grid grid-cols-2 gap-2">
          <Field label="Prerequisites" value={editForm.prerequisites ?? ""} onChange={(v) => setEditForm({ ...editForm, prerequisites: v })} />
          <Field label="Key Vocabulary" value={editForm.keyVocabulary ?? ""} onChange={(v) => setEditForm({ ...editForm, keyVocabulary: v })} />
        </div>

        <Field label="Concepts Covered" value={editForm.conceptsCovered ?? ""} onChange={(v) => setEditForm({ ...editForm, conceptsCovered: v })} />

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
