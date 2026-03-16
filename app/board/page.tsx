import Link from "next/link";
import ModuleBoard from "@/components/ModuleBoard";

export default function BoardPage() {
  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-3">
          <div>
            <h1 className="text-lg font-bold text-gray-900">Mission Quality Control</h1>
            <p className="text-xs text-gray-500">EdutechPlus Content Review Pipeline</p>
          </div>
          <Link
            href="/upload"
            className="px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
          >
            + Upload Module
          </Link>
        </div>
      </header>

      {/* Board */}
      <main className="pt-4">
        <ModuleBoard />
      </main>
    </div>
  );
}
