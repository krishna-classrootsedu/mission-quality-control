import { BoardColumn, BOARD_COLUMN_COLORS, BOARD_COLUMN_LABELS } from "@/lib/types";

interface StagePillProps {
  column: BoardColumn;
  className?: string;
}

export default function StagePill({ column, className = "" }: StagePillProps) {
  const colors = BOARD_COLUMN_COLORS[column];
  const label = BOARD_COLUMN_LABELS[column];

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border ${colors.bg} ${colors.text} ${colors.border} whitespace-nowrap ${className}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />
      {label}
    </span>
  );
}
