"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useAction } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import {
  sequenceModuleFlow,
  describeModuleFlow,
  SourceSlide,
} from "@/lib/moduleFlow";

const GRADES = ["3", "4", "5", "6"];
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

export default function UploadPage() {
  const router = useRouter();
  const spineFileRef = useRef<HTMLInputElement>(null);

  const submitWithFlow = useMutation(api.modules.submitModuleWithFlow);
  const generateUploadUrl = useMutation(api.modules.generateUploadUrl);
  const parsePptx = useAction(api.parser.parsePptx);

  const [step, setStep] = useState(1);
  const [title, setTitle] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [grade, setGrade] = useState("4");
  const [phase, setPhase] = useState("");
  const [topic, setTopic] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [spineParsed, setSpineParsed] = useState<ParsedFile | null>(null);
  const [applets, setApplets] = useState<AppletEntry[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState("");
  const [error, setError] = useState("");

  const spineSlideCount = spineParsed?.slides.length ?? 0;

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
        sourceSlideNumber:
          (s.slide_number as number) ?? (s.sourceSlideNumber as number) ?? idx + 1,
        textContent: (s.text_content as string) ?? (s.textContent as string),
        speakerNotes: (s.speaker_notes as string) ?? (s.speakerNotes as string),
        layoutType: (s.layout_type as string) ?? (s.layoutType as string),
        hasAnimation: (s.has_animation as boolean) ?? (s.hasAnimation as boolean),
        animationSequence: s.animation_sequence ?? s.animationSequence,
        morphPairWith: (s.morphPairWith as number) ?? (s.morph_pair_with as number) ?? undefined,
        metadata: s.metadata,
      })
    );
  }

  async function handleSpineSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".pptx")) { setError("Only .pptx files are accepted"); return; }
    setError("");
    if (!title) setTitle(f.name.replace(/\.pptx$/i, "").replace(/[-_]/g, " "));
    setSpineParsed({ file: f, slides: [], parsing: true, error: "" });
    try {
      const slides = await parseFile(f);
      setSpineParsed({ file: f, slides, parsing: false, error: "" });
    } catch (err) {
      setSpineParsed({ file: f, slides: [], parsing: false, error: err instanceof Error ? err.message : "Parse failed" });
    }
  }

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

  function canProceedStep1() { return title.trim().length > 0 && learningObjective.trim().length > 0 && submittedBy.trim().length > 0; }
  const anyAppletParsing = applets.some((a) => a.parsed?.parsing);
  function canProceedStep2() {
    return !!spineParsed && !spineParsed.parsing && spineParsed.slides.length > 0 && !spineParsed.error && !anyAppletParsing;
  }

  function buildSequencedSlides() {
    if (!spineParsed) return [];
    return sequenceModuleFlow(spineParsed.slides, applets.filter((a) => a.parsed && a.parsed.slides.length > 0).map((a) => ({ label: a.label, afterSpineSlide: a.afterSpineSlide, slides: a.parsed!.slides })));
  }

  function buildFlowDescription() { return describeModuleFlow(buildSequencedSlides()); }

  async function handleSubmit() {
    if (!spineParsed) return;
    setError(""); setSubmitting(true);
    try {
      setSubmitProgress("Uploading spine PPTX...");
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

      setSubmitProgress("Creating module...");
      const moduleResult = await submitWithFlow({
        title: title.trim(), learningObjective: learningObjective.trim(), grade,
        phase: phase.trim() || undefined, topic: topic || undefined,
        submittedBy: submittedBy.trim(), sourceFiles, slides,
      });
      setSubmitProgress("Done! Redirecting...");
      router.push(`/module/${moduleResult.moduleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed"); setSubmitProgress("");
    } finally { setSubmitting(false); }
  }

  const stepLabels = ["Module Details", "Upload Files", "Review & Submit"];

  return (
    <main className="max-w-3xl mx-auto px-6 py-6">
      <h1 className="text-lg font-semibold text-stone-800 tracking-tight mb-1">Submit Module for Review</h1>
      <p className="text-[11px] text-stone-400 mb-6 uppercase tracking-[0.08em] font-medium">Upload storyboard files to start the review pipeline</p>

        {/* Step indicator — minimal progress bar */}
        <div className="flex items-center gap-0 mb-6">
          <div className="flex-1 h-1 bg-stone-200 rounded-full overflow-hidden flex">
            {stepLabels.map((_, i) => {
              const s = i + 1;
              const isDone = s < step;
              const isActive = s === step;
              return (
                <div
                  key={s}
                  className={`flex-1 h-full transition-colors ${
                    isDone ? "bg-stone-800" : isActive ? "bg-stone-400" : "bg-stone-200"
                  }`}
                />
              );
            })}
          </div>
          <span className="ml-3 text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em]">
            {stepLabels[step - 1]}
          </span>
        </div>

        {/* Step 1: Module Details */}
        {step === 1 && (
          <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5 space-y-4">
            <div>
              <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-1">Module Title *</label>
              <input
                type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. G1C4M08 Introduction to Fractions"
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-[13px] h-10 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow"
              />
            </div>

            <div>
              <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-1">Learning Objective *</label>
              <textarea
                value={learningObjective} onChange={(e) => setLearningObjective(e.target.value)}
                placeholder="What should students be able to do after completing this module?"
                rows={2}
                className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-[13px] focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 resize-none transition-shadow"
              />
            </div>

            <div className="grid grid-cols-4 gap-3">
              <div>
                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-1">Grade *</label>
                <select value={grade} onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-[13px] h-10 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                  {GRADES.map((g) => <option key={g} value={g}>Grade {g}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-1">Topic</label>
                <select value={topic} onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-[13px] h-10 focus:outline-none focus:ring-2 focus:ring-stone-900/10">
                  <option value="">Select...</option>
                  {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-1">Phase</label>
                <input type="text" value={phase} onChange={(e) => setPhase(e.target.value)}
                  placeholder="e.g. Phase 1"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-[13px] h-10 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow"
                />
              </div>
              <div>
                <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-1">Your Name *</label>
                <input type="text" value={submittedBy} onChange={(e) => setSubmittedBy(e.target.value)}
                  placeholder="e.g. Priya"
                  className="w-full px-3 py-2.5 border border-stone-200 rounded-lg text-[13px] h-10 focus:outline-none focus:ring-2 focus:ring-stone-900/10 focus:border-stone-300 transition-shadow"
                />
              </div>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-[11px] text-red-700">{error}</div>}

            <div className="flex justify-end pt-1">
              <button type="button" disabled={!canProceedStep1()} onClick={() => { setError(""); setStep(2); }}
                className="px-5 py-2.5 bg-stone-900 text-white rounded-lg text-[13px] font-medium hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* Step 2: Upload Files */}
        {step === 2 && (
          <div className="space-y-3">
            <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
              <label className="block text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-2.5">
                Spine PPTX <span className="text-red-400">required</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg px-5 py-4 text-center cursor-pointer transition-all ${
                  spineParsed && !spineParsed.error ? "border-stone-400 bg-stone-50"
                    : spineParsed?.error ? "border-red-300 bg-red-50/50"
                    : "border-stone-200 hover:border-stone-400 bg-stone-50/50"
                }`}
                onClick={() => spineFileRef.current?.click()}
              >
                <input ref={spineFileRef} type="file" accept=".pptx" onChange={handleSpineSelect} className="hidden" />
                {spineParsed ? (
                  <div>
                    <div className={`text-[13px] font-medium ${spineParsed.error ? "text-red-700" : "text-stone-700"}`}>{spineParsed.file.name}</div>
                    {spineParsed.parsing && (
                      <div className="flex items-center justify-center gap-2 mt-1.5 text-[11px] text-stone-500">
                        <svg className="animate-spin h-3.5 w-3.5 text-stone-400" viewBox="0 0 24 24" fill="none">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                        </svg>
                        Parsing...
                      </div>
                    )}
                    {!spineParsed.parsing && !spineParsed.error && (
                      <div className="text-[11px] text-stone-500 mt-1.5">{"\u2713"} {spineParsed.slides.length} slides found &middot; Click to change</div>
                    )}
                    {spineParsed.error && <div className="text-[11px] text-red-600 mt-1.5">{spineParsed.error}</div>}
                  </div>
                ) : (
                  <div>
                    <div className="text-[13px] text-stone-500">Click to select the spine .pptx file</div>
                    <div className="text-[11px] text-stone-300 mt-0.5">Main storyboard file</div>
                  </div>
                )}
              </div>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
              <div className="flex items-center justify-between mb-2.5">
                <label className="text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em]">Applet Storyboards</label>
                <button type="button" onClick={addApplet} disabled={spineSlideCount === 0}
                  className="text-[11px] font-medium text-stone-500 hover:text-stone-700 disabled:text-stone-300 disabled:cursor-not-allowed transition-colors">
                  + Add Applet
                </button>
              </div>
              {applets.length === 0 && (
                <p className="text-[11px] text-stone-400">No applets added. Applets are optional — they insert interactive slides into the spine flow.</p>
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
                className="px-5 py-2.5 border border-stone-200 text-stone-600 rounded-lg text-[13px] font-medium hover:bg-stone-50 transition-all">
                &larr; Back
              </button>
              <button type="button" disabled={!canProceedStep2()} onClick={() => { setError(""); setStep(3); }}
                className="px-5 py-2.5 bg-stone-900 text-white rounded-lg text-[13px] font-medium hover:bg-stone-800 disabled:opacity-40 disabled:cursor-not-allowed transition-all">
                {anyAppletParsing ? "Parsing applets..." : "Next \u2192"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Review & Submit */}
        {step === 3 && (
          <div className="space-y-3">
            <div className="grid grid-cols-5 gap-3">
              <div className="col-span-2 bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
                <h2 className="text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-3">Module</h2>
                <div className="space-y-2">
                  <div>
                    <div className="text-[11px] text-stone-400">Title</div>
                    <div className="text-[13px] font-medium text-stone-800">{title}</div>
                  </div>
                  <div className="flex gap-4">
                    <div>
                      <div className="text-[11px] text-stone-400">Grade</div>
                      <div className="text-[13px] text-stone-600">Grade {grade}</div>
                    </div>
                    {topic && <div>
                      <div className="text-[11px] text-stone-400">Topic</div>
                      <div className="text-[13px] text-stone-600">{topic}</div>
                    </div>}
                    {phase && <div>
                      <div className="text-[11px] text-stone-400">Phase</div>
                      <div className="text-[13px] text-stone-600">{phase}</div>
                    </div>}
                  </div>
                  <div>
                    <div className="text-[11px] text-stone-400">Submitted by</div>
                    <div className="text-[13px] text-stone-600">{submittedBy}</div>
                  </div>
                </div>
              </div>

              <div className="col-span-3 bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
                <h2 className="text-[11px] font-medium text-stone-500 uppercase tracking-[0.08em] mb-3">Source Files</h2>
                <table className="w-full text-[13px]">
                  <thead>
                    <tr className="text-[11px] text-stone-400 border-b border-stone-100">
                      <th className="text-left pb-2 font-medium">File</th>
                      <th className="text-left pb-2 font-medium">Type</th>
                      <th className="text-right pb-2 font-medium">Slides</th>
                      <th className="text-right pb-2 font-medium">After</th>
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
                        <td className="py-1.5 text-stone-500 text-[11px]">Applet ({a.label})</td>
                        <td className="py-1.5 text-right text-stone-600 text-[11px] font-mono">{a.parsed!.slides.length}</td>
                        <td className="py-1.5 text-right text-stone-600 text-[11px]">Slide {a.afterSpineSlide}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="bg-white rounded-lg border border-stone-200 shadow-subtle p-5">
              <div className="flex items-center justify-between mb-2.5">
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

            <div className="bg-stone-50 rounded-lg border border-stone-200/60 px-4 py-3">
              <p className="text-[11px] text-stone-500"><span className="font-semibold text-stone-600">LO:</span> {learningObjective}</p>
            </div>

            {error && <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-2.5 text-[11px] text-red-700">{error}</div>}

            <div className="flex justify-between pt-1">
              <button type="button" disabled={submitting} onClick={() => { setError(""); setStep(2); }}
                className="px-5 py-2.5 border border-stone-200 text-stone-600 rounded-lg text-[13px] font-medium hover:bg-stone-50 disabled:opacity-40 transition-all">
                &larr; Back
              </button>
              <button type="button" disabled={submitting} onClick={handleSubmit}
                className="px-6 py-2.5 bg-stone-900 text-white rounded-lg text-[13px] font-medium hover:bg-stone-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all">
                {submitting ? submitProgress : "Submit for Review"}
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
          <button type="button" onClick={() => fileRef.current?.click()} className="text-[11px] text-stone-400 hover:text-stone-600">Select .pptx file</button>
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
