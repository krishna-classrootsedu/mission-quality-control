import { BoardColumn, BOARD_COLUMN_COLORS, BOARD_COLUMN_LABELS } from "@/lib/types";

interface StagePillProps {
  column: BoardColumn;
  status?: string;
  className?: string;
}

export default function StagePill({ column, status, className = "" }: StagePillProps) {
  const colors = BOARD_COLUMN_COLORS[column];
  const label = BOARD_COLUMN_LABELS[column];
  const isIntakeComplete = status === "intake_complete";
  const pillClasses = isIntakeComplete
    ? "bg-emerald-50 text-emerald-700 border-emerald-200"
    : `${colors.bg} ${colors.text} ${colors.border}`;
  const displayLabel = isIntakeComplete ? "parsing done" : label;


  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-medium border whitespace-nowrap ${pillClasses} ${className}`}
    >
      {!isIntakeComplete && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${colors.dot}`} />}
      {displayLabel}
    </span>
  );
}
