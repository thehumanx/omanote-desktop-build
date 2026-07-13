import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { findActiveEmojiTrigger } from "../lib/emoji-trigger";
import { searchEmoji, quickPickEmojiSuggestions } from "../lib/bookmark-category-icon";

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export interface EmojiSuggestion {
  emoji: string;
  name: string;
}

export interface EmojiPickerState {
  isOpen: boolean;
  suggestions: EmojiSuggestion[];
  activeIndex: number;
  handleKeyDown: (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>) => boolean;
  selectSuggestion: (emoji: string) => void;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useEmojiPicker({
  value,
  textareaRef,
  onChange,
}: {
  value: string;
  textareaRef: { current: HTMLTextAreaElement | HTMLInputElement | null };
  onChange: (next: string) => void;
}): EmojiPickerState {
  const [cursorPos, setCursorPos] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);

  // Sync cursor on value change
  useEffect(() => {
    setCursorPos(textareaRef.current?.selectionStart ?? 0);
  }, [value, textareaRef]);

  // Also track cursor on every selection change (arrow keys, mouse clicks, etc.)
  // so the picker closes immediately when the cursor moves off an emoji token.
  useEffect(() => {
    const handleSelectionChange = () => {
      if (textareaRef.current && document.activeElement === textareaRef.current) {
        setCursorPos(textareaRef.current.selectionStart ?? 0);
      }
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => document.removeEventListener("selectionchange", handleSelectionChange);
  }, [textareaRef]);

  const active = useMemo(() => findActiveEmojiTrigger(value, cursorPos), [value, cursorPos]);
  const prefix = active?.partial ?? "";

  const suggestions = useMemo(() => {
    if (!active) return [];
    return prefix ? searchEmoji(prefix) : quickPickEmojiSuggestions();
  }, [active, prefix]);

  useEffect(() => { setActiveIndex(0); }, [prefix]);

  const selectSuggestion = useCallback(
    (emoji: string) => {
      if (!active) return;
      const before = value.slice(0, active.start);
      const after  = value.slice(active.start + 1 + active.partial.length);
      onChange(`${before}${emoji} ${after}`);
      const newCursor = active.start + emoji.length + 1;
      window.requestAnimationFrame(() => {
        if (textareaRef.current) {
          textareaRef.current.setSelectionRange(newCursor, newCursor);
          textareaRef.current.focus();
        }
      });
    },
    [active, value, onChange, textareaRef],
  );

  const handleKeyDown = useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement | HTMLInputElement>): boolean => {
      if (!active || suggestions.length === 0) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const selected = suggestions[activeIndex];
        if (selected) { event.preventDefault(); selectSuggestion(selected.emoji); return true; }
      }
      return false;
    },
    [active, suggestions, activeIndex, selectSuggestion],
  );

  return { isOpen: active !== null, suggestions, activeIndex, handleKeyDown, selectSuggestion, setActiveIndex };
}

// ---------------------------------------------------------------------------
// Dropdown — rendered via portal so it escapes any stacking context
// ---------------------------------------------------------------------------

export function EmojiPickerDropdown({
  isOpen,
  suggestions,
  activeIndex,
  onSelect,
  onHover,
  anchorRef,
  anchorRect,
}: {
  isOpen: boolean;
  suggestions: EmojiSuggestion[];
  activeIndex: number;
  onSelect: (emoji: string) => void;
  onHover: (index: number) => void;
  /** The element the picker is attached to — used to calculate portal position. */
  anchorRef: React.RefObject<HTMLElement | null>;
  /** Optional caret/token rect for precise anchoring near current typing position. */
  anchorRect?: { left: number; right: number; top: number; bottom: number } | null;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

  // Position the portal near the caret/token rect when available, otherwise
  // fall back to the full anchor element.
  useLayoutEffect(() => {
    if (!isOpen) { setPos(null); return; }

    const update = () => {
      const fallbackRect = anchorRef.current?.getBoundingClientRect();
      const sourceRect = anchorRect ?? (fallbackRect ? {
        left: fallbackRect.left,
        right: fallbackRect.right,
        top: fallbackRect.top,
        bottom: fallbackRect.bottom,
      } : null);
      if (!sourceRect) return;

      const margin = 8;
      const offset = 6;
      const panelWidth = 208; // w-52
      const panelHeight = listRef.current?.getBoundingClientRect().height ?? 220;
      const availableBelow = window.innerHeight - sourceRect.bottom - margin;
      const availableAbove = sourceRect.top - margin;

      const placeAbove = panelHeight > availableBelow && availableAbove > availableBelow;
      const top = placeAbove
        ? Math.max(margin, sourceRect.top - panelHeight - offset)
        : Math.min(window.innerHeight - panelHeight - margin, sourceRect.bottom + offset);

      const preferredLeft = sourceRect.left;
      const minLeft = margin;
      const maxLeft = window.innerWidth - panelWidth - margin;
      const left = Math.max(minLeft, Math.min(preferredLeft, maxLeft));

      setPos({ top, left });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, anchorRef, anchorRect, suggestions.length, activeIndex]);

  // Scroll active item into view
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLButtonElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!isOpen || !pos || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={listRef}
      data-omanote-ignore-outside-click="true"
      className="fixed z-app-popover w-52 overflow-hidden rounded-2xl border border-app-line bg-app-surface shadow-app-menu"
      style={pos}
    >
      <div className="max-h-64 overflow-y-auto p-1">
        {suggestions.length === 0 ? (
          <p className="px-3 py-2 text-xs text-app-ink-faint">No matching emoji</p>
        ) : (
          suggestions.map((suggestion, index) => (
            <button
              key={suggestion.emoji}
              type="button"
              data-active={index === activeIndex ? "true" : undefined}
              onMouseEnter={() => onHover(index)}
              onMouseDown={(e) => { e.preventDefault(); onSelect(suggestion.emoji); }}
              className={[
                "flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-sm transition",
                index === activeIndex ? "bg-app-surface-muted" : "hover:bg-app-surface-hover",
              ].join(" ")}
            >
              <span className="text-lg leading-none">{suggestion.emoji}</span>
              <span className="truncate capitalize text-app-ink-faint">{suggestion.name || suggestion.emoji}</span>
            </button>
          ))
        )}
      </div>
    </div>,
    document.body,
  );
}
