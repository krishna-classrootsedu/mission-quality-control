"use client";

import { useState, useRef } from "react";
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
  // Strip BOM and normalize line endings
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
    headers.forEach((h, idx) => {
      obj[h] = (values[idx] ?? "").trim();
    });

    const grade = parseInt(obj["grade"]);
    const chapterNumber = parseInt(obj["chapternumber"]);
    const moduleNumber = parseInt(obj["modulenumber"]);

    if (isNaN(grade) || grade < 1 || grade > 10) {
      errors.push(`Row ${i + 1}: invalid grade "${obj["grade"]}"`);
      continue;
    }
    if (isNaN(chapterNumber) || chapterNumber < 1) {
      errors.push(`Row ${i + 1}: invalid chapterNumber "${obj["chapternumber"]}"`);
      continue;
    }
    if (isNaN(moduleNumber) || moduleNumber < 1) {
      errors.push(`Row ${i + 1}: invalid moduleNumber "${obj["modulenumber"]}"`);
      continue;
    }
    if (!obj["chaptername"]) {
      errors.push(`Row ${i + 1}: chapterName is required`);
      continue;
    }
    if (!obj["modulename"]) {
      errors.push(`Row ${i + 1}: moduleName is required`);
      continue;
    }
    if (!obj["learningoutcomes"]) {
      errors.push(`Row ${i + 1}: learningOutcomes is required`);
      continue;
    }

    rows.push({
      grade,
      chapterNumber,
      chapterName: obj["chaptername"],
      moduleNumber,
      moduleName: obj["modulename"],
      learningOutcomes: obj["learningoutcomes"],
      topic: obj["topic"] || undefined,
      cp: obj["cp"] || undefined,
      tp: obj["tp"] || undefined,
      phase: obj["phase"] || undefined,
      prerequisites: obj["prerequisites"] || undefined,
      keyVocabulary: obj["keyvocabulary"] || undefined,
      conceptsCovered: obj["conceptscovered"] || undefined,
    });
  }

  return { rows, errors };
}

