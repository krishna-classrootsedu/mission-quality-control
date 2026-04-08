import { ownerChipColors } from "@/lib/types";

interface OwnerChipProps {
  name: string | null;
  size?: "sm" | "md";
}

export default function OwnerChip({ name, size = "sm" }: OwnerChipProps) {
  if (!name) {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-stone-100 text-stone-400 text-[11px] font-medium">
        —
      </span>
    );
  }

  const { bg, text } = ownerChipColors(name);
  const initials = name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");

  if (size === "md") {
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[12px] font-medium ${bg} ${text}`}>
        <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold ${bg} ${text} border border-current/20`}>
          {initials}
        </span>
        {name.split(/\s+/)[0]}
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${bg} ${text} whitespace-nowrap`}>
      <span className="font-bold">{initials}</span>
      <span>{name.split(/\s+/)[0]}</span>
    </span>
  );
}
