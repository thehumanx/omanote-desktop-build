import { useEffect, useRef, useState } from "react";
import { CalendarDays, Search, X } from "lucide-react";
import type { DateKey } from "@omanote/shared";
import { HistoryDatePicker } from "./HistoryDatePicker";
import { Input, SegmentedPill, Switch } from "./ui";

function formatDateFilterLabel(dateKey: DateKey, todayKey: DateKey): string {
  if (dateKey === todayKey) return "Today";
  const date = new Date(`${dateKey}T12:00:00`);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export type HistoryFilterBarProps = {
  query: string;
  onQueryChange: (query: string) => void;
  pagesOnly: boolean;
  onPagesOnlyChange: (pagesOnly: boolean) => void;
  hideEmptyDays: boolean;
  onHideEmptyDaysChange: (hideEmptyDays: boolean) => void;
  dateFilterKey: DateKey | null;
  onSelectDateFilter: (dateKey: DateKey | null) => void;
  todayKey: DateKey;
  minDateKey: DateKey;
  maxDateKey: DateKey;
  datesWithContent: Set<DateKey>;
};

/**
 * The History page's filter row: search, jump-to-a-date, and the
 * all/pages-only + hide-empty-days toggles. Replaces the old floating
 * "jump to a date" button (removed from both mobile and desktop) now that
 * there's a dedicated row for it.
 */
export function HistoryFilterBar({
  query,
  onQueryChange,
  pagesOnly,
  onPagesOnlyChange,
  hideEmptyDays,
  onHideEmptyDaysChange,
  dateFilterKey,
  onSelectDateFilter,
  todayKey,
  minDateKey,
  maxDateKey,
  datesWithContent,
}: HistoryFilterBarProps) {
  const [pickerOpen, setPickerOpen] = useState(false);
  const pickerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!pickerOpen) return;
    const onPointerDown = (event: PointerEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) setPickerOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown);
    return () => window.removeEventListener("pointerdown", onPointerDown);
  }, [pickerOpen]);

  return (
    <div className="flex flex-col gap-2.5 border-b border-app-line pb-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-3">
      <div className="relative min-w-0 flex-1 sm:max-w-xs">
        <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-app-ink-faint" />
        <Input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search history"
          aria-label="Search history"
          className="pl-8 pr-8"
        />
        {query ? (
          <button
            type="button"
            aria-label="Clear search"
            onClick={() => onQueryChange("")}
            className="absolute right-2 top-1/2 flex h-5 w-5 -translate-y-1/2 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      <div className="relative shrink-0" ref={pickerRef}>
        <button
          type="button"
          aria-expanded={pickerOpen}
          onClick={() => setPickerOpen((open) => !open)}
          className="flex h-9 items-center gap-1.5 rounded-app-chip border border-app-line bg-app-surface px-3 text-sm font-medium text-app-ink-muted transition hover:bg-app-surface-hover hover:text-app-ink"
        >
          <CalendarDays className="h-4 w-4" />
          {dateFilterKey ? formatDateFilterLabel(dateFilterKey, todayKey) : "All dates"}
          {dateFilterKey ? (
            <span
              role="button"
              tabIndex={0}
              aria-label="Clear date filter"
              onClick={(event) => {
                event.stopPropagation();
                onSelectDateFilter(null);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter" && event.key !== " ") return;
                event.preventDefault();
                event.stopPropagation();
                onSelectDateFilter(null);
              }}
              className="-mr-1 flex h-4 w-4 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
            >
              <X className="h-3 w-3" />
            </span>
          ) : null}
        </button>
        {pickerOpen ? (
          <div className="absolute left-0 top-full z-app-overlay mt-2">
            <HistoryDatePicker
              selectedDateKey={dateFilterKey ?? maxDateKey}
              minDateKey={minDateKey}
              maxDateKey={maxDateKey}
              datesWithContent={datesWithContent}
              onSelect={(dateKey) => {
                onSelectDateFilter(dateKey);
                setPickerOpen(false);
              }}
              onClose={() => setPickerOpen(false)}
            />
          </div>
        ) : null}
      </div>

      <SegmentedPill
        ariaLabel="Show all history or canvas pages only"
        activeKey={pagesOnly ? "pages" : "all"}
        onChange={(key) => onPagesOnlyChange(key === "pages")}
        items={[
          { key: "all", label: "All" },
          { key: "pages", label: "Pages only" },
        ]}
      />

      <label className="flex shrink-0 items-center gap-2 text-sm text-app-ink-muted">
        Hide empty days
        <Switch checked={hideEmptyDays} onCheckedChange={onHideEmptyDaysChange} />
      </label>
    </div>
  );
}
