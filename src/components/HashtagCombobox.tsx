import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search, X } from "lucide-react";
import { hashtagColor } from "../lib/hashtags";
import { Chip } from "./ui";

interface HashtagOption {
  _id: string;
  name: string;
  nameLower: string;
}

interface HashtagComboboxProps {
  hashtags: HashtagOption[];
  selected: string[]; // nameLower values
  onChange: (selected: string[]) => void;
  align?: "left" | "right";
}

export function HashtagCombobox({ hashtags, selected, onChange, align = "right" }: HashtagComboboxProps) {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState("");
  const containerRef = useRef<HTMLDivElement | null>(null);
  const filterRef = useRef<HTMLInputElement | null>(null);

  const filtered = useMemo(() => {
    if (!filter.trim()) return hashtags;
    const lf = filter.toLowerCase();
    return hashtags.filter((h) => h.nameLower.includes(lf));
  }, [hashtags, filter]);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Focus filter input when dropdown opens
  useEffect(() => {
    if (open) {
      setTimeout(() => filterRef.current?.focus(), 50);
    } else {
      setFilter("");
    }
  }, [open]);

  const toggle = (nameLower: string) => {
    if (selected.includes(nameLower)) {
      onChange(selected.filter((s) => s !== nameLower));
    } else {
      onChange([...selected, nameLower]);
    }
  };

  const allSelected = selected.length === 0;
  const label = allSelected
    ? "All hashtags"
    : selected.length === 1
      ? `#${hashtags.find((h) => h.nameLower === selected[0])?.name ?? selected[0]}`
      : `${selected.length} hashtags`;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-1.5 rounded-full border border-app-line bg-app-surface/90 px-3 py-1.5 text-xs font-medium text-app-ink-muted shadow-sm backdrop-blur transition hover:bg-app-surface"
      >
        <span>{label}</span>
        {selected.length > 0 && (
          <span
            role="button"
            tabIndex={0}
            className="ml-0.5 rounded-full p-0.5 text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink-muted"
            onMouseDown={(e) => {
              e.stopPropagation();
              onChange([]);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.stopPropagation(); onChange([]); }
            }}
            aria-label="Clear selection"
          >
            <X className="h-3 w-3" />
          </span>
        )}
        <ChevronDown className={["h-3 w-3 text-app-ink-faint transition-transform", open ? "rotate-180" : ""].join(" ")} />
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={[
            "absolute top-full z-30 mt-2 w-56 overflow-hidden rounded-2xl border border-app-line bg-app-surface shadow-app-menu",
            align === "left" ? "left-0" : "right-0",
          ].join(" ")}
        >
          {/* Search */}
          <div className="flex items-center gap-2 border-b border-app-line px-3 py-2">
            <Search className="h-3.5 w-3.5 shrink-0 text-app-ink-faint" />
            <input
              ref={filterRef}
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Search hashtags…"
              className="flex-1 bg-transparent text-xs outline-none placeholder:text-app-ink-faint"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between border-b border-app-line px-3 py-1.5">
            <button
              type="button"
              className="text-[11px] text-app-ink-faint hover:text-app-ink"
              onClick={() => onChange([])}
            >
              Show all
            </button>
            {filtered.length > 0 && (
              <button
                type="button"
                className="text-[11px] text-app-ink-faint hover:text-app-ink"
                onClick={() => onChange(filtered.map((h) => h.nameLower))}
              >
                Select visible
              </button>
            )}
          </div>

          {/* Options */}
          <div className="max-h-52 overflow-y-auto p-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-xs text-app-ink-faint">No hashtags match.</p>
            ) : (
              filtered.map((h) => {
                const color = hashtagColor(h.name);
                const isChecked = selected.includes(h.nameLower);
                return (
                  <button
                    key={h._id}
                    type="button"
                    onClick={() => toggle(h.nameLower)}
                    className="flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left transition hover:bg-app-surface-hover"
                  >
                    <span
                      className={[
                        "flex h-4 w-4 shrink-0 items-center justify-center rounded border transition",
                        isChecked
                          ? "border-transparent bg-action-primary text-action-primary-ink"
                          : "border-app-line-strong bg-app-surface",
                      ].join(" ")}
                    >
                      {isChecked && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <Chip className={`text-xs ${color.bg} ${color.darkBg} ${color.text} ${color.darkText}`}>
                      #{h.name}
                    </Chip>
                  </button>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
