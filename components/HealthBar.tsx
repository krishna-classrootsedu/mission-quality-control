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
  green: "bg-emerald-100 text-emerald-700",
  amber: "bg-amber-100 text-amber-700",
  red: "bg-red-100 text-red-700",
};

export default function HealthBar({ updatedAt }: { updatedAt: string }) {
  const { label, level } = getTimeInStage(updatedAt);
  return (
    <span className={`inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-mono font-medium ${LEVEL_STYLES[level]}`}>
      {label}
    </span>
  );
}
