import { ChevronLeft, ChevronRight, ArrowRight } from "lucide-react";
import { addDays, toDateKey } from "@omanote/shared";
import { useEffect, useMemo, useRef, useState, type TouchEvent } from "react";
import { createPortal } from "react-dom";
import { DayPicker } from "react-day-picker";
import { useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { useAuth } from "../../app/auth/AuthContext";
import { useLocalDashboardStat } from "../../app/insights-local";
import { getGreetingForDate } from "./greetings";
import { cn } from "../ui";

export type PageStat =
  | "completion_rate"
  | "todos_done_today"
  | "habit_streak"
  | "notes_this_week"
  | "bookmarks_this_week"
  | "todos_done_this_week"
  | "events_this_week"
  | "canvas_streak";

interface PageHeaderProps {
  showDateNav?: boolean;
  stat: PageStat;
}

function formatDateLabel(date: Date, today: Date): string {
  const isToday = toDateKey(date) === toDateKey(today);
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  if (isToday) return `Today · ${month} ${day}`;
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  return `${weekday} · ${month} ${day}`;
}

function formatShortDateLabel(date: Date): string {
  const month = date.toLocaleDateString("en-US", { month: "short" });
  const day = date.toLocaleDateString("en-US", { day: "numeric" });
  return `${month} ${day}`;
}

function dateKeyToLocalDate(dateKey: string): Date {
  const [year, month, day] = dateKey.split("-").map(Number);
  return new Date(year!, month! - 1, day!);
}

function earliestDateKeyFromState(state: ReturnType<typeof useApp>["state"], fallbackDateKey: string): string {
  const keys = [
    ...state.todos.map((todo) => todo.createdDateKey),
    ...state.notes.map((note) => note.createdDateKey),
    ...state.deletedNotes.map((note) => note.createdDateKey),
    ...state.bookmarks.map((bookmark) => bookmark.createdDateKey),
    ...state.deletedBookmarks.map((bookmark) => bookmark.createdDateKey),
    ...state.events.map((event) => event.createdDateKey),
  ].filter(Boolean);

  if (!keys.length) return fallbackDateKey;
  return keys.reduce((earliest, key) => (key < earliest ? key : earliest), keys[0]!);
}

export function PageHeader({ showDateNav = false, stat }: PageHeaderProps) {
  const { state, dispatch } = useApp();
  const { user } = useAuth();
  const navigate = useNavigate();
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);
  const [datePickerOpen, setDatePickerOpen] = useState(false);
  const [datePickerHeight, setDatePickerHeight] = useState<number | null>(null);
  const datePickerRef = useRef<HTMLDivElement | null>(null);
  const datePickerContentRef = useRef<HTMLDivElement | null>(null);
  const touchStartRef = useRef<{ x: number; y: number } | null>(null);

  const firstName = useMemo(() => {
    const name = user?.name?.trim();
    if (!name) return "there";
    return name.split(" ")[0]!;
  }, [user?.name]);

  const greeting = getGreetingForDate(new Date(), firstName);
  const { full: greetingFull, short: greetingShort } = greeting;

  const selectedDate = useMemo(() => {
    return dateKeyToLocalDate(state.ui.selectedDateKey);
  }, [state.ui.selectedDateKey]);

  const statLabel = useLocalDashboardStat(stat);
  const minDateKey = useMemo(() => earliestDateKeyFromState(state, todayKey), [state, todayKey]);
  const minDate = useMemo(() => dateKeyToLocalDate(minDateKey), [minDateKey]);
  const maxDate = useMemo(() => dateKeyToLocalDate(todayKey), [todayKey]);
  const canGoPrev = state.ui.selectedDateKey > minDateKey;
  const canGoNext = state.ui.selectedDateKey < todayKey;

  function goToPrev() {
    if (!canGoPrev) return;
    dispatch({ type: "ui/set-selected-date", dateKey: toDateKey(addDays(selectedDate, -1)) });
  }

  function goToNext() {
    if (!canGoNext) return;
    dispatch({ type: "ui/set-selected-date", dateKey: toDateKey(addDays(selectedDate, 1)) });
  }

  useEffect(() => {
    if (!datePickerOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      if (datePickerRef.current?.contains(event.target as Node)) return;
      setDatePickerOpen(false);
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setDatePickerOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [datePickerOpen]);

  useEffect(() => {
    if (!datePickerOpen) {
      setDatePickerHeight(null);
      return;
    }
    const content = datePickerContentRef.current;
    if (!content || typeof ResizeObserver === "undefined") return;

    const measure = () => {
      setDatePickerHeight(content.getBoundingClientRect().height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(content);
    return () => observer.disconnect();
  }, [datePickerOpen, state.ui.selectedDateKey]);

  const handleTouchStart = (event: TouchEvent<HTMLDivElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    touchStartRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchEnd = (event: TouchEvent<HTMLDivElement>) => {
    const start = touchStartRef.current;
    touchStartRef.current = null;
    if (!start) return;
    const touch = event.changedTouches[0];
    if (!touch) return;
    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 48 || Math.abs(deltaX) <= Math.abs(deltaY)) return;
    if (deltaX < 0 && canGoNext) goToNext();
    else if (deltaX > 0 && canGoPrev) goToPrev();
  };

  const dateLabel = formatDateLabel(selectedDate, today);
  const shortDateLabel = toDateKey(selectedDate) === toDateKey(today) ? "Today" : formatShortDateLabel(selectedDate);
  const dateButtonClassName = "min-w-0 truncate rounded-full px-2 py-1 text-sm font-bold text-app-ink transition hover:bg-app-surface-hover active:scale-95";
  const disabledDateNavClassName = "disabled:pointer-events-none disabled:opacity-35";
  const datePicker = datePickerOpen && typeof document !== "undefined"
    ? createPortal(
        <div
          ref={datePickerRef}
          role="dialog"
          aria-label="Choose canvas date"
          className="fixed left-1/2 top-1/2 z-app-popover w-[18rem] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-xl border border-app-line bg-app-surface shadow-app-menu transition-[height] duration-app-base ease-app-in-out md:top-[calc(var(--omanote-top-chrome-height,58px)+0.5rem)] md:-translate-y-0"
          style={datePickerHeight ? { height: `${datePickerHeight}px` } : undefined}
        >
          <div ref={datePickerContentRef} className="p-3">
            <DayPicker
              mode="single"
              selected={selectedDate}
              defaultMonth={selectedDate}
              startMonth={minDate}
              endMonth={maxDate}
              disabled={[{ before: minDate }, { after: maxDate }]}
              onSelect={(date) => {
                if (!date) return;
                const nextDateKey = toDateKey(date);
                if (nextDateKey < minDateKey || nextDateKey > todayKey) return;
                dispatch({ type: "ui/set-selected-date", dateKey: nextDateKey });
                setDatePickerOpen(false);
              }}
              classNames={{
                root: "w-full text-app-ink",
                months: "flex flex-col",
                month: "space-y-3",
                month_caption: "flex h-8 items-center justify-center",
                caption_label: "text-sm font-bold text-app-ink",
                nav: "absolute left-3 right-3 top-3 flex items-center justify-between",
                button_previous: "flex h-8 w-8 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink aria-disabled:pointer-events-none aria-disabled:text-app-line-strong aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-app-line-strong",
                button_next: "flex h-8 w-8 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink aria-disabled:pointer-events-none aria-disabled:text-app-line-strong aria-disabled:opacity-40 aria-disabled:hover:bg-transparent aria-disabled:hover:text-app-line-strong",
                chevron: "h-4 w-4 fill-current",
                month_grid: "w-full border-collapse",
                weekdays: "grid grid-cols-7",
                weekday: "pb-1 text-center text-[11px] font-bold uppercase text-app-ink-faint",
                weeks: "grid gap-1",
                week: "grid grid-cols-7 gap-1",
                day: "flex h-8 w-8 items-center justify-center rounded-full text-sm",
                day_button: "flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-app-surface-hover",
              }}
              modifiersClassNames={{
                selected: "bg-action-primary text-action-primary-ink font-bold hover:bg-action-primary",
                today: "ring-1 ring-app-line-strong",
                disabled: "text-app-line-strong opacity-35",
                outside: "text-app-line-strong",
              }}
            />
          </div>
        </div>,
        document.body,
      )
    : null;

  return (
    <>
    <div
      className="grid h-full w-full grid-cols-[1fr_auto_1fr] items-center gap-3"
      onTouchStart={showDateNav ? handleTouchStart : undefined}
      onTouchEnd={showDateNav ? handleTouchEnd : undefined}
    >
      {/* Greeting — left column */}
      <button
        type="button"
        aria-label="Go to today's canvas"
        onClick={() => {
          dispatch({ type: "ui/set-selected-date", dateKey: toDateKey(today) });
          navigate("/canvas");
        }}
        className="min-w-0 truncate text-sm text-app-ink-muted text-left transition-colors duration-150 hover:text-app-ink active:scale-95"
      >
        <span className="md:hidden">{greetingShort}</span>
        <span className="hidden md:inline">{greetingFull}</span>
      </button>

      {/* Center slot — date nav for canvas, empty otherwise */}
      {showDateNav ? (
        <div className="relative flex justify-center">
          {/* Mobile: just the date, no arrows */}
          <button
            type="button"
            aria-label="Open canvas date picker"
            onClick={() => setDatePickerOpen((open) => !open)}
            className={cn(dateButtonClassName, "md:hidden")}
          >
            {shortDateLabel}
          </button>
          {/* Desktop: full nav with arrows */}
          <div className="hidden md:flex items-center gap-1">
            <button
              type="button"
              aria-label="Previous day"
              onClick={goToPrev}
              disabled={!canGoPrev}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-app-ink-faint transition-colors duration-150 hover:bg-app-surface-hover hover:text-app-ink active:scale-95",
                disabledDateNavClassName,
              )}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              type="button"
              aria-label="Open canvas date picker"
              onClick={() => setDatePickerOpen((open) => !open)}
              className={dateButtonClassName}
            >
              {dateLabel}
            </button>
            <button
              type="button"
              aria-label="Next day"
              onClick={goToNext}
              disabled={!canGoNext}
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-app-ink-faint transition-colors duration-150 hover:bg-app-surface-hover hover:text-app-ink active:scale-95",
                disabledDateNavClassName,
              )}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      ) : (
        <div aria-hidden="true" />
      )}

      {/* Stat — right side */}
      <button
        aria-label="View insights"
        onClick={() => navigate("/insights")}
        className="flex shrink-0 items-center gap-1.5 rounded-full px-2 py-1 text-app-ink-faint transition-colors duration-150 hover:bg-app-surface-hover hover:text-app-ink active:scale-95 justify-self-end"
      >
        {statLabel === undefined ? (
          <div className="h-3.5 w-20 animate-pulse rounded-full bg-app-line" />
        ) : (
          <span className="text-sm text-app-ink-muted">{statLabel}</span>
        )}
        <ArrowRight className="h-3.5 w-3.5 shrink-0" />
      </button>
    </div>
    {datePicker}
    </>
  );
}
