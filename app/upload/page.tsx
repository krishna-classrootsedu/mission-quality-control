"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { createPortal } from "react-dom";
import { useMutation, useAction, useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  sequenceModuleFlow,
  describeModuleFlow,
  SourceSlide,
} from "@/lib/moduleFlow";

const GRADES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const TOPICS = [
  "Fractions", "Decimals", "Geometry", "Measurement",
  "Data Handling", "Whole Numbers", "Algebra", "Other",
];

type ParsedFile = {
  file: File;
  slides: SourceSlide[];
  parsing: boolean;
  error: string;
};

type AppletEntry = {
  label: string;
  afterSpineSlide: number;
  parsed: ParsedFile | null;
};

type TranscriptEntry = {
  id: string;
  sourceSlideNumber: number;
  mode: "textbox" | "file";
  content: string;
  fileName?: string;
  parseError?: string;
};

function stripRtf(rtf: string): string {
  return rtf
    .replace(/\\par[d]?/g, "\n")
    .replace(/\\'[0-9a-fA-F]{2}/g, "")
    .replace(/\\[a-z]+[0-9]*\s?/g, "")
    .replace(/[{}]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

async function extractPdfText(file: File): Promise<string> {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc = `https://unpkg.com/pdfjs-dist@${pdfjs.version}/legacy/build/pdf.worker.min.mjs`;
  }
  const data = new Uint8Array(await file.arrayBuffer());
  const doc = await pdfjs.getDocument({ data }).promise;
  const chunks: string[] = [];
  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const textContent = await page.getTextContent();
    const pageText = textContent.items
      .map((item) => ("str" in item ? item.str : ""))
      .join(" ");
    chunks.push(pageText);
  }
  return chunks.join("\n").trim();
}

async function extractTranscriptText(file: File): Promise<string> {
  const lowerName = file.name.toLowerCase();
  if (lowerName.endsWith(".pdf")) {
    return extractPdfText(file);
  }
  if (lowerName.endsWith(".docx")) {
    const mammoth = await import("mammoth");
    const result = await mammoth.extractRawText({ arrayBuffer: await file.arrayBuffer() });
    return result.value.trim();
  }
  if (lowerName.endsWith(".rtf")) {
    return stripRtf(await file.text());
  }
  return (await file.text()).trim();
}

function isAppletFile(name: string): boolean {
  return /^G\d+C\d+M\d+A\d+/i.test(name) || /[\s_-]A\d+[\s_.-]/i.test(name);
}

type CorrectableModule = {
  _id: string;
  moduleId: string;
  title: string;
  version: number;
  grade: number;
  chapterNumber: number | null;
  chapterName: string | null;
  moduleNumber: number | null;
  status: string;
  overallScore: number | null;
  scoreBand: string | null;
  updatedAt: string;
};

export default function UploadPage() {
  const router = useRouter();
  const spineFileRef = useRef<HTMLInputElement>(null);
  const me = useQuery(api.users.me);

  const submitWithFlow = useMutation(api.modules.submitModuleWithFlow);
  const submitCorrections = useMutation(api.modules.submitCorrections);
  const generateUploadUrl = useMutation(api.modules.generateUploadUrl);
  const parsePptx = useAction(api.parser.parsePptx);

  // Mode: new module or corrections submission
  const [mode, setMode] = useState<"new" | "corrections">("new");
  const [selectedModule, setSelectedModule] = useState<CorrectableModule | null>(null);
  const [corrGrade, setCorrGrade] = useState<number | "">("");
  const [corrChapter, setCorrChapter] = useState<number | "">("");
  const correctableModules = useQuery(api.modules.correctableModules, me ? {} : "skip");

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [grade, setGrade] = useState<number>(4);
  const [chapterNumber, setChapterNumber] = useState<number | "">("");
  const [chapterName, setChapterName] = useState("");
  const [moduleNumber, setModuleNumber] = useState<number | "">("");
  const [topic, setTopic] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [curriculumMode, setCurriculumMode] = useState<"auto" | "manual">("auto");
  const [selectedCurriculumId, setSelectedCurriculumId] = useState<Id<"curriculumMap"> | null>(null);
  const [curriculumFilled, setCurriculumFilled] = useState(false);
  const [spineParsed, setSpineParsed] = useState<ParsedFile | null>(null);
  const [applets, setApplets] = useState<AppletEntry[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitProgress, setSubmitProgress] = useState("");
  const [error, setError] = useState("");
  const [autoDetected, setAutoDetected] = useState(false);

  const isCorrections = mode === "corrections";

  // Curriculum cascading queries
  const curriculumChapters = useQuery(
    api.curriculumMap.listByGrade,
    mode === "new" ? { grade } : "skip"
  );
  const curriculumModules = useQuery(
    api.curriculumMap.listByGradeChapter,
    mode === "new" && chapterNumber !== "" ? { grade, chapterNumber: chapterNumber as number } : "skip"
  );

  useEffect(() => {
    if (mode !== "new") return;
    if (submittedBy.trim().length > 0) return;
    if (me?.name && me.name.trim().length > 0) {
      setSubmittedBy(me.name.trim());
    }
  }, [me?.name, mode, submittedBy]);

  // Auto-fill from curriculum when a matching entry exists
  useEffect(() => {
    if (mode !== "new" || curriculumMode !== "auto" || !curriculumModules || moduleNumber === "") return;
    const match = curriculumModules.find((m) => m.moduleNumber === moduleNumber);
    if (match) {
      if (match.conceptName) setTitle(match.conceptName);
      if (match.proposedLOs) setLearningObjective(match.proposedLOs);
      if (match.chapterName) setChapterName(match.chapterName);
      setSelectedCurriculumId(match._id);
      setCurriculumFilled(true);
    } else {
      setSelectedCurriculumId(null);
      setCurriculumFilled(false);
    }
  }, [curriculumModules, moduleNumber, mode, curriculumMode]);

  const spineSlideCount = spineParsed?.slides.length ?? 0;
  const spineReady = !!spineParsed && !spineParsed.parsing && spineParsed.slides.length > 0 && !spineParsed.error;

  function addTranscriptRow() {
    setTranscripts((prev) => [
      ...prev,
      {
        id: crypto.randomUUID(),
        sourceSlideNumber: 1,
        mode: "textbox",
        content: "",
      },
    ]);
  }

  function updateTranscriptRow(id: string, patch: Partial<TranscriptEntry>) {
    setTranscripts((prev) => prev.map((t) => (t.id === id ? { ...t, ...patch } : t)));
  }

  function removeTranscriptRow(id: string) {
    setTranscripts((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleTranscriptFileSelect(id: string, file?: File) {
    if (!file) return;
    try {
      const content = await extractTranscriptText(file);
      if (!content) {
        updateTranscriptRow(id, {
          parseError: "Could not extract text from this file. For .doc use .docx/.pdf/.txt or paste transcript text.",
          fileName: file.name,
          content: "",
        });
        return;
      }
      updateTranscriptRow(id, {
        mode: "file",
        fileName: file.name,
        parseError: undefined,
        content,
      });
    } catch {
      updateTranscriptRow(id, {
        parseError: "Failed to read this file. Try .txt/.md/.docx/.pdf/.rtf/.csv or paste transcript text.",
        fileName: file.name,
      });
    }
  }

  function validateTranscripts(): string | null {
    const used = new Set<number>();
    for (const t of transcripts) {
      if (t.sourceSlideNumber < 1 || t.sourceSlideNumber > spineSlideCount) {
        return `Transcript slide number must be between 1 and ${spineSlideCount}.`;
      }
      if (used.has(t.sourceSlideNumber)) {
        return `Duplicate transcript for spine slide ${t.sourceSlideNumber}. Keep one transcript per slide.`;
      }
      used.add(t.sourceSlideNumber);
      if (!t.content.trim()) {
        return `Transcript content is empty for spine slide ${t.sourceSlideNumber}.`;
      }
    }
    return null;
  }

  async function parseFile(file: File): Promise<SourceSlide[]> {
    const uploadUrl = await generateUploadUrl();
    const uploadResult = await fetch(uploadUrl, {
      method: "POST",
      headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
      body: file,
    });
    if (!uploadResult.ok) throw new Error("Failed to upload file for parsing");
    const { storageId } = await uploadResult.json();
    const parsed = await parsePptx({ storageId });
    const rawSlides: Array<Record<string, unknown>> = Array.isArray(parsed)
      ? parsed
      : (parsed as Record<string, unknown>).slides as Array<Record<string, unknown>> ?? [];
    return rawSlides.map(
      (s: Record<string, unknown>, idx: number): SourceSlide => ({
        sourceFile: "",
        sourceSlideNumber: (s.slide_number as number) ?? (s.sourceSlideNumber as number) ?? idx + 1,
        textContent: (s.text_content as string) ?? (s.textContent as string),
        speakerNotes: (s.speaker_notes as string) ?? (s.speakerNotes as string),
        layoutType: (s.layout_type as string) ?? (s.layoutType as string),
        hasAnimation: (s.has_animation as boolean) ?? (s.hasAnimation as boolean),
        animationSequence: s.animation_sequence ?? s.animationSequence,
        morphPairWith: (s.morphPairWith as number) ?? (s.morph_pair_with as number) ?? undefined,
        metadata: s.metadata,
        thumbnailStorageId: (s.thumbnailStorageId as string) ?? undefined,
      })
    );
  }

  async function handleSpineSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".pptx")) { setError("Only .pptx files are accepted"); return; }
    // Reject applet storyboards — spine deck only
    if (isAppletFile(f.name)) {
      setError("This looks like an applet storyboard (has A1/A2/A3 in the name). Please upload the spine deck here. Applet storyboards are uploaded in the next step.");
      return;
    }
    setError("");
    setTranscripts([]);
    // Smart-fill from filename
    const match = f.name.match(/^G(\d+)C(\d+)M(\d+)/i);
    if (match) {
      setGrade(parseInt(match[1]));
      setChapterNumber(parseInt(match[2]));
      setModuleNumber(parseInt(match[3]));
      setAutoDetected(true);
      setCurriculumMode("auto");
    } else {
      setAutoDetected(false);
    }
    if (!title) setTitle(f.name.replace(/\.pptx$/i, "").replace(/[-_]/g, " "));
    setSpineParsed({ file: f, slides: [], parsing: true, error: "" });
    try {
      const slides = await parseFile(f);
      setSpineParsed({ file: f, slides, parsing: false, error: "" });
    } catch (err) {
      setSpineParsed({ file: f, slides: [], parsing: false, error: err instanceof Error ? err.message : "Parse failed" });
    }
  }

  // --- Applet handlers ---
  function addApplet() {
    setApplets((prev) => [...prev, { label: `A${prev.length + 1}`, afterSpineSlide: 1, parsed: null }]);
  }

  function removeApplet(index: number) {
    setApplets((prev) => prev.filter((_, i) => i !== index).map((a, i) => ({ ...a, label: `A${i + 1}` })));
  }

  function updateAppletSlidePosition(index: number, after: number) {
    setApplets((prev) => prev.map((a, i) => (i === index ? { ...a, afterSpineSlide: after } : a)));
  }

  async function handleAppletFileSelect(index: number, e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".pptx")) { setError("Only .pptx files are accepted"); return; }
    setError("");
    setApplets((prev) => prev.map((a, i) => i === index ? { ...a, parsed: { file: f, slides: [], parsing: true, error: "" } } : a));
    try {
      const slides = await parseFile(f);
      setApplets((prev) => prev.map((a, i) => i === index ? { ...a, parsed: { file: f, slides, parsing: false, error: "" } } : a));
    } catch (err) {
      setApplets((prev) => prev.map((a, i) => i === index ? { ...a, parsed: { file: f, slides: [], parsing: false, error: err instanceof Error ? err.message : "Parse failed" } } : a));
    }
  }

  const anyAppletParsing = applets.some((a) => a.parsed?.parsing);
  const lastAppletReady = applets.length === 0 || (applets[applets.length - 1].parsed && !applets[applets.length - 1].parsed!.parsing && applets[applets.length - 1].parsed!.slides.length > 0);
  const canAddApplet = spineSlideCount > 0 && !spineParsed?.parsing && lastAppletReady && !anyAppletParsing;

  function canProceedStep1() {
    if (isCorrections) {
      return spineReady && !!selectedModule;
    }
    return spineReady &&
      title.trim().length > 0 &&
      learningObjective.trim().length > 0 &&
      submittedBy.trim().length > 0 &&
      chapterNumber !== "" &&
      chapterName.trim().length > 0 &&
      moduleNumber !== "";
  }

  function buildSequencedSlides() {
    if (!spineParsed) return [];
    return sequenceModuleFlow(spineParsed.slides, applets.filter((a) => a.parsed && a.parsed.slides.length > 0).map((a) => ({ label: a.label, afterSpineSlide: a.afterSpineSlide, slides: a.parsed!.slides })));
  }

  function buildFlowDescription() { return describeModuleFlow(buildSequencedSlides()); }

  async function handleSubmit() {
    if (!spineParsed || submitting || submitted) return;
    setError(""); setSubmitting(true);
    try {
      const transcriptValidationError = validateTranscripts();
      if (transcriptValidationError) {
        throw new Error(transcriptValidationError);
      }
      setSubmitProgress("Uploading spine deck...");
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": spineParsed.file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
        body: spineParsed.file,
      });
      if (!uploadResult.ok) throw new Error(`Upload failed: ${uploadResult.statusText}`);
      const { storageId } = await uploadResult.json();

      const sourceFiles = [
        { filename: spineParsed.file.name, type: "spine", label: "Spine", slideCount: spineParsed.slides.length, storageId: storageId as Id<"_storage"> },
        ...applets.filter((a) => a.parsed && a.parsed.slides.length > 0).map((a) => ({
          filename: a.parsed!.file.name, type: "applet", label: a.label, afterSpineSlide: a.afterSpineSlide, slideCount: a.parsed!.slides.length,
        })),
      ];

      const sequenced = buildSequencedSlides();
      const slides = sequenced.map((s) => ({
        slideNumber: s.slideNumber, sourceFile: s.sourceFile, sourceSlideNumber: s.sourceSlideNumber,
        textContent: s.textContent, speakerNotes: s.speakerNotes, layoutType: s.layoutType,
        hasAnimation: s.hasAnimation, animationSequence: s.animationSequence,
        morphPairWith: s.morphPairWith, metadata: s.metadata,
        thumbnailStorageId: s.thumbnailStorageId as Id<"_storage"> | undefined,
      }));
      const videoTranscripts = transcripts.map((t) => ({
        sourceSlideNumber: t.sourceSlideNumber,
        content: t.content.trim(),
        source: t.mode,
      }));

      if (isCorrections && selectedModule) {
        setSubmitProgress("Submitting corrections...");
        const result = await submitCorrections({
          moduleId: selectedModule.moduleId, sourceFiles, slides, videoTranscripts,
        });
        setSubmitted(true);
        setSubmitProgress("Done! Redirecting...");
        router.push(`/module/${result.moduleId}`);
      } else {
        setSubmitProgress("Creating module...");
        const moduleResult = await submitWithFlow({
          title: title.trim(), learningObjective: learningObjective.trim(), grade,
          chapterNumber: chapterNumber !== "" ? chapterNumber : undefined,
          chapterName: chapterName.trim() || undefined,
          moduleNumber: moduleNumber !== "" ? moduleNumber : undefined,
          topic: topic || undefined,
          curriculumEntryId: selectedCurriculumId ?? undefined,
          submittedBy: submittedBy.trim(), sourceFiles, slides, videoTranscripts,
        });
        setSubmitted(true);
        setSubmitProgress("Done! Redirecting...");
        router.push(`/module/${moduleResult.moduleId}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed"); setSubmitProgress("");
    } finally { setSubmitting(false); }
  }

  const stepLabels = ["Upload Spine", "Applet Storyboards", "Review & Submit"];

  if (me === undefined) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-5">
        <p className="text-sm text-stone-400">Loading...</p>
      </main>
    );
  }
  if (me === null) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-5">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h1 className="text-lg font-semibold text-stone-800">Sign in required</h1>
          <p className="text-sm text-stone-500 mt-2">Please sign in to upload modules.</p>
        </div>
      </main>
    );
  }
  const canUpload =
    me.role === "content_creator" ||
    me.role === "lead_reviewer" ||
    me.role === "manager" ||
    me.role === "admin";
  if (!canUpload) {
    return (
      <main className="max-w-2xl mx-auto px-6 py-5">
        <div className="bg-white rounded-lg border border-stone-200 p-6">
          <h1 className="text-lg font-semibold text-stone-800">Permission denied</h1>
          <p className="text-sm text-stone-500 mt-2">Your role does not have upload access.</p>
        </div>
      </main>
    );
  }

  return (
    <main className="max-w-2xl mx-auto px-6 py-5">
      <h1 className="text-lg font-semibold text-stone-800 tracking-tight mb-0.5">Submit Module for Review</h1>
      <p className="text-[11px] text-stone-400 mb-4 uppercase tracking-[0.08em] font-medium">
        {isCorrections ? "Upload corrected files for an existing module" : "Upload your spine deck to start the review pipeline"}
      </p>

      {/* Mode toggle */}
      <div className="flex gap-1 mb-4">
        <button
          onClick={() => { setMode("new"); setSelectedModule(null); setCorrGrade(""); setCorrChapter(""); setStep(1); setSpineParsed(null); setApplets([]); setTranscripts([]); setError(""); }}
          className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            mode === "new" ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          New Module
        </button>
        <button
          onClick={() => { setMode("corrections"); setSelectedModule(null); setCorrGrade(""); setCorrChapter(""); setStep(1); setSpineParsed(null); setApplets([]); setTranscripts([]); setError(""); }}
          className={`px-3.5 py-1.5 rounded-lg text-[12px] font-medium transition-all ${
            mode === "corrections" ? "bg-stone-800 text-white" : "bg-stone-100 text-stone-500 hover:bg-stone-200"
          }`}
        >
          Corrections
        </button>
      </div>

      {/* Progress bar */}
      <div className="flex items-center gap-0 mb-5">
        <div className="flex-1 h-1 bg-stone-200 rounded-full overflow-hidden flex">
          {stepLabels.map((_, i) => {
            const s = i + 1;
            return (
              <div key={s} className={`flex-1 h-full transition-colors ${s < step ? "bg-stone-800" : s === step ? "bg-stone-400" : "bg-stone-200"}`} />
            );
          })}
        </div>
        <span className="ml-3 text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] whitespace-nowrap">{stepLabels[step - 1]}</span>
      </div>

      {/* ─── Step 1: Spine Deck + Module Details (one fold) ─── */}
      {step === 1 && (
        <div className="bg-white rounded-lg border border-stone-200 shadow-subtle overflow-hidden">
          {/* Corrections: Cascading module selector (Grade → Chapter → Module) */}
          {isCorrections && (
            <div className="p-4 pb-3">
              <div className="flex items-center gap-2 mb-2.5">
                <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-[0.08em]">Select Module</span>
                <span className="text-[10px] font-semibold text-red-400 uppercase tracking-[0.06em]">required</span>
              </div>
              {correctableModules === undefined ? (
                <div className="text-[11px] text-stone-400">Loading modules...</div>
              ) : correctableModules.length === 0 ? (
                <div className="text-[11px] text-stone-400 py-2">No modules available for corrections. Modules must be in &ldquo;Reviewed&rdquo; or &ldquo;Creator Fixing&rdquo; status.</div>
              ) : (() => {
                const mods = correctableModules as CorrectableModule[];
                const uniqueGrades = Array.from(new Set(mods.map((m) => m.grade))).sort((a, b) => a - b);
                const chaptersForGrade = corrGrade !== ""
                  ? Array.from(new Map(mods.filter((m) => m.grade === corrGrade && m.chapterNumber != null).map((m) => [m.chapterNumber, m.chapterName])).entries()).sort((a, b) => (a[0] ?? 0) - (b[0] ?? 0))
                  : [];
                const modulesForChapter = corrGrade !== "" && corrChapter !== ""
                  ? mods.filter((m) => m.grade === corrGrade && m.chapterNumber === corrChapter).sort((a, b) => (a.moduleNumber ?? 0) - (b.moduleNumber ?? 0))
                  : corrGrade !== ""
                    ? mods.filter((m) => m.grade === corrGrade && m.chapterNumber == null)
                    : [];

                return (
                  <div className="space-y-2.5">
                    {/* Row: Grade + Chapter dropdowns */}
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Grade</label>
                        <select
                          value={corrGrade}
                          onChange={(e) => { setCorrGrade(e.target.value === "" ? "" : Number(e.target.value)); setCorrChapter(""); setSelectedModule(null); }}
                          className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                        >
                          <option value="">Select grade...</option>
                          {uniqueGrades.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Chapter</label>
                        <select
                          value={corrChapter}
                          onChange={(e) => { setCorrChapter(e.target.value === "" ? "" : Number(e.target.value)); setSelectedModule(null); }}
                          disabled={corrGrade === "" || chaptersForGrade.length === 0}
                          className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10 disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                          <option value="">Select chapter...</option>
                          {chaptersForGrade.map(([num, name]) => (
                            <option key={num} value={num ?? ""}>Ch{num}{name ? ` — ${name}` : ""}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    {/* Module list (filtered) */}
                    {modulesForChapter.length > 0 && (
                      <div className="space-y-1.5">
                        <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em]">Module</label>
                        {modulesForChapter.map((m) => (
                          <button
                            key={m._id}
                            onClick={() => setSelectedModule(m)}
                            className={`w-full text-left px-3 py-2 rounded-lg border transition-all ${
                              selectedModule?._id === m._id
                                ? "border-stone-400 bg-stone-50 shadow-subtle"
                                : "border-stone-200 hover:border-stone-300 hover:bg-stone-50/50"
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-[13px] font-medium text-stone-700">
                                {m.moduleNumber != null && <span className="text-stone-400 mr-1.5">M{m.moduleNumber}</span>}
                                {m.title}
                              </span>
                              <span className="text-[11px] font-mono text-stone-400">v{m.version}</span>
                            </div>
                            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-stone-400">
                              {m.overallScore != null && <span>{m.overallScore}/100</span>}
                              {m.scoreBand && <span className="text-stone-500">{m.scoreBand}</span>}
                            </div>
                          </button>
                        ))}
                      </div>
                    )}

                    {/* Selected module summary */}
                    {selectedModule && (
                      <div className="bg-stone-50 rounded-lg border border-stone-200/60 px-3 py-2 text-[11px] text-stone-500">
                        Corrections for <span className="font-semibold text-stone-600">{selectedModule.title}</span> — v{selectedModule.version} → v{selectedModule.version + 1}
                      </div>
                    )}
                  </div>
                );
              })()}
            </div>
          )}

          {/* Zone 1: Module Details — always visible for new module (fill context first, then upload) */}
          {!isCorrections && (
            <>
              <div className="border-t border-stone-100 mx-4" />
              <div className="p-4 pt-3 space-y-3">
                {/* Auto-fill badges */}
                {(autoDetected || curriculumFilled) && (
                  <div className="flex items-center gap-1.5">
                    {autoDetected && <span className="text-[10px] font-medium text-stone-400 bg-stone-100 px-2 py-0.5 rounded-full uppercase tracking-[0.06em]">Auto-filled from filename</span>}
                    {curriculumFilled && <span className="text-[10px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full uppercase tracking-[0.06em]">From curriculum</span>}
                  </div>
                )}

                {/* Row 1: Grade · Chapter · Module (cascading dropdowns with manual fallback) */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div>
                    <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Grade *</label>
                    <select value={grade} onChange={(e) => { setGrade(Number(e.target.value)); setChapterNumber(""); setModuleNumber(""); setSelectedCurriculumId(null); setCurriculumFilled(false); setCurriculumMode("auto"); }}
                      className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                      {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Chapter # *</label>
                    {curriculumMode === "auto" && curriculumChapters && curriculumChapters.length > 0 ? (
                      <select
                        value={chapterNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__manual__") { setCurriculumMode("manual"); setChapterNumber(""); setModuleNumber(""); setSelectedCurriculumId(null); setCurriculumFilled(false); return; }
                          setChapterNumber(val === "" ? "" : parseInt(val));
                          setModuleNumber(""); setSelectedCurriculumId(null); setCurriculumFilled(false);
                          const ch = curriculumChapters.find((c) => c.chapterNumber === parseInt(val));
                          if (ch) setChapterName(ch.chapterName);
                        }}
                        className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      >
                        <option value="">Select...</option>
                        {curriculumChapters.map((ch) => (
                          <option key={ch.chapterNumber} value={ch.chapterNumber}>Ch{ch.chapterNumber} — {ch.chapterName}</option>
                        ))}
                        <option value="__manual__">Type manually</option>
                      </select>
                    ) : (
                      <div>
                        <input type="number" min={1} value={chapterNumber}
                          onChange={(e) => { setChapterNumber(e.target.value === "" ? "" : parseInt(e.target.value)); setModuleNumber(""); setSelectedCurriculumId(null); setCurriculumFilled(false); }}
                          placeholder="2"
                          className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow" />
                        {curriculumChapters && curriculumChapters.length > 0 && (
                          <button type="button" onClick={() => { setCurriculumMode("auto"); setChapterNumber(""); setModuleNumber(""); setSelectedCurriculumId(null); setCurriculumFilled(false); }}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 mt-0.5">Select from curriculum</button>
                        )}
                      </div>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Module # *</label>
                    {curriculumMode === "auto" && curriculumModules && curriculumModules.length > 0 ? (
                      <select
                        value={moduleNumber}
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val === "__manual__") { setCurriculumMode("manual"); setModuleNumber(""); setSelectedCurriculumId(null); setCurriculumFilled(false); return; }
                          setModuleNumber(val === "" ? "" : parseInt(val));
                        }}
                        className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10"
                      >
                        <option value="">Select...</option>
                        {curriculumModules.map((m) => (
                          <option key={m.moduleNumber} value={m.moduleNumber}>M{m.moduleNumber}{m.conceptName ? ` — ${m.conceptName}` : ""}</option>
                        ))}
                        <option value="__manual__">Type manually</option>
                      </select>
                    ) : (
                      <div>
                        <input type="number" min={1} value={moduleNumber}
                          onChange={(e) => setModuleNumber(e.target.value === "" ? "" : parseInt(e.target.value))}
                          placeholder="1"
                          className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow" />
                        {curriculumModules && curriculumModules.length > 0 && (
                          <button type="button" onClick={() => { setCurriculumMode("auto"); setModuleNumber(""); setSelectedCurriculumId(null); setCurriculumFilled(false); }}
                            className="text-[10px] text-emerald-600 hover:text-emerald-700 mt-0.5">Select from curriculum</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>

                {/* Row 2: Chapter Name · Your Name */}
                <div className="grid grid-cols-3 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Chapter Name *</label>
                    <input type="text" value={chapterName} onChange={(e) => setChapterName(e.target.value)}
                      placeholder="e.g. Fractions and Decimals"
                      className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Your Name *</label>
                    <input type="text" value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)}
                      placeholder="e.g. Priya"
                      className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow" />
                  </div>
                </div>

                {/* Row 3: Module Name */}
                <div>
                  <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Module Name *</label>
                  <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g. Introduction to Fractions"
                    className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow" />
                </div>

                {/* Row 4: Learning Objective */}
                <div>
                  <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Learning Objective *</label>
                  <textarea value={learningObjective} onChange={(e) => setLearningObjective(e.target.value)}
                    placeholder="What should students be able to do after completing this module?"
                    rows={2}
                    className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 resize-none transition-shadow" />
                </div>

                {/* Row 5: Topic (optional) */}
                <div className="max-w-[50%]">
                  <label className="block text-[10px] font-medium text-stone-400 uppercase tracking-[0.08em] mb-0.5">Topic</label>
                  <select value={topic} onChange={(e) => setTopic(e.target.value)}
                    className="w-full px-2.5 py-2 border border-stone-200 rounded-lg text-[13px] h-9 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                    <option value="">Select...</option>
                    {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Zone 2: Spine Deck Upload */}
          <div className={`p-4 pb-3 ${!isCorrections ? "border-t border-stone-100 mx-4" : ""}`} style={isCorrections && !selectedModule ? { display: "none" } : undefined}>
            <div className="flex items-center gap-2 mb-2.5">
              <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-[0.08em]">Spine Deck</span>
              <span className="text-[10px] font-semibold text-red-400 uppercase tracking-[0.06em]">required</span>
            </div>
            <div
              className={`border-2 border-dashed rounded-lg px-4 text-center cursor-pointer transition-all ${
                spineParsed && !spineParsed.error
                  ? "border-stone-300 bg-stone-50/80 py-3"
                  : spineParsed?.error
                  ? "border-red-300 bg-red-50/50 py-3"
                  : "border-stone-200 hover:border-stone-400 bg-stone-50/30 py-5"
              }`}
              onClick={() => spineFileRef.current?.click()}
            >
              <input ref={spineFileRef} type="file" accept=".pptx" onChange={handleSpineSelect} className="hidden" />
              {spineParsed ? (
                <div>
                  <div className={`text-[13px] font-medium ${spineParsed.error ? "text-red-700" : "text-stone-700"}`}>{spineParsed.file.name}</div>
                  {spineParsed.parsing && (
                    <div className="flex items-center justify-center gap-2 mt-1 text-[11px] text-stone-400">
                      <svg className="animate-spin h-3 w-3 text-stone-400" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Parsing slides...
                    </div>
                  )}
                  {spineReady && (
                    <div className="text-[11px] text-stone-500 mt-1">{"\u2713"} {spineParsed.slides.length} slides found &middot; Click to change</div>
                  )}
                  {spineParsed.error && <div className="text-[11px] text-red-600 mt-1">{spineParsed.error}</div>}
                </div>
              ) : (
                <div>
                  <svg className="w-6 h-6 text-stone-300 mx-auto mb-1.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                  </svg>
                  <div className="text-[13px] text-stone-500">Click to upload spine deck</div>
                  <div className="text-[11px] text-stone-300 mt-0.5">.pptx format only &middot; applet storyboards go in the next step</div>
                </div>
              )}
            </div>
          </div>

          {/* Zone 3: Video transcripts tied to spine slides */}
          {spineReady && (
            <div className="p-4 pt-3 border-t border-stone-100 mx-4">
              <div className="flex items-center justify-between mb-2.5">
                <div className="flex items-center gap-2">
                  <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-[0.08em]">Video Transcripts</span>
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.06em]">optional</span>
                </div>
                <button
                  type="button"
                  onClick={addTranscriptRow}
                  className="text-[11px] font-medium text-stone-500 hover:text-stone-700 transition-colors"
                >
                  + Add transcript
                </button>
              </div>
              {transcripts.length === 0 ? (
                <p className="text-[11px] text-stone-400">
                  Add transcript text for any spine slide with embedded video. You can paste text or upload .txt/.md/.docx/.pdf/.rtf/.csv.
                </p>
              ) : (
                <div className="space-y-2">
                  {transcripts.map((t) => (
                    <TranscriptRow
                      key={t.id}
                      entry={t}
                      spineSlideCount={spineSlideCount}
                      onChange={updateTranscriptRow}
                      onRemove={removeTranscriptRow}
                      onFileSelect={handleTranscriptFileSelect}
                    />
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Error */}
          {error && (
            <div className="mx-4 mb-3">
              <div className="bg-red-50 border border-red-200 rounded-lg px-3 py-2 text-[11px] text-red-700">{error}</div>
            </div>
          )}

          {/* Footer */}
          <div className="flex justify-end px-4 py-3 border-t border-stone-100">
            <button type="button" disabled={!canProceedStep1()} onClick={() => { setError(""); setStep(2); }}
              className="px-5 py-2 bg-stone-900 text-white rounded-lg text-[13px] font-medium hover:bg-stone-800 disabled:opacity-30 disabled:cursor-not-allowed transition-all">
              Next &rarr;
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 2: Applet Storyboards ─── */}
      {step === 2 && (
        <div className="space-y-3">
          {/* Spine summary */}
          <div className="bg-stone-50 rounded-lg border border-stone-200/60 px-4 py-2 flex items-center justify-between">
            <div className="flex items-center gap-2 text-[11px]">
              <span className="font-semibold text-stone-500">Spine:</span>
              <span className="text-stone-600">{spineParsed?.file.name}</span>
              <span className="text-stone-400">&middot; {spineSlideCount} slides</span>
            </div>
          </div>

          {/* Applet upload area */}
          <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
            <div className="flex items-center justify-between mb-2.5">
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-semibold text-stone-600 uppercase tracking-[0.08em]">Applet Storyboards</span>
                <span className="text-[10px] font-medium text-stone-400 uppercase tracking-[0.06em]">optional</span>
              </div>
              <button type="button" onClick={addApplet} disabled={!canAddApplet}
                className="text-[11px] font-medium text-stone-500 hover:text-stone-700 disabled:text-stone-300 disabled:cursor-not-allowed transition-colors">
                + Add Storyboard
              </button>
            </div>
            {applets.length === 0 && (
              <p className="text-[11px] text-stone-400 py-2">No applet storyboards added. These are optional — they insert interactive slides into the spine flow. You can skip this step.</p>
            )}
            <div className="space-y-2">
              {applets.map((applet, index) => (
                <AppletRow key={applet.label + index} applet={applet} index={index} spineSlideCount={spineSlideCount}
                  onFileSelect={handleAppletFileSelect} onPositionChange={updateAppletSlidePosition} onRemove={removeApplet} />
              ))}
            </div>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-[11px] text-red-700">{error}</div>}

          <div className="flex justify-between pt-1">
            <button type="button" onClick={() => { setError(""); setStep(1); }}
              className="px-5 py-2 border border-stone-200 text-stone-600 rounded-lg text-[13px] font-medium hover:bg-stone-50 transition-all">
              &larr; Back
            </button>
            <button type="button" disabled={anyAppletParsing} onClick={() => { setError(""); setStep(3); }}
              className="px-5 py-2 bg-stone-900 text-white rounded-lg text-[13px] font-medium hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
              {anyAppletParsing ? "Parsing..." : applets.length === 0 ? "Skip \u2192" : "Next \u2192"}
            </button>
          </div>
        </div>
      )}

      {/* ─── Step 3: Review & Submit ─── */}
      {step === 3 && (
        <div className="space-y-3">
          <div className="grid grid-cols-5 gap-3">
            <div className="col-span-2 bg-white rounded-lg border border-stone-200 shadow-subtle p-4">
              <h2 className="text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-2.5">
                {isCorrections ? "Corrections" : "Module"}
              </h2>
              <div className="space-y-2">
                {isCorrections && selectedModule ? (
                  <>
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">Module</div>
                      <div className="text-[13px] font-medium text-stone-800">{selectedModule.title}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">Version</div>
                      <div className="text-[13px] text-stone-600">v{selectedModule.version} → v{selectedModule.version + 1}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">Hierarchy</div>
                      <div className="text-[13px] text-stone-600">
                        G{selectedModule.grade}
                        {selectedModule.chapterNumber != null && ` · Ch${selectedModule.chapterNumber}`}
                        {selectedModule.chapterName && ` — ${selectedModule.chapterName}`}
                        {selectedModule.moduleNumber != null && ` · M${selectedModule.moduleNumber}`}
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">Name</div>
                      <div className="text-[13px] font-medium text-stone-800">{title}</div>
                    </div>
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">Hierarchy</div>
                      <div className="text-[13px] text-stone-600">G{grade} &middot; Ch{chapterNumber}{chapterName ? ` — ${chapterName}` : ""} &middot; M{moduleNumber}</div>
                    </div>
                    {topic && <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">Topic</div>
                      <div className="text-[13px] text-stone-600">{topic}</div>
                    </div>}
                    <div>
                      <div className="text-[10px] text-stone-400 uppercase tracking-wide">Submitted by</div>
                      <div className="text-[13px] text-stone-600">{submittedBy}</div>
                    </div>
                  </>
                )}
              </div>
            </div>

            <div className="col-span-3 bg-white rounded-lg border border-stone-200 shadow-subtle p-4">
              <h2 className="text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-2.5">Source Files</h2>
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="text-[10px] text-stone-400 border-b border-stone-100 uppercase tracking-wide">
                    <th className="text-left pb-1.5 font-medium">File</th>
                    <th className="text-left pb-1.5 font-medium">Type</th>
                    <th className="text-right pb-1.5 font-medium">Slides</th>
                    <th className="text-right pb-1.5 font-medium">After</th>
                  </tr>
                </thead>
                <tbody>
                  {spineParsed && (
                    <tr className="border-b border-stone-50">
                      <td className="py-1.5 text-stone-600 text-[11px]">{spineParsed.file.name}</td>
                      <td className="py-1.5 text-stone-500 text-[11px]">Spine</td>
                      <td className="py-1.5 text-right text-stone-600 text-[11px] font-mono">{spineParsed.slides.length}</td>
                      <td className="py-1.5 text-right text-stone-300 text-[11px]">&mdash;</td>
                    </tr>
                  )}
                  {applets.filter((a) => a.parsed && a.parsed.slides.length > 0).map((a) => (
                    <tr key={a.label} className="border-b border-stone-50">
                      <td className="py-1.5 text-stone-600 text-[11px]">{a.parsed!.file.name}</td>
                      <td className="py-1.5 text-stone-500 text-[11px]">Storyboard ({a.label})</td>
                      <td className="py-1.5 text-right text-stone-600 text-[11px] font-mono">{a.parsed!.slides.length}</td>
                      <td className="py-1.5 text-right text-stone-600 text-[11px]">Slide {a.afterSpineSlide}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-4">
            <div className="flex items-center justify-between mb-2">
              <h2 className="text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em]">Module Flow</h2>
              <span className="text-[11px] text-stone-400 font-mono">{buildSequencedSlides().length} slides total</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5">
              {buildFlowDescription().map((seg, i) => (
                <span key={i} className="inline-flex items-center gap-1.5 text-[11px]">
                  {i > 0 && <svg className="w-3 h-3 text-stone-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" /></svg>}
                  <span className="bg-stone-100 text-stone-600 px-2.5 py-1 rounded font-medium">{seg}</span>
                </span>
              ))}
            </div>
          </div>

          <div className="bg-stone-50 rounded-lg border border-stone-200/60 px-4 py-2.5">
            <p className="text-[11px] text-stone-500"><span className="font-semibold text-stone-600">LO:</span> {learningObjective}</p>
          </div>

          {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-[11px] text-red-700">{error}</div>}

          <div className="flex justify-between pt-1">
            <button type="button" disabled={submitting || submitted} onClick={() => { setError(""); setStep(2); }}
              className="px-5 py-2 border border-stone-200 text-stone-600 rounded-lg text-[13px] font-medium hover:bg-stone-50 disabled:opacity-40 transition-all">
              &larr; Back
            </button>
            <button type="button" disabled={submitting || submitted} onClick={handleSubmit}
              className="px-6 py-2 bg-stone-900 text-white rounded-lg text-[13px] font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
              {submitting ? submitProgress : isCorrections ? "Submit Corrections" : "Submit for Review"}
            </button>
          </div>
        </div>
      )}
    </main>
  );
}

function AppletRow({ applet, index, spineSlideCount, onFileSelect, onPositionChange, onRemove }: {
  applet: AppletEntry; index: number; spineSlideCount: number;
  onFileSelect: (index: number, e: React.ChangeEvent<HTMLInputElement>) => void;
  onPositionChange: (index: number, after: number) => void;
  onRemove: (index: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const slideOptions: number[] = [];
  for (let i = 1; i <= spineSlideCount; i++) slideOptions.push(i);

  return (
    <div className="flex items-center gap-3 px-3 py-2.5 bg-stone-50 rounded-lg border border-stone-200">
      <span className="w-7 h-7 rounded bg-stone-200 flex items-center justify-center text-[11px] font-bold text-stone-500 shrink-0">{applet.label}</span>
      <div className="flex-1 min-w-0">
        <input ref={fileRef} type="file" accept=".pptx" onChange={(e) => onFileSelect(index, e)} className="hidden" />
        {applet.parsed ? (
          <div>
            <button type="button" onClick={() => fileRef.current?.click()}
              className={`text-[11px] font-medium truncate max-w-full ${applet.parsed.error ? "text-red-600" : "text-stone-700"}`}>
              {applet.parsed.file.name}
            </button>
            {applet.parsed.parsing && <div className="text-[11px] text-stone-400 mt-0.5">Parsing...</div>}
            {!applet.parsed.parsing && !applet.parsed.error && <div className="text-[11px] text-stone-500 mt-0.5">{"\u2713"} {applet.parsed.slides.length} slides</div>}
            {applet.parsed.error && <div className="text-[11px] text-red-500 mt-0.5">{applet.parsed.error}</div>}
          </div>
        ) : (
          <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] text-stone-400 hover:text-stone-600">Select .pptx storyboard</button>
        )}
      </div>
      <div className="shrink-0">
        <label className="block text-[11px] text-stone-400 mb-0.5">After slide</label>
        <select value={applet.afterSpineSlide} onChange={(e) => onPositionChange(index, Number(e.target.value))}
          className="px-2 py-1 border border-stone-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-stone-200">
          {slideOptions.map((n) => <option key={n} value={n}>{n}</option>)}
        </select>
      </div>
      <button type="button" onClick={() => onRemove(index)} className="shrink-0 text-stone-300 hover:text-red-400 transition-colors" title="Remove">
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>
    </div>
  );
}

function TranscriptRow({
  entry,
  spineSlideCount,
  onChange,
  onRemove,
  onFileSelect,
}: {
  entry: TranscriptEntry;
  spineSlideCount: number;
  onChange: (id: string, patch: Partial<TranscriptEntry>) => void;
  onRemove: (id: string) => void;
  onFileSelect: (id: string, file?: File) => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [editorOpen, setEditorOpen] = useState(false);
  const slideOptions: number[] = [];
  for (let i = 1; i <= spineSlideCount; i++) slideOptions.push(i);

  useEffect(() => {
    if (!editorOpen || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [editorOpen]);

  return (
    <div className="rounded-lg border border-stone-200 bg-stone-50 p-3 space-y-2">
      <div className="flex items-center gap-2">
        <label className="text-[11px] text-stone-500">Spine slide</label>
        <select
          value={entry.sourceSlideNumber}
          onChange={(e) => onChange(entry.id, { sourceSlideNumber: Number(e.target.value) })}
          className="px-2 py-1 border border-stone-200 rounded-lg text-[11px] focus:outline-none focus:ring-1 focus:ring-stone-200"
        >
          {slideOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
        <div className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={() => onRemove(entry.id)}
            className="text-[11px] text-red-500 hover:text-red-600 px-1"
            title="Remove transcript row"
          >
            Remove
          </button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          ref={fileRef}
          type="file"
          accept=".txt,.md,.doc,.docx,.rtf,.pdf,.csv,text/*,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/rtf,application/pdf"
          className="hidden"
          onChange={(e) => void onFileSelect(entry.id, e.target.files?.[0])}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="text-[11px] px-2.5 py-1.5 rounded border border-stone-200 bg-white text-stone-600 hover:bg-stone-50"
        >
          Upload transcript file
        </button>
        <span className="text-[11px] text-stone-500">
          {entry.fileName ? `${entry.fileName} (${entry.content.length} chars)` : "No file selected"}
        </span>
      </div>

      <div className="rounded-lg border border-stone-200 bg-white p-2.5">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-medium text-stone-500">Transcript</span>
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="text-[11px] px-2 py-1 rounded border border-stone-200 text-stone-600 hover:bg-stone-50"
          >
            {entry.content.trim() ? "Edit" : "Add"}
          </button>
        </div>
        <p className="text-[11px] text-stone-500 whitespace-pre-wrap max-h-20 overflow-y-auto">
          {entry.content.trim() || "No transcript text yet."}
        </p>
      </div>
      <p className="text-[10px] text-stone-400">
        Source: {entry.mode === "file" ? "file upload" : "textbox/paste"}
      </p>
      {entry.parseError && <p className="text-[11px] text-red-600">{entry.parseError}</p>}

      {editorOpen && typeof document !== "undefined" &&
        createPortal(
          <div className="fixed inset-0 z-[1000] flex items-center justify-center bg-black/40 p-4">
            <div className="w-full max-w-2xl rounded-xl shadow-xl">
              <div className="bg-white rounded-xl overflow-hidden ring-1 ring-stone-200 [clip-path:inset(0_round_0.75rem)]">
                <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100">
                  <div>
                    <h3 className="text-sm font-semibold text-stone-800">Edit Transcript</h3>
                    <p className="text-[11px] text-stone-500">Spine slide {entry.sourceSlideNumber}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="text-stone-400 hover:text-stone-700"
                    title="Close"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
                      <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                    </svg>
                  </button>
                </div>
                <div className="p-4">
                  <textarea
                    value={entry.content}
                    onChange={(e) =>
                      onChange(entry.id, {
                        content: e.target.value,
                        parseError: undefined,
                        mode: "textbox",
                      })
                    }
                    rows={16}
                    placeholder="Paste transcript text here..."
                    className="w-full text-[13px] rounded-lg border border-stone-200 px-3 py-2 resize-y focus:outline-none focus:ring-1 focus:ring-stone-300"
                  />
                </div>
                <div className="px-4 py-3 border-t border-stone-100 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setEditorOpen(false)}
                    className="px-3 py-1.5 rounded-lg bg-stone-900 text-white text-[12px] hover:bg-stone-800"
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
