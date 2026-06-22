import { useEffect, useRef, useState } from "react";
import type { NoteFolder, BookmarkCategory } from "../../shared/types";
import { CategoryIconView } from "../../../src/lib/bookmark-category-icon";
import { sortTargetsByName } from "../../shared/folder-selection";

type Target = NoteFolder | BookmarkCategory;

export function FolderSelect({
  items,
  value,
  onChange,
}: {
  items: Target[];
  value: string;
  onChange: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const sorted = sortTargetsByName(items);
  const selected = sorted.find((i) => i._id === value);

  useEffect(() => {
    if (!open) return;
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={containerRef} className="folder-select">
      <button
        type="button"
        className="folder-select-trigger"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="folder-select-icon">
          <CategoryIconView icon={selected?.icon} size="sm" />
        </span>
        <span className="folder-select-name">{selected?.name ?? "Select…"}</span>
        <svg className="folder-select-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>
      {open && (
        <div className="folder-select-dropdown">
          {sorted.map((item) => (
            <button
              key={item._id}
              type="button"
              className={`folder-select-option${item._id === value ? " selected" : ""}`}
              onClick={() => { onChange(item._id); setOpen(false); }}
            >
              <span className="folder-select-icon">
                <CategoryIconView icon={item.icon} size="sm" />
              </span>
              <span className="folder-select-name">{item.name}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
