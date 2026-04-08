"use client";

import { motion } from "framer-motion";

type SourceFile = { type: string; label: string };

interface SidebarItem {
  key: string;
  label: string;
  badge?: number;
  isAddCustom?: boolean;
}

interface ModuleSidebarProps {
  activeSection: string;
  onSectionChange: (section: string) => void;
  sourceFiles?: SourceFile[];
  /** Pending rec counts per component key */
  pendingBadges: Record<string, number>;
  /** Total custom recs count (all statuses) */
  customRecCount: number;
  /** Whether user can add custom recs */
  canReview: boolean;
  onAddCustomRec?: () => void;
}

export default function ModuleSidebar({
  activeSection,
  onSectionChange,
  sourceFiles,
  pendingBadges,
  customRecCount,
  canReview,
  onAddCustomRec,
}: ModuleSidebarProps) {
  const applets: SidebarItem[] = [];
  if (sourceFiles) {
    for (const sf of sourceFiles) {
      if (sf.type === "applet") {
        const match = sf.label.match(/^A(\d+)$/);
        const key = match ? `applet_${match[1]}` : sf.label;
        const label = sf.label.replace(/^A/, "Applet ");
        applets.push({ key, label, badge: pendingBadges[key] });
      }
    }
  }

  const spineItem: SidebarItem = { key: "spine", label: "Spine", badge: pendingBadges["spine"] };
  const globalItem: SidebarItem = { key: "global", label: "Global recs", badge: pendingBadges["global"] };
  const customItem: SidebarItem = { key: "custom", label: "Custom recs", badge: customRecCount > 0 ? customRecCount : undefined };

  return (
    <aside className="w-52 shrink-0 border-r border-stone-100 bg-white/95 overflow-y-auto flex flex-col">
      <nav className="p-2 pt-3 flex-1">
        {/* Top: Overview + Flow */}
        <SidebarSection>
          <SidebarNavItem
            item={{ key: "overview", label: "Overview" }}
            active={activeSection === "overview"}
            onClick={() => onSectionChange("overview")}
          />
          <SidebarNavItem
            item={{ key: "flow", label: "Flow" }}
            active={activeSection === "flow"}
            onClick={() => onSectionChange("flow")}
          />
        </SidebarSection>

        {/* Divider */}
        <SidebarDivider label="components" />

        {/* Components: Spine + Applets */}
        <SidebarSection>
          <SidebarNavItem
            item={spineItem}
            active={activeSection === "spine"}
            onClick={() => onSectionChange("spine")}
          />
          {applets.map((a) => (
            <SidebarNavItem
              key={a.key}
              item={a}
              active={activeSection === a.key}
              onClick={() => onSectionChange(a.key)}
            />
          ))}
        </SidebarSection>

        {/* Divider */}
        <SidebarDivider label="recommendations" />

        {/* Recs: Global + Custom */}
        <SidebarSection>
          <SidebarNavItem
            item={globalItem}
            active={activeSection === "global"}
            onClick={() => onSectionChange("global")}
          />
          <SidebarNavItem
            item={customItem}
            active={activeSection === "custom"}
            onClick={() => onSectionChange("custom")}
          />
          {canReview && (
            <button
              onClick={() => {
                onSectionChange("custom");
                onAddCustomRec?.();
              }}
              className="ml-3 mt-1 flex items-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] text-stone-400 hover:text-stone-600 hover:bg-stone-50 transition-colors w-full text-left group"
            >
              <span className="w-4 h-4 rounded-full border border-stone-200 flex items-center justify-center text-stone-300 group-hover:border-stone-400 group-hover:text-stone-500 transition-colors shrink-0">
                <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                  <line x1="4" y1="1" x2="4" y2="7" />
                  <line x1="1" y1="4" x2="7" y2="4" />
                </svg>
              </span>
              <span>Add custom rec</span>
            </button>
          )}
        </SidebarSection>
      </nav>
    </aside>
  );
}

function SidebarSection({ children }: { children: React.ReactNode }) {
  return <div className="space-y-0.5 mb-1">{children}</div>;
}

function SidebarDivider({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-2 px-2 py-2 my-1">
      <span className="text-[10px] font-semibold text-stone-300 uppercase tracking-[0.1em]">{label}</span>
      <div className="flex-1 h-px bg-stone-100" />
    </div>
  );
}

function SidebarNavItem({
  item,
  active,
  onClick,
}: {
  item: SidebarItem;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`relative w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md text-left transition-all ${
        active
          ? "bg-stone-100/80 text-stone-900"
          : "text-stone-500 hover:text-stone-700 hover:bg-stone-50/70"
      }`}
    >
      {/* Active left accent */}
      {active && (
        <motion.span
          layoutId="sidebar-accent"
          className="absolute left-0 top-1 bottom-1 w-[2.5px] bg-stone-700 rounded-full"
          transition={{ type: "spring", stiffness: 500, damping: 35 }}
        />
      )}

      <span className={`text-[13px] pl-1 ${active ? "font-medium" : ""}`}>{item.label}</span>

      {item.badge != null && item.badge > 0 && (
        <span
          className={`shrink-0 min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-semibold flex items-center justify-center ${
            active
              ? "bg-stone-700 text-white"
              : "bg-stone-200 text-stone-600"
          }`}
        >
          {item.badge}
        </span>
      )}
    </button>
  );
}
