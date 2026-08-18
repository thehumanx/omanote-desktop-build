import { useCallback, useEffect, useLayoutEffect, useRef, useState, type KeyboardEvent, type WheelEvent as ReactWheelEvent } from "react";
import type { DateKey } from "@omanote/shared";
import { cn } from "./ui";
import { playWheelTick } from "../lib/wheel-tick-sound";

const DEFAULT_WHEEL_HEIGHT = 240;
const ROW_HEIGHT = 36;
const FADE_SIZE = 56;
// Fades rows out near the top/bottom edge of the wheel instead of hard-clipping them.
const FADE_MASK = `linear-gradient(to bottom, transparent, black ${FADE_SIZE}px, black calc(100% - ${FADE_SIZE}px), transparent)`;
// How much accumulated wheel delta it takes to step one row — the "friction"
// that keeps a single scroll gesture from flying past many days at once.
const WHEEL_STEP_THRESHOLD = 60;

function formatRowLabel(dateKey: DateKey, todayKey: DateKey): string {
  if (dateKey === todayKey) return "Today";
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}

export type CanvasHistoryDateWheelProps = {
  dateKeys: DateKey[];
  datesWithContent: Set<DateKey>;
  todayKey: DateKey;
  selectedDateKey: DateKey;
  onSelectDateKey: (dateKey: DateKey) => void;
  /** Fired when a row is explicitly clicked/tapped, as opposed to becoming centered by scroll — used on mobile to open that day's content. */
  onActivateDateKey?: (dateKey: DateKey) => void;
  /** Fixed pixel height (the desktop side-column default). Omit to have the wheel stretch to fill its parent's height instead — the parent must have a definite height for this to work. */
  height?: number;
  /** Overrides the default `w-16 md:w-40` column width — e.g. full width when the wheel is the only thing on screen (mobile History). */
  widthClassName?: string;
  /** "start" (default) left-aligns each row's label with the marker pushed to the far right — fits a narrow shared column beside a content pane. "center" clusters the dot/label/marker together in the middle of the row — for a full-width, content-less wheel. */
  contentAlign?: "start" | "center";
};

/**
 * A vertically scrolling, scroll-snapping date picker — dates on the left,
 * fixed compact height, edges fading via a mask instead of clipping. Only
 * the centered/selected row renders in full ink with a "▸" marker; the rest
 * stay faded. A small dot marks days that have content, independent of
 * selection. Wheel/trackpad scrolling is dampened to one row per step, with
 * a soft tick sound on each step.
 */
