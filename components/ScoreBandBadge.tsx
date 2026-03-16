"use client";

const BAND_STYLES: Record<string, string> = {
  ship_ready: "bg-emerald-100 text-emerald-800 border-emerald-300",
  upgradeable: "bg-amber-100 text-amber-800 border-amber-300",
  re_architect: "bg-orange-100 text-orange-800 border-orange-300",
  reframe: "bg-red-100 text-red-800 border-red-300",
};

const BAND_LABELS: Record<string, string> = {
  ship_ready: "Ship-ready",
  upgradeable: "Upgradeable",
  re_architect: "Re-architect",
  reframe: "Reframe",
};

export default function ScoreBandBadge({ band }: { band: string | null }) {
  if (!band) return null;
  const style = BAND_STYLES[band] ?? "bg-gray-100 text-gray-600 border-gray-300";
  const label = BAND_LABELS[band] ?? band;
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium border ${style}`}>
      {label}
    </span>
  );
}