// Parse a single CSV line handling quoted fields
function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"' && line[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current);
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current);
  return result;
}

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
  const [importResult, setImportResult] = useState<{ inserted: number; updated: number; errors: string[] } | null>(null);
  const [expandedChapter, setExpandedChapter] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<Id<"curriculumMap"> | null>(null);
  const [editForm, setEditForm] = useState<Partial<CurriculumEntry>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const isAdmin = me?.role === "admin";
  const isManager = me?.role === "manager";
  const canEdit = isAdmin || isManager;

  if (me === undefined) {
    return (
      <main className="max-w-[1100px] mx-auto px-6 py-6">
        <p className="text-sm text-stone-400">Loading...</p>
      </main>
    );
  }

  if (me === null) {
    return (
      <main className="max-w-[1100px] mx-auto px-6 py-6">
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
    setImportResult(null);
    setError(null);
    setSuccess(null);

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
      // Batch in chunks of 100
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

      setImportResult({ inserted: totalInserted, updated: totalUpdated, errors: allErrors });
      setSuccess(`Import complete: ${totalInserted} inserted, ${totalUpdated} updated`);
      setCsvPreview(null);
      setCsvErrors([]);
      if (fileInputRef.current) fileInputRef.current.value = "";
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
        grade: editForm.grade,
        chapterNumber: editForm.chapterNumber,
        chapterName: editForm.chapterName,
        moduleNumber: editForm.moduleNumber,
        moduleName: editForm.moduleName,
        learningOutcomes: editForm.learningOutcomes,
        topic: editForm.topic || undefined,
        cp: editForm.cp || undefined,
        tp: editForm.tp || undefined,
        phase: editForm.phase || undefined,
        prerequisites: editForm.prerequisites || undefined,
        keyVocabulary: editForm.keyVocabulary || undefined,
        conceptsCovered: editForm.conceptsCovered || undefined,
      });
      setEditingId(null);
      setSuccess("Entry updated");
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
      setSuccess("Entry deleted");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to delete");
    }
  }

  // Group entries by grade → chapter
  const entries = allEntries ?? [];
  const filtered = gradeFilter === "all" ? entries : entries.filter((e) => e.grade === gradeFilter);

  const grouped: Record<string, { chapterName: string; grade: number; chapterNumber: number; modules: typeof entries }> = {};
  for (const e of filtered) {
    const key = `${e.grade}-${e.chapterNumber}`;
    if (!grouped[key]) {
      grouped[key] = { chapterName: e.chapterName, grade: e.grade, chapterNumber: e.chapterNumber, modules: [] };
    }
    grouped[key].modules.push(e);
  }

  const sortedGroups = Object.entries(grouped).sort(([, a], [, b]) => a.grade - b.grade || a.chapterNumber - b.chapterNumber);

  return (
    <main className="max-w-[1100px] mx-auto px-6 py-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold text-stone-800">Curriculum Map</h1>
          <p className="text-xs text-stone-500 mt-1">
            Browse the curriculum hierarchy. {entries.length} entries across {new Set(entries.map((e) => e.grade)).size} grades.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <select
            value={gradeFilter}
            onChange={(e) => setGradeFilter(e.target.value === "all" ? "all" : parseInt(e.target.value))}
            className="px-3 py-1.5 text-sm border border-stone-200 rounded-lg bg-white"
          >
            <option value="all">All Grades</option>
            {GRADES.map((g) => (
              <option key={g} value={g}>Grade {g}</option>
            ))}
          </select>
          {isAdmin && (
            <button
              onClick={() => setShowImport(!showImport)}
              className="px-3 py-1.5 text-sm bg-stone-800 text-white rounded-lg hover:bg-stone-700"
            >
              {showImport ? "Close Import" : "Import CSV"}
            </button>
          )}
        </div>
      </div>

      {/* Status messages */}
      {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm px-4 py-2 rounded-lg">{error}</div>}
      {success && <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-2 rounded-lg">{success}</div>}

      {/* CSV Import Panel */}
      {showImport && isAdmin && (
        <section className="bg-white rounded-lg border border-stone-200 p-4 space-y-3">
          <h2 className="text-sm font-medium text-stone-700">Import CSV</h2>
          <p className="text-xs text-stone-500">
            Required columns: grade, chapterNumber, chapterName, moduleNumber, moduleName, learningOutcomes.
            Optional: topic, cp, tp, phase, prerequisites, keyVocabulary, conceptsCovered.
          </p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".csv"
            onChange={handleFileSelect}
            className="text-sm text-stone-600"
          />

          {csvErrors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg space-y-1">
              {csvErrors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}

          {csvPreview && csvPreview.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs text-stone-600">{csvPreview.length} rows ready to import:</p>
              <div className="max-h-[300px] overflow-auto border border-stone-200 rounded-lg">
                <table className="w-full text-xs">
                  <thead className="bg-stone-50 sticky top-0">
                    <tr>
                      <th className="px-2 py-1.5 text-left text-stone-600 font-medium">Grade</th>
                      <th className="px-2 py-1.5 text-left text-stone-600 font-medium">Ch</th>
                      <th className="px-2 py-1.5 text-left text-stone-600 font-medium">Chapter Name</th>
                      <th className="px-2 py-1.5 text-left text-stone-600 font-medium">Mod</th>
                      <th className="px-2 py-1.5 text-left text-stone-600 font-medium">Module Name</th>
                      <th className="px-2 py-1.5 text-left text-stone-600 font-medium">Learning Outcomes</th>
                      <th className="px-2 py-1.5 text-left text-stone-600 font-medium">Topic</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-stone-100">
                    {csvPreview.map((row, i) => (
                      <tr key={i} className="hover:bg-stone-50">
                        <td className="px-2 py-1.5">{row.grade}</td>
                        <td className="px-2 py-1.5">{row.chapterNumber}</td>
                        <td className="px-2 py-1.5">{row.chapterName}</td>
                        <td className="px-2 py-1.5">{row.moduleNumber}</td>
                        <td className="px-2 py-1.5">{row.moduleName}</td>
                        <td className="px-2 py-1.5 max-w-[250px] truncate">{row.learningOutcomes}</td>
                        <td className="px-2 py-1.5">{row.topic ?? "—"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button
                onClick={handleImport}
                disabled={importing}
                className="px-4 py-2 text-sm bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50"
              >
                {importing ? "Importing..." : `Import ${csvPreview.length} rows`}
              </button>
            </div>
          )}

          {importResult && importResult.errors.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 text-xs px-3 py-2 rounded-lg space-y-1">
              <p className="font-medium">Import warnings:</p>
              {importResult.errors.map((e, i) => <p key={i}>{e}</p>)}
            </div>
          )}
        </section>
      )}

      {/* Curriculum Tree */}
      {allEntries === undefined ? (
        <p className="text-sm text-stone-400">Loading curriculum data...</p>
      ) : sortedGroups.length === 0 ? (
        <div className="bg-white rounded-lg border border-stone-200 p-6 text-center">
          <p className="text-sm text-stone-500">No curriculum entries yet.</p>
          {isAdmin && <p className="text-xs text-stone-400 mt-1">Use Import CSV to populate the curriculum map.</p>}
        </div>
      ) : (
        <div className="space-y-2">
          {sortedGroups.map(([key, group]) => {
            const isExpanded = expandedChapter === key;
            return (
              <div key={key} className="bg-white rounded-lg border border-stone-200 overflow-hidden">
                {/* Chapter header */}
                <button
                  onClick={() => setExpandedChapter(isExpanded ? null : key)}
                  className="w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xs font-mono bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                      G{group.grade} C{group.chapterNumber}
                    </span>
                    <span className="text-sm font-medium text-stone-800">{group.chapterName}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-stone-400">{group.modules.length} modules</span>
                    <span className="text-stone-400 text-xs">{isExpanded ? "▲" : "▼"}</span>
                  </div>
                </button>

                {/* Module list */}
                {isExpanded && (
                  <div className="border-t border-stone-100">
                    {group.modules.map((entry) => (
                      <div key={entry._id} className="border-b border-stone-50 last:border-b-0">
                        {editingId === entry._id ? (
                          /* Edit form */
                          <div className="px-4 py-3 bg-stone-50 space-y-2">
                            <div className="grid grid-cols-2 gap-2">
                              <div>
                                <label className="text-xs text-stone-500">Module Name</label>
                                <input
                                  value={editForm.moduleName ?? ""}
                                  onChange={(e) => setEditForm({ ...editForm, moduleName: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-stone-200 rounded"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-stone-500">Topic</label>
                                <input
                                  value={editForm.topic ?? ""}
                                  onChange={(e) => setEditForm({ ...editForm, topic: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-stone-200 rounded"
                                />
                              </div>
                            </div>
                            <div>
                              <label className="text-xs text-stone-500">Learning Outcomes</label>
                              <textarea
                                value={editForm.learningOutcomes ?? ""}
                                onChange={(e) => setEditForm({ ...editForm, learningOutcomes: e.target.value })}
                                rows={3}
                                className="w-full px-2 py-1.5 text-sm border border-stone-200 rounded"
                              />
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                              <div>
                                <label className="text-xs text-stone-500">Prerequisites</label>
                                <input
                                  value={editForm.prerequisites ?? ""}
                                  onChange={(e) => setEditForm({ ...editForm, prerequisites: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-stone-200 rounded"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-stone-500">Key Vocabulary</label>
                                <input
                                  value={editForm.keyVocabulary ?? ""}
                                  onChange={(e) => setEditForm({ ...editForm, keyVocabulary: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-stone-200 rounded"
                                />
                              </div>
                              <div>
                                <label className="text-xs text-stone-500">Concepts Covered</label>
                                <input
                                  value={editForm.conceptsCovered ?? ""}
                                  onChange={(e) => setEditForm({ ...editForm, conceptsCovered: e.target.value })}
                                  className="w-full px-2 py-1.5 text-sm border border-stone-200 rounded"
                                />
                              </div>
                            </div>
                            <div className="flex gap-2">
                              <button onClick={saveEdit} disabled={saving} className="px-3 py-1 text-xs bg-emerald-600 text-white rounded hover:bg-emerald-700 disabled:opacity-50">
                                {saving ? "Saving..." : "Save"}
                              </button>
                              <button onClick={() => setEditingId(null)} className="px-3 py-1 text-xs text-stone-600 border border-stone-200 rounded hover:bg-stone-100">
                                Cancel
                              </button>
                            </div>
                          </div>
                        ) : (
                          /* Display row */
                          <div className="px-4 py-3 hover:bg-stone-50 transition-colors">
                            <div className="flex items-start justify-between">
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-mono text-stone-500">M{entry.moduleNumber}</span>
                                  <span className="text-sm font-medium text-stone-800">{entry.moduleName}</span>
                                  {entry.topic && (
                                    <span className="text-xs bg-stone-100 text-stone-500 px-1.5 py-0.5 rounded">{entry.topic}</span>
                                  )}
                                </div>
                                <p className="text-xs text-stone-600 mt-1 whitespace-pre-line">{entry.learningOutcomes}</p>
                                {(entry.prerequisites || entry.conceptsCovered || entry.keyVocabulary) && (
                                  <div className="flex gap-4 mt-1.5">
                                    {entry.prerequisites && (
                                      <span className="text-xs text-stone-400"><span className="font-medium">Prerequisites:</span> {entry.prerequisites}</span>
                                    )}
                                    {entry.conceptsCovered && (
                                      <span className="text-xs text-stone-400"><span className="font-medium">Concepts:</span> {entry.conceptsCovered}</span>
                                    )}
                                    {entry.keyVocabulary && (
                                      <span className="text-xs text-stone-400"><span className="font-medium">Vocabulary:</span> {entry.keyVocabulary}</span>
                                    )}
                                  </div>
                                )}
                              </div>
                              {canEdit && (
                                <div className="flex gap-1 ml-2 shrink-0">
                                  <button
                                    onClick={() => startEdit(entry as CurriculumEntry)}
                                    className="px-2 py-1 text-xs text-stone-500 hover:text-stone-800 hover:bg-stone-100 rounded"
                                  >
                                    Edit
                                  </button>
                                  {isAdmin && (
                                    <button
                                      onClick={() => handleDelete(entry._id)}
                                      className="px-2 py-1 text-xs text-red-400 hover:text-red-600 hover:bg-red-50 rounded"
                                    >
                                      Delete
                                    </button>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}
