"use client";

function getTimeInStage(updatedAt: string): { label: string; level: "green" | "amber" | "red" } {
  const ms = Date.now() - new Date(updatedAt).getTime();
  const hours = ms / (1000 * 60 * 60);

  if (hours < 2) return { label: `${Math.round(hours * 60)}m`, level: "green" };
  if (hours < 24) return { label: `${Math.round(hours)}h`, level: "green" };
  if (hours < 48) return { label: "1d", level: "amber" };
  const days = Math.round(hours / 24);
  return { label: `${days}d`, level: days > 3 ? "red" : "amber" };
}

const LEVEL_STYLES = {
  green: "bg-emerald-200 text-emerald-800",
  amber: "bg-amber-200 text-amber-800",
  red: "bg-red-200 text-red-800",
};

export default function HealthBar({ updatedAt }: { updatedAt: string }) {
  const { label, level } = getTimeInStage(updatedAt);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-mono ${LEVEL_STYLES[level]}`}>
      {label}
    </span>
  );
}
