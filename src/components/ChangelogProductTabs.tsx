import { useRef } from "react";
import { useMeasuredHighlight, type HighlightItemRefs } from "../hooks/useMeasuredHighlight";

export type ChangelogProduct = "webapp" | "desktop" | "extension";

export const CHANGELOG_TABS: Array<{ id: ChangelogProduct; label: string; sectionTitle: string }> = [
  { id: "webapp", label: "Webapp", sectionTitle: "Versions" },
  { id: "desktop", label: "Desktop", sectionTitle: "Desktop Versions" },
  { id: "extension", label: "Extension", sectionTitle: "Extension Versions" },
];

type ChangelogProductTabsProps = {
  activeTab: ChangelogProduct;
  ariaLabel: string;
  onChange: (tab: ChangelogProduct) => void;
};

export function ChangelogProductTabs({ activeTab, ariaLabel, onChange }: ChangelogProductTabsProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<HighlightItemRefs<HTMLButtonElement>>({
    webapp: null,
    desktop: null,
    extension: null,
  });
  const highlightStyle = useMeasuredHighlight({
    activeKey: activeTab,
    containerRef,
    itemRefs: tabRefs,
  });

  return (
    <div
      ref={containerRef}
      className="relative inline-flex min-w-0 items-center gap-2 overflow-hidden rounded-app-chip border border-app-line bg-app-surface-muted p-2"
      role="tablist"
      aria-label={ariaLabel}
    >
      {highlightStyle ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 rounded-app-chip border border-action-primary bg-action-primary transition-[transform,width,height,opacity] duration-app-slow ease-app-in-out"
          style={highlightStyle}
        >
          <div className="absolute inset-0 rounded-app-chip" />
        </div>
      ) : null}
      {CHANGELOG_TABS.map((tab) => {
        const isActive = activeTab === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={isActive}
            ref={(node) => {
              tabRefs.current[tab.id] = node;
            }}
            className={[
              "relative rounded-app-chip px-3 py-2 text-[14px] font-medium leading-none transition-[transform,color,opacity] duration-150 ease-out active:translate-y-px active:scale-[0.98] sm:px-4",
              isActive ? "text-action-primary-ink" : "text-app-ink-faint hover:text-app-ink",
            ].join(" ")}
            onClick={() => onChange(tab.id)}
          >
            <span className="relative z-10">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
