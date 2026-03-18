"use client";

type FilterItem = {
  label: string;
  value: string;
  count: number;
};

export default function FixDirectiveFilters({
  filters,
  activeFilter,
  onFilterChange,
}: {
  filters: FilterItem[];
  activeFilter: string;
  onFilterChange: (value: string) => void;
}) {
  return (
    <div className="flex gap-1.5 flex-wrap">
      {filters.map((f) => (
        <button
          key={f.value}
          onClick={() => onFilterChange(f.value)}
          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
            activeFilter === f.value
              ? "bg-gray-900 text-white shadow-sm"
              : "bg-gray-100/80 text-gray-500 hover:bg-gray-200/80 hover:text-gray-700"
          }`}
        >
          {f.label}
          <span
            className={`ml-1.5 ${activeFilter === f.value ? "text-gray-400" : "text-gray-400"}`}
          >
            {f.count}
          </span>
        </button>
      ))}
    </div>
  );
}
