"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import Link from "next/link";

const GRADES = ["3", "4", "5", "6"];
const TOPICS = ["Fractions", "Decimals", "Geometry", "Measurement", "Data Handling", "Whole Numbers", "Algebra", "Other"];

export default function UploadPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);
  const generateUploadUrl = useMutation(api.modules.generateUploadUrl);
  const submitModule = useMutation(api.modules.submitModule);

  const [title, setTitle] = useState("");
  const [learningObjective, setLearningObjective] = useState("");
  const [grade, setGrade] = useState("4");
  const [phase, setPhase] = useState("");
  const [topic, setTopic] = useState("");
  const [submittedBy, setSubmittedBy] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [uploadProgress, setUploadProgress] = useState<string>("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (!f.name.endsWith(".pptx")) {
      setError("Only .pptx files are accepted");
      return;
    }
    setFile(f);
    setError("");

    // Auto-fill title from filename if empty
    if (!title) {
      const name = f.name.replace(/\.pptx$/i, "").replace(/[-_]/g, " ");
      setTitle(name);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (!file) {
      setError("Please select a PPTX file");
      return;
    }
    if (!title.trim()) {
      setError("Title is required");
      return;
    }
    if (!learningObjective.trim()) {
      setError("Learning objective is required");
      return;
    }
    if (!submittedBy.trim()) {
      setError("Your name is required");
      return;
    }

    setUploading(true);

    try {
      // Step 1: Get upload URL from Convex
      setUploadProgress("Preparing upload...");
      const uploadUrl = await generateUploadUrl();

      // Step 2: Upload file to Convex storage
      setUploadProgress(`Uploading ${file.name} (${(file.size / 1024 / 1024).toFixed(1)} MB)...`);
      const result = await fetch(uploadUrl, {
        method: "POST",
        headers: { "Content-Type": file.type || "application/vnd.openxmlformats-officedocument.presentationml.presentation" },
        body: file,
      });

      if (!result.ok) {
        throw new Error(`Upload failed: ${result.statusText}`);
      }

      const { storageId } = await result.json();

      // Step 3: Create module record
      setUploadProgress("Creating module...");
      const moduleResult = await submitModule({
        title: title.trim(),
        learningObjective: learningObjective.trim(),
        grade,
        phase: phase.trim() || undefined,
        topic: topic || undefined,
        submittedBy: submittedBy.trim(),
        pptxStorageId: storageId,
        fileName: file.name,
      });

      setUploadProgress("Done! Redirecting...");
      router.push(`/module/${moduleResult.moduleId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload failed");
      setUploadProgress("");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Submit Module for Review</h1>
            <p className="text-xs text-gray-500">Upload a PPTX storyboard to start the review pipeline</p>
          </div>
          <Link href="/board" className="text-sm text-blue-600 hover:underline">
            ← Back to Board
          </Link>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-8">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* File upload */}
          <div className="bg-white rounded-lg border border-gray-200 p-6">
            <label className="block text-sm font-semibold text-gray-700 mb-3">
              PPTX File
            </label>
            <div
              className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-colors ${
                file ? "border-emerald-300 bg-emerald-50" : "border-gray-300 hover:border-gray-400 bg-gray-50"
              }`}
              onClick={() => fileRef.current?.click()}
            >
              <input
                ref={fileRef}
                type="file"
                accept=".pptx"
                onChange={handleFileChange}
                className="hidden"
              />
              {file ? (
                <div>
                  <div className="text-sm font-medium text-emerald-700">{file.name}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    {(file.size / 1024 / 1024).toFixed(1)} MB — Click to change
                  </div>
                </div>
              ) : (
                <div>
                  <div className="text-sm text-gray-500">Click to select a .pptx file</div>
                  <div className="text-xs text-gray-400 mt-1">or drag and drop</div>
                </div>
              )}
            </div>
          </div>

          {/* Module details */}
          <div className="bg-white rounded-lg border border-gray-200 p-6 space-y-4">
            <h2 className="text-sm font-semibold text-gray-700">Module Details</h2>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Introduction to Fractions — Grade 4"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">Learning Objective *</label>
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
                <label className="block text-xs font-medium text-gray-500 mb-1">Grade *</label>
                <select
                  value={grade}
                  onChange={(e) => setGrade(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {GRADES.map((g) => (
                    <option key={g} value={g}>Grade {g}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Topic</label>
                <select
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">Select...</option>
                  {TOPICS.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-500 mb-1">Phase</label>
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
              <label className="block text-xs font-medium text-gray-500 mb-1">Your Name *</label>
              <input
                type="text"
                value={submittedBy}
                onChange={(e) => setSubmittedBy(e.target.value)}
                placeholder="e.g. Priya, Rahul"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={uploading}
            className="w-full py-3 bg-gray-900 text-white rounded-lg text-sm font-semibold hover:bg-gray-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {uploading ? uploadProgress : "Submit for Review"}
          </button>
        </form>
      </main>
    </div>
  );
}
