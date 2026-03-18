"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import Link from "next/link";
import {
  sequenceModuleFlow,
  describeModuleFlow,
  SourceSlide,
} from "@/lib/moduleFlow";

const PARSER_URL =
  process.env.NEXT_PUBLIC_PARSER_URL || "http://localhost:8100";
const PARSER_API_KEY = process.env.NEXT_PUBLIC_PARSER_API_KEY || "";

const GRADES = ["3", "4", "5", "6"];
const TOPICS = [
  "Fractions",
  "Decimals",
  "Geometry",
  "Measurement",
  "Data Handling",
  "Whole Numbers",
  "Algebra",
  "Other",
];

// ── Types ──────────────────────────────────────────────────────────────

type ParsedFile = {
  file: File;
  slides: SourceSlide[];
  parsing: boolean;
  error: string;
};

type AppletEntry = {
  label: string; // "A1", "A2", etc
  afterSpineSlide: number;
  parsed: ParsedFile | null;
};

// ── Step indicator ─────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  const steps = ["Module Details", "Upload Files", "Review & Submit"];
  return (
    <div className="flex items-center justify-center gap-0 mb-8">
      {steps.map((label, i) => {
        const step = i + 1;
        const isActive = step === current;
        const isDone = step < current;
        return (
          <div key={step} className="flex items-center">
            {i > 0 && (
              <div
                className={`w-12 h-0.5 ${
                  isDone ? "bg-emerald-500" : "bg-gray-200"
                }`}
              />
            )}
            <div className="flex flex-col items-center">
              <div
                className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isActive
                    ? "bg-gray-900 text-white"
                    : isDone
                      ? "bg-emerald-500 text-white"
                      : "bg-gray-200 text-gray-500"
                }`}
              >
                {isDone ? "\u2713" : step}
              </div>
              <span
                className={`text-[10px] mt-1 ${
                  isActive
                    ? "text-gray-900 font-semibold"
                    : isDone
                      ? "text-emerald-600"
                      : "text-gray-400"
                }`}
              >
                {label}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Main page ──────────────────────────────────────────────────────────

export default function UploadPage() {
  const router = useRouter();
  const spineFileRef = useRef<HTMLInputElement>(null);

  const submitWithFlow = useMutation(api.modules.submitModuleWithFlow);
  const generateUploadUrl = useMutation(api.modules.generateUploadUrl);

  // Step navigation
  const [step, setStep] = useState(1);

  // Step 1 — Module details
  const [title, setTitle] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [grade, setGrade] = useState("4");
  const [phase, setPhase] = useState("");
  const [topic, setTopic] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");

  // Step 2 — Files
  const [spineParsed, setSpineParsed] = useState<ParsedFile | null>(null);
  const [applets, setApplets] = useState<AppletEntry[]>([]);

  // Step 3 — Submit
  const [submitting, setSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState("");

  // Shared
  const [error, setError] = useState("");

  // ── Helpers ────────────────────────────────────────────────────────

  const spineSlideCount = spineParsed?.slides.length ?? 0;

  function appletFileRefs(): Record<string, React.RefObject<HTMLInputElement | null>> {
    // We manage refs via closure — each applet row has its own ref created in JSX
    return {};
  }
  // Not used as a central map — each row uses a local ref. Keeping for clarity.
  void appletFileRefs;

  async function parseFile(file: File): Promise<SourceSlide[]> {
    const formData = new FormData();
    formData.append("file", file);
    const response = await fetch(`${PARSER_URL}/parse-pptx`, {
      method: "POST",
      headers: { "X-API-Key": PARSER_API_KEY },
      body: formData,
    });
    if (!response.ok) {
      const text = await response.text();
      throw new Error(`Parser error: ${text}`);
    }
    const parsed = await response.json();
    // Parser returns { slides: [...] } or just an array
    const rawSlides: Array<{
      slide_number?: number;
      sourceSlideNumber?: number;
      text_content?: string;
      textContent?: string;
      speaker_notes?: string;
      speakerNotes?: string;
      layout_type?: string;
      layoutType?: string;
      has_animation?: boolean;
      hasAnimation?: boolean;
      animation_sequence?: unknown;
      animationSequence?: unknown;
      metadata?: unknown;
    }> = Array.isArray(parsed) ? parsed : parsed.slides ?? [];
    return rawSlides.map(
      (s: {
        slide_number?: number;
        sourceSlideNumber?: number;
        text_content?: string;
        textContent?: string;
        speaker_notes?: string;
        speakerNotes?: string;
        layout_type?: string;
        layoutType?: string;
        has_animation?: boolean;
        hasAnimation?: boolean;
        animation_sequence?: unknown;
        animationSequence?: unknown;
        metadata?: unknown;
      }, idx: number): SourceSlide => ({
        sourceFile: "", // filled later by sequenceModuleFlow
        sourceSlideNumber:
          s.slide_number ?? s.sourceSlideNumber ?? idx + 1,
        textContent: s.text_content ?? s.textContent,
        speakerNotes: s.speaker_notes ?? s.speakerNotes,
        layoutType: s.layout_type ?? s.layoutType,
        hasAnimation: s.has_animation ?? s.hasAnimation,
        animationSequence: s.animation_sequence ?? s.animationSequence,
        metadata: s.metadata,
      })
    );
  }

  // ── Spine handling ─────────────────────────────────────────────────

  async function handleSpineSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".pptx")) {
      setError("Only .pptx files are accepted");
      return;
    }
    setError("");

    // Auto-fill title from filename if empty
    if (!title) {
      const name = f.name.replace(/\.pptx$/i, "").replace(/[-_]/g, " ");
      setTitle(name);
    }

    setSpineParsed({ file: f, slides: [], parsing: true, error: "" });

    try {
      const slides = await parseFile(f);
      setSpineParsed({ file: f, slides, parsing: false, error: "" });
    } catch (err) {
      setSpineParsed({
        file: f,
        slides: [],
        parsing: false,
        error: err instanceof Error ? err.message : "Parse failed",
      });
    }
  }

  // ── Applet handling ────────────────────────────────────────────────

  function addApplet() {
    const nextLabel = `A${applets.length + 1}`;
    setApplets((prev) => [
      ...prev,
      { label: nextLabel, afterSpineSlide: 1, parsed: null },
    ]);
  }

  function removeApplet(index: number) {
    setApplets((prev) => {
      const next = prev.filter((_, i) => i !== index);
      // Re-label
      return next.map((a, i) => ({ ...a, label: `A${i + 1}` }));
    });
  }

  function updateAppletSlidePosition(index: number, after: number) {
    setApplets((prev) =>
      prev.map((a, i) => (i === index ? { ...a, afterSpineSlide: after } : a))
    );
  }

  async function handleAppletFileSelect(
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".pptx")) {
      setError("Only .pptx files are accepted");
      return;
    }
    setError("");

    setApplets((prev) =>
      prev.map((a, i) =>
        i === index
          ? { ...a, parsed: { file: f, slides: [], parsing: true, error: "" } }
          : a
      )
    );

    try {
      const slides = await parseFile(f);
      setApplets((prev) =>
        prev.map((a, i) =>
          i === index
            ? { ...a, parsed: { file: f, slides, parsing: false, error: "" } }
            : a
        )
      );
    } catch (err) {
      setApplets((prev) =>
        prev.map((a, i) =>
          i === index
            ? {
                ...a,
                parsed: {
                  file: f,
                  slides: [],
                  parsing: false,
                  error:
                    err instanceof Error ? err.message : "Parse failed",
                },
              }
            : a
        )
      );
    }
  }

  // ── Step validation ────────────────────────────────────────────────

  function canProceedStep1(): boolean {
    return (
      title.trim().length > 0 &&
      learningObjective.trim().length > 0 &&
      submittedBy.trim().length > 0
    );
  }

  function canProceedStep2(): boolean {
    return (
      !!spineParsed &&
      !spineParsed.parsing &&
      spineParsed.slides.length > 0 &&
      !spineParsed.error
    );
  }

  // ── Build sequenced data ───────────────────────────────────────────

  function buildSequencedSlides() {
    if (!spineParsed) return [];
    const appletInputs = applets
      .filter((a) => a.parsed && a.parsed.slides.length > 0)
      .map((a) => ({
        label: a.label,
        afterSpineSlide: a.afterSpineSlide,
        slides: a.parsed!.slides,
      }));
    return sequenceModuleFlow(spineParsed.slides, appletInputs);
  }

  function buildFlowDescription() {
    return describeModuleFlow(buildSequencedSlides());
  }

  // ── Submit ─────────────────────────────────────────────────────────

  async function handleSubmit() {
    if (!spineParsed) return;
    setError("");
    setSubmitting(true);

    try {
      // Upload spine PPTX to Convex storage
      setSubmitProgress("Uploading spine PPTX...");
      const uploadUrl = await generateUploadUrl();
      const uploadResult = await fetch(uploadUrl, {
        method: "POST",
        headers: {
          "Content-Type":
            spineParsed.file.type ||
            "application/vnd.openxmlformats-officedocument.presentationml.presentation",
        },
        body: spineParsed.file,
      });
      if (!uploadResult.ok) {
        throw new Error(`Upload failed: ${uploadResult.statusText}`);
      }
      const { storageId } = await uploadResult.json();

      // Build source files array
      const sourceFiles = [
        {
          filename: spineParsed.file.name,
          type: "spine",
          label: "Spine",
          slideCount: spineParsed.slides.length,
          storageId: storageId as Id<"_storage">,
        },
        ...applets
          .filter((a) => a.parsed && a.parsed.slides.length > 0)
          .map((a) => ({
            filename: a.parsed!.file.name,
            type: "applet",
            label: a.label,
            afterSpineSlide: a.afterSpineSlide,
            slideCount: a.parsed!.slides.length,
          })),
      ];

      // Build sequenced slides
      const sequenced = buildSequencedSlides();
      const slides = sequenced.map((s) => ({
        slideNumber: s.slideNumber,
        sourceFile: s.sourceFile,
        sourceSlideNumber: s.sourceSlideNumber,
        textContent: s.textContent,
        speakerNotes: s.speakerNotes,
        layoutType: s.layoutType,
        hasAnimation: s.hasAnimation,
        animationSequence: s.animationSequence,
        metadata: s.metadata,
        thumbnailStorageId: s.thumbnailStorageId as Id<"_storage"> | undefined,
      }));

      setSubmitProgress("Creating module...");
      const moduleResult = await submitWithFlow({
        title: title.trim(),
        learningObjective: learningObjective.trim(),
        grade,
        phase: phase.trim() || undefined,
        topic: topic || undefined,
        submittedBy: submittedBy.trim(),
        sourceFiles,
        slides,
      });

      setSubmitProgress("Done! Redirecting...");
      router.push(`/module/${moduleResult.moduleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Submit failed");
      setSubmitProgress("");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ─────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              Submit Module for Review
            </h1>
            <p className="text-xs text-gray-500">
              Upload storyboard files to start the review pipeline
            </p>
          </div>
          <Link href="/board" className="text-sm text-blue-600 hover:underline">
            &larr; Back to Board
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <StepIndicator current={step} />

        {/* ── Step 1: Module Details ──────────────────────────────── */}
        {step === 1 && (
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">
              Module Details
            </h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Introduction to Fractions — Grade 4"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Learning Objective *
              </label>
              <textarea
                value={learningObjective}
                onChange={(e) => setLearningObjective(e.target.value)}
                placeholder="What should students be able to do after completing this module?"
                rows={3}
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
              />
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Grade *
                </label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>
                      Grade {g}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Topic
                </label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">
                  Phase
                </label>
                <input
                  type="text"
                  value={phase}
                  onChange={(e) => setPhase(e.target.value)}
                  placeholder="e.g. Phase 1"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">
                Your Name *
              </label>
              <input
                type="text"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
                placeholder="e.g. Priya, Rahul"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Nav */}
            <div className="flex justify-end pt-2">
              <button
                type="button"
                disabled={!canProceedStep1()}
                onClick={() => {
                  setError("");
                  setStep(2);
                }}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ── Step 2: Upload Files ───────────────────────────────── */}
        {step === 2 && (
          <div className="space-y-4">
            {/* Spine upload */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <label className="block text-sm font-semibold text-gray-700 mb-3">
                Spine PPTX <span className="text-red-500">*</span>
              </label>
              <div
                className={`border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors ${
                  spineParsed && !spineParsed.error
                    ? "border-emerald-300 bg-emerald-50"
                    : spineParsed?.error
                      ? "border-red-300 bg-red-50"
                      : "border-gray-300 hover:border-gray-400 bg-gray-50"
                }`}
                onClick={() => spineFileRef.current?.click()}
              >
                <input
                  ref={spineFileRef}
                  type="file"
                  accept=".pptx"
                  onChange={handleSpineSelect}
                  className="hidden"
                />
                {spineParsed ? (
                  <div>
                    <div
                      className={`text-sm font-medium ${spineParsed.error ? "text-red-700" : "text-emerald-700"}`}
                    >
                      {spineParsed.file.name}
                    </div>
                    {spineParsed.parsing && (
                      <div className="flex items-center justify-center gap-2 mt-2 text-xs text-gray-500">
                        <svg
                          className="animate-spin h-3.5 w-3.5 text-gray-400"
                          viewBox="0 0 24 24"
                          fill="none"
                        >
                          <circle
                            className="opacity-25"
                            cx="12"
                            cy="12"
                            r="10"
                            stroke="currentColor"
                            strokeWidth="4"
                          />
                          <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                          />
                        </svg>
                        Parsing {spineParsed.file.name}...
                      </div>
                    )}
                    {!spineParsed.parsing && !spineParsed.error && (
                      <div className="flex items-center justify-center gap-1.5 mt-2 text-xs text-emerald-600">
                        <span className="text-emerald-500">{"\u2713"}</span>
                        {spineParsed.slides.length} slides found — Click to
                        change
                      </div>
                    )}
                    {spineParsed.error && (
                      <div className="mt-2 text-xs text-red-600">
                        {spineParsed.error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div>
                    <div className="text-sm text-gray-500">
                      Click to select the spine .pptx file
                    </div>
                    <div className="text-xs text-gray-400 mt-1">
                      This is the main storyboard file
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Applets */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <label className="text-sm font-semibold text-gray-700">
                  Applet Storyboards
                </label>
                <button
                  type="button"
                  onClick={addApplet}
                  disabled={spineSlideCount === 0}
                  className="text-xs font-medium text-blue-600 hover:text-blue-800 disabled:text-gray-400 disabled:cursor-not-allowed"
                >
                  + Add Applet Storyboard
                </button>
              </div>

              {applets.length === 0 && (
                <p className="text-xs text-gray-400">
                  No applet storyboards added. Click &ldquo;Add Applet
                  Storyboard&rdquo; to insert applet slides into the module
                  flow.
                </p>
              )}

              <div className="space-y-3">
                {applets.map((applet, index) => (
                  <AppletRow
                    key={applet.label + index}
                    applet={applet}
                    index={index}
                    spineSlideCount={spineSlideCount}
                    onFileSelect={handleAppletFileSelect}
                    onPositionChange={updateAppletSlidePosition}
                    onRemove={removeApplet}
                  />
                ))}
              </div>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Nav */}
            <div className="flex justify-between pt-2">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setStep(1);
                }}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 transition-colors"
              >
                &larr; Back
              </button>
              <button
                type="button"
                disabled={!canProceedStep2()}
                onClick={() => {
                  setError("");
                  setStep(3);
                }}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next &rarr;
              </button>
            </div>
          </div>
        )}

        {/* ── Step 3: Review & Submit ────────────────────────────── */}
        {step === 3 && (
          <div className="space-y-4">
            {/* Module info summary */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Module Summary
              </h2>
              <dl className="grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
                <dt className="text-gray-400">Title</dt>
                <dd className="text-gray-900 font-medium">{title}</dd>
                <dt className="text-gray-400">Grade</dt>
                <dd className="text-gray-900">Grade {grade}</dd>
                {topic && (
                  <>
                    <dt className="text-gray-400">Topic</dt>
                    <dd className="text-gray-900">{topic}</dd>
                  </>
                )}
                {phase && (
                  <>
                    <dt className="text-gray-400">Phase</dt>
                    <dd className="text-gray-900">{phase}</dd>
                  </>
                )}
                <dt className="text-gray-400">Submitted by</dt>
                <dd className="text-gray-900">{submittedBy}</dd>
              </dl>
            </div>

            {/* Source files table */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Source Files
              </h2>
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-xs text-gray-400 border-b border-gray-100">
                    <th className="text-left pb-2 font-medium">File</th>
                    <th className="text-left pb-2 font-medium">Type</th>
                    <th className="text-right pb-2 font-medium">Slides</th>
                    <th className="text-right pb-2 font-medium">Insert After</th>
                  </tr>
                </thead>
                <tbody>
                  {spineParsed && (
                    <tr className="border-b border-gray-50">
                      <td className="py-1.5 text-gray-900">
                        {spineParsed.file.name}
                      </td>
                      <td className="py-1.5 text-gray-500">Spine</td>
                      <td className="py-1.5 text-right text-gray-900">
                        {spineParsed.slides.length}
                      </td>
                      <td className="py-1.5 text-right text-gray-400">
                        &mdash;
                      </td>
                    </tr>
                  )}
                  {applets
                    .filter((a) => a.parsed && a.parsed.slides.length > 0)
                    .map((a) => (
                      <tr key={a.label} className="border-b border-gray-50">
                        <td className="py-1.5 text-gray-900">
                          {a.parsed!.file.name}
                        </td>
                        <td className="py-1.5 text-gray-500">
                          Applet ({a.label})
                        </td>
                        <td className="py-1.5 text-right text-gray-900">
                          {a.parsed!.slides.length}
                        </td>
                        <td className="py-1.5 text-right text-gray-900">
                          Slide {a.afterSpineSlide}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Module flow preview */}
            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h2 className="text-sm font-semibold text-gray-700 mb-3">
                Module Flow
              </h2>
              <p className="text-xs text-gray-500 mb-3">
                Total: {buildSequencedSlides().length} slides
              </p>
              <div className="flex flex-wrap gap-2">
                {buildFlowDescription().map((seg, i) => (
                  <span
                    key={i}
                    className="inline-flex items-center gap-1 text-xs"
                  >
                    {i > 0 && (
                      <span className="text-gray-300 mr-1">{"\u2192"}</span>
                    )}
                    <span className="bg-gray-100 text-gray-700 px-2 py-1 rounded">
                      {seg}
                    </span>
                  </span>
                ))}
              </div>
            </div>

            {/* Learning objective reminder */}
            <div className="bg-blue-50 border border-blue-100 rounded-lg px-4 py-3">
              <p className="text-xs text-blue-700">
                <span className="font-semibold">Learning Objective:</span>{" "}
                {learningObjective}
              </p>
            </div>

            {/* Error */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            {/* Nav */}
            <div className="flex justify-between pt-2">
              <button
                type="button"
                disabled={submitting}
                onClick={() => {
                  setError("");
                  setStep(2);
                }}
                className="px-6 py-2.5 border border-gray-300 text-gray-700 rounded-lg text-sm font-semibold hover:bg-gray-100 disabled:opacity-40 transition-colors"
              >
                &larr; Back
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={handleSubmit}
                className="px-6 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {submitting ? submitProgress : "Submit for Review"}
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ── Applet row component ─────────────────────────────────────────────

function AppletRow({
  applet,
  index,
  spineSlideCount,
  onFileSelect,
  onPositionChange,
  onRemove,
}: {
  applet: AppletEntry;
  index: number;
  spineSlideCount: number;
  onFileSelect: (
    index: number,
    e: React.ChangeEvent<HTMLInputElement>
  ) => void;
  onPositionChange: (index: number, after: number) => void;
  onRemove: (index: number) => void;
}) {
  const fileRef = useRef<HTMLInputElement>(null);

  const slideOptions: number[] = [];
  for (let i = 1; i <= spineSlideCount; i++) {
    slideOptions.push(i);
  }

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg border border-gray-100">
      {/* Label */}
      <div className="flex-shrink-0 w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600">
        {applet.label}
      </div>

      {/* File picker */}
      <div className="flex-1 min-w-0">
        <input
          ref={fileRef}
          type="file"
          accept=".pptx"
          onChange={(e) => onFileSelect(index, e)}
          className="hidden"
        />
        {applet.parsed ? (
          <div>
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className={`text-xs font-medium truncate max-w-full ${applet.parsed.error ? "text-red-700" : "text-emerald-700"}`}
            >
              {applet.parsed.file.name}
            </button>
            {applet.parsed.parsing && (
              <div className="flex items-center gap-1.5 mt-0.5 text-[10px] text-gray-500">
                <svg
                  className="animate-spin h-3 w-3 text-gray-400"
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                  />
                </svg>
                Parsing...
              </div>
            )}
            {!applet.parsed.parsing && !applet.parsed.error && (
              <div className="text-[10px] text-emerald-600 mt-0.5">
                {"\u2713"} {applet.parsed.slides.length} slides found
              </div>
            )}
            {applet.parsed.error && (
              <div className="text-[10px] text-red-600 mt-0.5">
                {applet.parsed.error}
              </div>
            )}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            className="text-xs text-blue-600 hover:text-blue-800"
          >
            Select .pptx file
          </button>
        )}
      </div>

      {/* Insert position */}
      <div className="flex-shrink-0">
        <label className="block text-[10px] text-gray-400 mb-0.5">
          After slide
        </label>
        <select
          value={applet.afterSpineSlide}
          onChange={(e) => onPositionChange(index, Number(e.target.value))}
          className="px-2 py-1 border border-gray-200 rounded text-xs focus:outline-none focus:ring-1 focus:ring-blue-500"
        >
          {slideOptions.map((n) => (
            <option key={n} value={n}>
              {n}
            </option>
          ))}
        </select>
      </div>

      {/* Remove */}
      <button
        type="button"
        onClick={() => onRemove(index)}
        className="flex-shrink-0 mt-1 text-gray-400 hover:text-red-500 transition-colors"
        title="Remove applet"
      >
        <svg className="w-4 h-4" viewBox="0 0 20 20" fill="currentColor">
          <path
            fillRule="evenodd"
            d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
            clipRule="evenodd"
          />
        </svg>
      </button>
    </div>
  );
}
