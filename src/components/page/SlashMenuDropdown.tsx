import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import type { SlashCommand } from "../../lib/tiptap-slash-menu";

const PANEL_WIDTH = 224; // w-56

/**
 * The "/" block menu. Positioning mirrors HashtagPickerDropdown — portal to
 * the body, anchor on the caret rect, flip above the caret when there isn't
 * room below — so the three in-editor pickers behave identically.
 */
export function SlashMenuDropdown({
  isOpen,
  commands,
  activeIndex,
  onSelect,
  onHover,
  anchorRef,
  anchorRect,
}: {
  isOpen: boolean;
  commands: SlashCommand[];
  activeIndex: number;
  onSelect: (command: SlashCommand) => void;
  onHover: (index: number) => void;
  anchorRef: React.RefObject<HTMLElement | null>;
  anchorRect?: { left: number; right: number; top: number; bottom: number } | null;
}) {
  const listRef = useRef<HTMLDivElement | null>(null);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);

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
      const panelHeight = listRef.current?.getBoundingClientRect().height ?? 260;
      const availableBelow = window.innerHeight - sourceRect.bottom - margin;
      const availableAbove = sourceRect.top - margin;

      const placeAbove = panelHeight > availableBelow && availableAbove > availableBelow;
      const top = placeAbove
        ? Math.max(margin, sourceRect.top - panelHeight - offset)
        : Math.min(window.innerHeight - panelHeight - margin, sourceRect.bottom + offset);

      const left = Math.max(margin, Math.min(sourceRect.left, window.innerWidth - PANEL_WIDTH - margin));
      setPos({ top, left });
    };

    update();
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", update);
    return () => {
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", update);
    };
  }, [isOpen, anchorRef, anchorRect, commands.length, activeIndex]);

  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLButtonElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  if (!isOpen || !pos || commands.length === 0 || typeof document === "undefined") return null;

  return createPortal(
    <div
      ref={listRef}
      data-omanote-ignore-outside-click="true"
      className="fixed z-app-popover max-h-72 w-56 overflow-y-auto rounded-2xl border border-app-line bg-app-surface shadow-app-soft"
      style={pos}
    >
      <div className="p-1">
        {commands.map((command, index) => (
          <button
            key={command.id}
            type="button"
            data-active={index === activeIndex ? "true" : undefined}
            onMouseEnter={() => onHover(index)}
            // The editor keeps focus, so the caret position the command acts on
            // is still valid when the click lands.
            onMouseDown={(event) => event.preventDefault()}
            onClick={() => onSelect(command)}
            className={[
              "flex w-full items-center justify-between gap-3 rounded-xl px-3 py-2 text-left text-sm transition",
              index === activeIndex ? "bg-app-surface-hover text-app-ink" : "text-app-ink-muted hover:bg-app-surface-hover",
            ].join(" ")}
          >
            <span className="truncate">{command.label}</span>
            <span className="shrink-0 font-mono text-[11px] text-app-ink-faint">{command.hint}</span>
          </button>
        ))}
      </div>
    </div>,
    document.body,
  );
}
