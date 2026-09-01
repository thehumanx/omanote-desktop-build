import { useCallback, useEffect, useRef, type KeyboardEvent } from "react";
import { ChevronRight } from "lucide-react";
import type { DateKey } from "@omanote/shared";
import { cn } from "./ui";

const ROW_HEIGHT = 36;
const FADE_SIZE = 56;
// Fades rows out near the top/bottom edge instead of hard-clipping them.
const FADE_MASK = `linear-gradient(to bottom, transparent, black ${FADE_SIZE}px, black calc(100% - ${FADE_SIZE}px), transparent)`;

function formatRowLabel(dateKey: DateKey, todayKey: DateKey): string {
  if (dateKey === todayKey) return "Today";
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export type HistoryDateStripProps = {
  /** Newest first. */
  dateKeys: DateKey[];
  datesWithContent: Set<DateKey>;
  todayKey: DateKey;
  selectedDateKey: DateKey;
  onSelectDateKey: (dateKey: DateKey) => void;
  /**
   * "rail" (desktop) is a narrow column beside the day's content, marking the
   * selected row with "▸". "list" (mobile) is the whole screen — nothing is
   * "selected" there, each row is a folder-style entry you drill into, so it
   * gets a chevron instead.
   */
  variant?: "rail" | "list";
};

/**
 * The History page's day list: every past day, newest first, in its own
 * scroller that fills the page height and fades out at both edges. Selection
 * is by click (or arrow keys) only — scrolling just scrolls, it doesn't
 * change the day, so browsing the list never churns the content pane.
 */
export function HistoryDateStrip({
  dateKeys,
  datesWithContent,
  todayKey,
  selectedDateKey,
  onSelectDateKey,
  variant = "rail",
}: HistoryDateStripProps) {
  const isList = variant === "list";
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // Bring the initially selected day into view once, without animating — a
  // layout correction, not a navigation. Later selections are user-driven
  // clicks on rows that are already on screen.
  const hasCenteredRef = useRef(false);
  useEffect(() => {
    if (hasCenteredRef.current) return;
    const row = rowRefs.current[selectedDateKey];
    if (!row) return;
    hasCenteredRef.current = true;
    row.scrollIntoView({ block: "center", behavior: "instant" });
  }, [selectedDateKey]);

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const index = dateKeys.indexOf(selectedDateKey);
      if (index === -1) return;
      const nextIndex = event.key === "ArrowDown" ? index + 1 : event.key === "ArrowUp" ? index - 1 : -1;
      const nextKey = dateKeys[nextIndex];
      if (!nextKey) return;
      event.preventDefault();
      onSelectDateKey(nextKey);
      rowRefs.current[nextKey]?.scrollIntoView({ block: "nearest" });
    },
    [dateKeys, onSelectDateKey, selectedDateKey],
  );

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Choose a day"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className={cn(
        "h-full shrink-0 overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        isList ? "w-full" : "w-28 md:w-44",
      )}
      style={{ maskImage: FADE_MASK, WebkitMaskImage: FADE_MASK }}
    >
      <div className="py-6">
        {dateKeys.map((dateKey) => {
          const isSelected = !isList && dateKey === selectedDateKey;
          return (
            <button
              key={dateKey}
              ref={(node) => {
                rowRefs.current[dateKey] = node;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => onSelectDateKey(dateKey)}
              style={{ height: ROW_HEIGHT, contentVisibility: "auto", containIntrinsicSize: `auto ${ROW_HEIGHT}px` }}
              className={cn(
                "flex w-full items-center gap-1 whitespace-nowrap text-left text-sm transition-colors duration-150 md:gap-1.5",
                isList ? "gap-2 px-1" : "px-1.5 md:px-3",
                isSelected ? "font-bold text-app-ink" : isList ? "text-app-ink" : "text-app-ink-faint hover:text-app-ink-muted",
              )}
            >
              <span aria-hidden="true" className="flex w-2 shrink-0 items-center justify-center md:w-2.5">
                {datesWithContent.has(dateKey) ? <span className="h-1.5 w-1.5 rounded-full bg-app-ink-faint" /> : null}
              </span>
              <span className="min-w-0 flex-1 truncate">{formatRowLabel(dateKey, todayKey)}</span>
              <span aria-hidden="true" className="ml-auto shrink-0 text-right text-app-ink-faint">
                {isList ? <ChevronRight className="h-4 w-4" /> : isSelected ? "▸" : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
