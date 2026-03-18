import Link from "next/link";
import ModuleBoard from "@/components/ModuleBoard";

export default function BoardPage() {
  return (
    <div className="min-h-screen">
      <header className="border-b border-gray-200/80 bg-white/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center justify-between px-6 py-4">
          <div>
            <h1 className="text-[17px] font-semibold text-gray-900 tracking-tight">Mission Quality Control</h1>
            <p className="text-xs text-gray-400 mt-0.5">EdTechPlus Content Review Pipeline</p>
          </div>
          <Link
            href="/upload"
            className="inline-flex items-center gap-1.5 px-4 py-2 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-all shadow-sm"
          >
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
            </svg>
            Upload Module
          </Link>
        </div>
      </header>
      <main className="pt-5 pb-8">
        <ModuleBoard />
      </main>
    </div>
  );
}
