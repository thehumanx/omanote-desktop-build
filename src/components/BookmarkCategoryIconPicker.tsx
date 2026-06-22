import { useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import {
  LUCIDE_CATEGORY_ICONS,
  QUICK_PICK_EMOJIS,
  CategoryIconView,
  parseIconInput,
  searchEmoji,
} from "../lib/bookmark-category-icon";
import { cn } from "./ui";

interface BookmarkCategoryIconPickerProps {
  anchorRef: React.RefObject<HTMLElement | null>;
  currentIcon?: string;
  onSelect: (icon: string | undefined) => void;
  onClose: () => void;
}

function isMobile() {
  return typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches;
}

export function BookmarkCategoryIconPicker({
  anchorRef,
  currentIcon,
  onSelect,
  onClose,
}: BookmarkCategoryIconPickerProps) {
  const [emojiInput, setEmojiInput] = useState("");
  const [suggestions, setSuggestions] = useState<Array<{ name: string; emoji: string }>>([]);
  const [activeIdx, setActiveIdx] = useState(-1);
  const [position, setPosition] = useState<{ top: number; left?: number; right?: number } | null>(null);
  const [positioned, setPositioned] = useState(false);
  const mobile = isMobile();
  const pickerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (mobile) return;
    const anchor = anchorRef.current;
    const picker = pickerRef.current;
    if (!anchor || !picker) return;

    const anchorRect = anchor.getBoundingClientRect();
    const pickerHeight = picker.getBoundingClientRect().height;
    const pickerWidth = 272;
    const gap = 6;
    const margin = 8;

    // Horizontal: left-align with anchor, flip to right-align if it overflows
    let left: number | undefined;
    let right: number | undefined;
    if (anchorRect.left + pickerWidth + margin <= window.innerWidth) {
      left = anchorRect.left;
    } else {
      right = window.innerWidth - anchorRect.right;
    }

    // Vertical: prefer below, flip above when there isn't enough space
    const spaceBelow = window.innerHeight - anchorRect.bottom - gap;
    const spaceAbove = anchorRect.top - gap;
    let top: number;
    if (spaceBelow >= pickerHeight || spaceBelow >= spaceAbove) {
      top = anchorRect.bottom + gap;
    } else {
      top = anchorRect.top - gap - pickerHeight;
    }
    // Clamp within viewport
    top = Math.max(margin, Math.min(top, window.innerHeight - pickerHeight - margin));

    setPosition({ top, left, right });
    setPositioned(true);
  }, [anchorRef, mobile]);

  function handleEmojiInputChange(value: string) {
    setEmojiInput(value);
    setActiveIdx(-1);
    setSuggestions(searchEmoji(value));
  }

  function selectSuggestion(emoji: string) {
    onSelect(emoji);
    setEmojiInput("");
    setSuggestions([]);
    setActiveIdx(-1);
  }

  function commitEmojiInput() {
    const parsed = parseIconInput(emojiInput);
    if (parsed) {
      onSelect(parsed);
      setEmojiInput("");
      setSuggestions([]);
    }
  }

  const pickerContent = (
    <div
      ref={pickerRef}
      data-omanote-ignore-outside-click="true"
      className={cn(
        "z-app-menu flex w-68 flex-col gap-3 rounded-xl border border-app-line bg-app-surface p-3 shadow-soft",
        mobile
          ? "fixed inset-x-0 bottom-0 w-full rounded-b-none rounded-t-2xl pb-safe"
          : "fixed",
      )}
      style={!mobile ? { ...(position ?? { top: -9999, left: -9999 }), opacity: positioned ? 1 : 0 } : undefined}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs font-bold uppercase tracking-wide text-app-ink-faint">Icon</span>
        <button
          type="button"
          aria-label="Close icon picker"
          onMouseDown={(e) => { e.preventDefault(); onClose(); }}
          className="flex h-5 w-5 items-center justify-center rounded-md text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Lucide icon grid */}
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-app-ink-faint">Icons</p>
        <div className="grid grid-cols-5 gap-1">
          {LUCIDE_CATEGORY_ICONS.map((def) => (
            <button
              key={def.name}
              type="button"
              aria-label={def.label}
              onMouseDown={(e) => { e.preventDefault(); onSelect(def.name); }}
              className={cn(
                "flex h-9 w-full items-center justify-center rounded-lg text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink",
                currentIcon === def.name && "bg-app-surface-muted text-app-ink ring-1 ring-inset ring-app-line",
              )}
            >
              <def.component className="h-4 w-4" />
            </button>
          ))}
        </div>
      </div>

      {/* Emoji section */}
      <div>
        <p className="mb-1.5 text-[11px] font-medium text-app-ink-faint">Emoji</p>
        <div className="mb-2 grid grid-cols-8 gap-1">
          {QUICK_PICK_EMOJIS.map((emoji) => (
            <button
              key={emoji}
              type="button"
              aria-label={emoji}
              onMouseDown={(e) => { e.preventDefault(); onSelect(emoji); }}
              className={cn(
                "flex h-8 w-full items-center justify-center rounded-lg text-base transition hover:bg-app-surface-hover",
                currentIcon === emoji && "bg-app-surface-muted ring-1 ring-inset ring-app-line",
              )}
            >
              {emoji}
            </button>
          ))}
        </div>
        <div className="relative flex gap-1.5">
          {suggestions.length > 0 && (
            <div className="absolute bottom-full left-0 right-10 mb-1.5 overflow-hidden rounded-lg border border-app-line bg-app-surface shadow-soft">
              {suggestions.map((s, i) => (
                <button
                  key={s.name}
                  type="button"
                  onMouseDown={(e) => { e.preventDefault(); selectSuggestion(s.emoji); }}
                  className={cn(
                    "flex w-full items-center gap-2.5 px-2.5 py-1.5 text-left text-sm transition",
                    i === activeIdx
                      ? "bg-app-surface-muted text-app-ink"
                      : "text-app-ink-muted hover:bg-app-surface-hover hover:text-app-ink",
                  )}
                >
                  <span className="text-base leading-none">{s.emoji}</span>
                  <span className="text-xs">{s.name}</span>
                </button>
              ))}
            </div>
          )}
          <input
            type="text"
            value={emojiInput}
            onChange={(e) => handleEmojiInputChange(e.target.value)}
            onKeyDown={(e) => {
              if (suggestions.length > 0 && e.key === "ArrowDown") {
                e.preventDefault();
                setActiveIdx((i) => Math.min(i + 1, suggestions.length - 1));
                return;
              }
              if (suggestions.length > 0 && e.key === "ArrowUp") {
                e.preventDefault();
                setActiveIdx((i) => Math.max(i - 1, -1));
                return;
              }
              if (e.key === "Enter") {
                e.preventDefault();
                if (activeIdx >= 0 && suggestions[activeIdx]) {
                  selectSuggestion(suggestions[activeIdx].emoji);
                } else {
                  commitEmojiInput();
                }
                return;
              }
              if (e.key === "Escape") { e.preventDefault(); onClose(); }
            }}
            placeholder="Paste emoji or name (e.g. rocket)"
            className="min-w-0 flex-1 rounded-lg border border-app-line bg-app-surface-muted px-2.5 py-1.5 text-sm text-app-ink outline-none placeholder:text-app-ink-faint focus:border-app-line-focus focus:ring-1 focus:ring-app-line-focus"
          />
          <button
            type="button"
            onMouseDown={(e) => { e.preventDefault(); commitEmojiInput(); }}
            disabled={!emojiInput.trim()}
            className="rounded-lg border border-app-line bg-app-surface px-2.5 py-1.5 text-sm text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink disabled:opacity-40"
          >
            Set
          </button>
        </div>
      </div>

      {/* Reset */}
      {currentIcon && (
        <button
          type="button"
          onMouseDown={(e) => { e.preventDefault(); onSelect(undefined); }}
          className="flex w-full items-center justify-center rounded-lg border border-app-line py-1.5 text-xs text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          Reset to default
        </button>
      )}
    </div>
  );

  if (mobile) {
    return createPortal(
      <>
        <div
          aria-hidden="true"
          className="fixed inset-0 z-app-overlay bg-app-canvas/55"
          onMouseDown={() => onClose()}
        />
        {pickerContent}
      </>,
      document.body,
    );
  }

  return createPortal(pickerContent, document.body);
}
