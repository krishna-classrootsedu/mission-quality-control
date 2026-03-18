"use client";

export default function FixDirectiveStickyBar({
  unsavedCount,
  needsDecisionCount = 0,
  pendingCount,
  saving,
  onSave,
  onComplete,
}: {
  unsavedCount: number;
  needsDecisionCount?: number;
  pendingCount: number;
  saving: boolean;
  onSave: () => void;
  onComplete: () => void;
}) {
  return (
    <div className="sticky bottom-0 bg-white/95 backdrop-blur-sm border-t border-gray-200/80 px-5 py-3.5 flex items-center justify-between shrink-0">
      <div className="text-sm text-gray-500 flex items-center gap-3">
        {unsavedCount > 0 && (
          <span className="text-amber-600 font-medium">
            {unsavedCount} ready to save
          </span>
        )}
        {needsDecisionCount > 0 && (
          <span className="text-orange-500 text-xs">
            {needsDecisionCount} {needsDecisionCount === 1 ? "row needs" : "rows need"} Accept/Reject before saving
          </span>
        )}
        {unsavedCount === 0 && needsDecisionCount === 0 && pendingCount > 0 && (
          <span className="text-gray-400">{pendingCount} directives still pending</span>
        )}
        {unsavedCount === 0 && needsDecisionCount === 0 && pendingCount === 0 && (
          <span className="text-emerald-600 font-medium">All directives reviewed</span>
        )}
      </div>
      <div className="flex gap-2.5">
        {unsavedCount > 0 && (
          <button
            onClick={onSave}
            disabled={saving}
            className="px-5 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 disabled:opacity-50 transition-all shadow-sm"
          >
            {saving ? "Saving..." : `Save ${unsavedCount} ${unsavedCount === 1 ? "Decision" : "Decisions"}`}
          </button>
        )}
        {pendingCount === 0 && unsavedCount === 0 && needsDecisionCount === 0 && (
          <button
            onClick={onComplete}
            className="px-5 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all shadow-sm"
          >
            Complete Review
          </button>
        )}
      </div>
    </div>
  );
}
