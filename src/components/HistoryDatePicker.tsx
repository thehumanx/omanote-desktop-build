import { useEffect, useMemo, useRef, useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { toDateKey } from "@omanote/shared";
import type { DateKey } from "@omanote/shared";
import { cn } from "./ui";

const WEEKDAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"];

function monthLabel(year: number, month: number): string {
  return new Date(year, month, 1).toLocaleDateString("en-US", { month: "long", year: "numeric" });
}

/** The day cells for one month, padded with nulls so the 1st lands on its real weekday. */
function buildMonthCells(year: number, month: number): (DateKey | null)[] {
  const first = new Date(year, month, 1);
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const cells: (DateKey | null)[] = Array.from({ length: first.getDay() }, () => null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push(toDateKey(new Date(year, month, day)));
  }
  return cells;
}

export type HistoryDatePickerProps = {
  selectedDateKey: DateKey;
  /** Oldest day that has anything — earlier days aren't selectable. */
  minDateKey: DateKey;
  /** Newest day History covers (yesterday — today is the canvas). */
  maxDateKey: DateKey;
  datesWithContent: Set<DateKey>;
  onSelect: (dateKey: DateKey) => void;
  onClose: () => void;
};

/**
 * Month-grid jump-to-a-day picker for the History page — for reaching a date
 * months back without scrolling the day list to it. Days outside the range
 * History covers are disabled; days that have artifacts carry a dot.
 */
export function HistoryDatePicker({
  selectedDateKey,
  minDateKey,
  maxDateKey,
  datesWithContent,
  onSelect,
  onClose,
}: HistoryDatePickerProps) {
  const selected = useMemo(() => new Date(`${selectedDateKey}T12:00:00`), [selectedDateKey]);
  const [viewYear, setViewYear] = useState(selected.getFullYear());
  const [viewMonth, setViewMonth] = useState(selected.getMonth());
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  const cells = useMemo(() => buildMonthCells(viewYear, viewMonth), [viewYear, viewMonth]);
  // A month is reachable if any of its days fall inside [min, max].
  const monthStartKey = toDateKey(new Date(viewYear, viewMonth, 1));
  const monthEndKey = toDateKey(new Date(viewYear, viewMonth + 1, 0));
  const canGoPrev = monthStartKey > minDateKey;
  const canGoNext = monthEndKey < maxDateKey;

  const step = (delta: number) => {
    const next = new Date(viewYear, viewMonth + delta, 1);
    setViewYear(next.getFullYear());
    setViewMonth(next.getMonth());
  };

  return (
    <div
      ref={containerRef}
      role="dialog"
      aria-label="Jump to a day"
      className="w-[19rem] rounded-app-card border border-app-line bg-app-surface p-3 shadow-app-drawer"
    >
      <div className="mb-2 flex items-center justify-between">
        <button
          type="button"
          aria-label="Previous month"
          disabled={!canGoPrev}
          onClick={() => step(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-app-ink-muted transition hover:bg-app-surface-hover disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-app-ink">{monthLabel(viewYear, viewMonth)}</p>
        <button
          type="button"
          aria-label="Next month"
          disabled={!canGoNext}
          onClick={() => step(1)}
          className="flex h-8 w-8 items-center justify-center rounded-full text-app-ink-muted transition hover:bg-app-surface-hover disabled:pointer-events-none disabled:opacity-30"
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 gap-0.5">
        {WEEKDAY_LABELS.map((label, index) => (
          <span key={`${label}-${index}`} className="pb-1 text-center text-[11px] font-medium text-app-ink-faint">
            {label}
          </span>
        ))}
        {cells.map((dateKey, index) => {
          if (!dateKey) return <span key={`pad-${index}`} />;
          const isSelectable = dateKey >= minDateKey && dateKey <= maxDateKey;
          const isSelected = dateKey === selectedDateKey;
          return (
            <button
              key={dateKey}
              type="button"
              disabled={!isSelectable}
              onClick={() => onSelect(dateKey)}
              className={cn(
                "relative flex h-9 items-center justify-center rounded-app-chip text-sm transition",
                isSelected
                  ? "bg-app-ink font-bold text-app-surface"
                  : isSelectable
                    ? "text-app-ink hover:bg-app-surface-hover"
                    : "pointer-events-none text-app-ink-faint opacity-40",
              )}
            >
              {Number(dateKey.slice(8, 10))}
              {datesWithContent.has(dateKey) && !isSelected ? (
                <span aria-hidden="true" className="absolute bottom-1 h-1 w-1 rounded-full bg-app-ink-faint" />
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );
}