export function CanvasHistoryDateWheel({
  dateKeys,
  datesWithContent,
  todayKey,
  selectedDateKey,
  onSelectDateKey,
  onActivateDateKey,
  height: fixedHeight,
  widthClassName = "w-16 md:w-40",
  contentAlign = "start",
}: CanvasHistoryDateWheelProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const rowRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  // When no fixed height is given, the wheel fills its parent via CSS
  // (`h-full`) and we measure the resulting pixel height ourselves — the
  // vertical-centering padding below needs an actual number, CSS alone can't
  // express "half of my own height." `null` (rather than a default guess)
  // until the first real ResizeObserver reading lands, so callers below can
  // tell "not measured yet" apart from "genuinely this short."
  const [measuredHeight, setMeasuredHeight] = useState<number | null>(null);
  useEffect(() => {
    if (fixedHeight !== undefined) return;
    const container = listRef.current;
    if (!container) return;
    const observer = new ResizeObserver((entries) => {
      const next = entries[0]?.contentRect.height;
      if (next) setMeasuredHeight(next);
    });
    observer.observe(container);
    return () => observer.disconnect();
  }, [fixedHeight]);

  const isHeightReady = fixedHeight !== undefined || measuredHeight !== null;
  const height = fixedHeight ?? measuredHeight ?? DEFAULT_WHEEL_HEIGHT;

  // Once the wheel has a real (measured) height, jump the initially-selected
  // date's row to center in one shot — no animation, since this is a layout
  // correction, not a user-driven navigation. This runs exactly once per
  // mount: without it, the wheel used to fall back to whatever row landed
  // near center at scrollTop 0 using the placeholder height, and the
  // scroll-tracking effect below would report that (wrong) row as selected;
  // then the real height would arrive, the centering padding would recompute,
  // and the list would visibly jump.
  //
  // `useLayoutEffect` (not `useEffect`) so the scroll happens before the
  // browser paints the frame where the real height first lands — otherwise
  // there's still a visible flash of the wrongly-positioned list for that
  // one frame. `isReady` gates the list's visibility (below) so the very
  // first paint — with the still-wrong placeholder padding — never renders
  // at all; the list only becomes visible already centered.
  const hasCenteredInitialSelectionRef = useRef(false);
  const [isReady, setIsReady] = useState(false);
  useLayoutEffect(() => {
    if (hasCenteredInitialSelectionRef.current || !isHeightReady) return;
    const row = rowRefs.current[selectedDateKey];
    if (!row) return;
    hasCenteredInitialSelectionRef.current = true;
    row.scrollIntoView({ block: "center", behavior: "instant" });
    setIsReady(true);
  }, [isHeightReady, selectedDateKey]);

  // Tracks which row is nearest the wheel's vertical center as it scrolls,
  // similar to a native mobile date-wheel picker. Only reacts to actual
  // scroll events — it used to also run once eagerly on mount, but at that
  // point the container's height (and therefore the centering padding) was
  // still the placeholder value above, so it could report the wrong row as
  // selected before the real height arrived.
  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    let frame: number | null = null;

    const update = () => {
      frame = null;
      const containerRect = container.getBoundingClientRect();
      const centerY = containerRect.top + containerRect.height / 2;
      let closestKey: DateKey | null = null;
      let closestDistance = Infinity;

      for (const key of dateKeys) {
        const row = rowRefs.current[key];
        if (!row) continue;
        const rect = row.getBoundingClientRect();
        const distance = Math.abs(rect.top + rect.height / 2 - centerY);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestKey = key;
        }
      }

      if (closestKey) onSelectDateKey(closestKey);
    };

    const onScroll = () => {
      if (frame !== null) return;
      frame = window.requestAnimationFrame(update);
    };

    container.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      container.removeEventListener("scroll", onScroll);
      if (frame !== null) window.cancelAnimationFrame(frame);
    };
  }, [dateKeys, onSelectDateKey]);

  // Plays a tick whenever the selected day actually changes (not on every
  // scroll frame — this effect only re-fires when the value itself moves).
  const isFirstRenderRef = useRef(true);
  useEffect(() => {
    if (isFirstRenderRef.current) {
      isFirstRenderRef.current = false;
      return;
    }
    playWheelTick();
  }, [selectedDateKey]);

  const selectRow = useCallback((dateKey: DateKey, behavior: ScrollBehavior = "smooth") => {
    rowRefs.current[dateKey]?.scrollIntoView({ block: "center", behavior });
  }, []);

  // Kept in sync with the (possibly async) selectedDateKey prop, so the
  // wheel-event stepper below always steps from the true current row
  // instead of a value captured at handler-creation time.
  const selectedIndexRef = useRef(dateKeys.indexOf(selectedDateKey));
  useEffect(() => {
    selectedIndexRef.current = dateKeys.indexOf(selectedDateKey);
  }, [dateKeys, selectedDateKey]);

  const wheelDeltaRef = useRef(0);
  const handleWheel = useCallback(
    (event: ReactWheelEvent<HTMLDivElement>) => {
      event.preventDefault();
      wheelDeltaRef.current += event.deltaY;
      while (Math.abs(wheelDeltaRef.current) >= WHEEL_STEP_THRESHOLD) {
        const direction = wheelDeltaRef.current > 0 ? 1 : -1;
        const nextIndex = selectedIndexRef.current + direction;
        wheelDeltaRef.current -= direction * WHEEL_STEP_THRESHOLD;
        if (nextIndex < 0 || nextIndex >= dateKeys.length) continue;
        selectedIndexRef.current = nextIndex;
        selectRow(dateKeys[nextIndex]!);
      }
    },
    [dateKeys, selectRow],
  );

  const handleKeyDown = useCallback(
    (event: KeyboardEvent<HTMLDivElement>) => {
      const index = dateKeys.indexOf(selectedDateKey);
      if (index === -1) return;
      if (event.key === "ArrowDown" && index < dateKeys.length - 1) {
        event.preventDefault();
        selectRow(dateKeys[index + 1]!);
      } else if (event.key === "ArrowUp" && index > 0) {
        event.preventDefault();
        selectRow(dateKeys[index - 1]!);
      }
    },
    [dateKeys, selectedDateKey, selectRow],
  );

  const halfHeightPadding = Math.max(height / 2 - ROW_HEIGHT / 2, 0);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Choose a day"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      onWheel={handleWheel}
      className={cn(
        "overflow-y-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        widthClassName,
        fixedHeight === undefined && "h-full",
      )}
      style={{
        height: fixedHeight,
        scrollSnapType: "y mandatory",
        maskImage: FADE_MASK,
        WebkitMaskImage: FADE_MASK,
        // Stays invisible (but still laid out/measurable/scrollable) until
        // the initial centering above has run, so the wrongly-positioned
        // placeholder-height layout is never actually shown.
        visibility: isReady ? "visible" : "hidden",
      }}
    >
      <div style={{ paddingTop: halfHeightPadding, paddingBottom: halfHeightPadding }}>
        {dateKeys.map((dateKey) => {
          const hasContent = datesWithContent.has(dateKey);
          const isSelected = dateKey === selectedDateKey;
          return (
            <button
              key={dateKey}
              ref={(node) => {
                rowRefs.current[dateKey] = node;
              }}
              type="button"
              role="option"
              aria-selected={isSelected}
              onClick={() => {
                // Activating a row (mobile: opens the drawer for that date)
                // must land on the target immediately — a smooth scroll here
                // would keep the scroll-tracking effect above reporting
                // whatever row is passing through center as "selected" for
                // the animation's duration, flickering the drawer's content
                // through each intermediate date before settling. Note:
                // "auto" would NOT do this — the container has CSS
                // `scroll-behavior: smooth` (the `scroll-smooth` class
                // below), and per spec `behavior: "auto"` defers to that
                // CSS value rather than overriding it. Only "instant"
                // actually bypasses it.
                selectRow(dateKey, onActivateDateKey ? "instant" : "smooth");
                onActivateDateKey?.(dateKey);
              }}
              style={{ height: ROW_HEIGHT, scrollSnapAlign: "center", scrollSnapStop: "always", contentVisibility: "auto" }}
              className={cn(
                "flex w-full items-center gap-1 whitespace-nowrap px-1.5 text-sm transition-colors duration-150 md:gap-1.5 md:px-3",
                contentAlign === "center" ? "justify-center text-center" : "text-left",
                isSelected ? "font-bold text-app-ink" : "text-app-ink-faint",
              )}
            >
              <span aria-hidden="true" className="flex w-2 shrink-0 items-center justify-center md:w-2.5">
                {hasContent ? <span className="h-1.5 w-1.5 rounded-full bg-app-ink-faint" /> : null}
              </span>
              <span className={cn("truncate", contentAlign === "center" ? "flex-none" : "min-w-0 flex-1")}>
                {formatRowLabel(dateKey, todayKey)}
              </span>
              <span
                aria-hidden="true"
                className={cn("w-2 shrink-0 text-right md:w-3", contentAlign === "center" ? "" : "ml-auto")}
              >
                {isSelected ? "▸" : null}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
