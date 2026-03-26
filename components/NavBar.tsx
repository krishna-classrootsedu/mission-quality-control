"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_LINKS = [
  { href: "/board", label: "Board" },
  { href: "/upload", label: "Upload" },
  { href: "/usage", label: "Usage" },
];

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="bg-stone-50/90 backdrop-blur-xl border-b border-stone-200/60 h-12 sticky top-0 z-20">
      <div className="h-full max-w-[1400px] mx-auto px-6 flex items-center">
        <Link href="/board" className="text-sm font-semibold text-stone-800 tracking-tight">
          Mission QC
        </Link>
        <div className="w-px h-5 bg-stone-200 mx-4" />
        <div className="flex items-center gap-1">
          {NAV_LINKS.map((link) => {
            const isActive = pathname === link.href || pathname.startsWith(link.href + "/");
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`relative px-3 py-1.5 text-sm font-medium transition-colors ${
                  isActive
                    ? "text-stone-900"
                    : "text-stone-400 hover:text-stone-600"
                }`}
              >
                {link.label}
                {isActive && (
                  <span className="absolute bottom-0 left-3 right-3 h-[2px] bg-stone-800 rounded-full" />
                )}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
