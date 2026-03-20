"use client";

const BAND_STYLES: Record<string, string> = {
  ship_ready: "bg-stone-800 text-white border-stone-800",
  upgradeable: "bg-stone-100 text-stone-700 border-stone-300",
  rework: "bg-stone-100 text-stone-500 border-stone-200",
  redesign: "bg-red-50 text-red-600 border-red-200",
  re_architect: "bg-stone-100 text-stone-500 border-stone-200",
  reframe: "bg-red-50 text-red-600 border-red-200",
};

const BAND_LABELS: Record<string, string> = {
  ship_ready: "Ship-ready",
  upgradeable: "Upgradeable",
  rework: "Rework",
  redesign: "Redesign",
  re_architect: "Re-architect",
  reframe: "Reframe",
};

export default function ScoreBandBadge({ band }: { band: string | null }) {
  if (!band) return null;
  const style = BAND_STYLES[band] ?? "bg-stone-100 text-stone-500 border-stone-200";
  const label = BAND_LABELS[band] ?? band;
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded text-[11px] font-semibold border ${style}`}>
      {label}
    </span>
  );
}
