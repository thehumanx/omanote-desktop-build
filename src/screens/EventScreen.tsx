import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { addDays, buildDateStripWindow, formatMonthDayRange, listVirtualOccurrencesForDates, parseEventDraftInputForDate, parseVirtualOccurrenceId, toDateKey } from "@omanote/shared";
import type { DateKey, TodoItem } from "@omanote/shared";
import { CalendarDays, CheckCheck, ChevronLeft, ChevronRight, List, Trash2 } from "lucide-react";
import { useApp } from "../app/AppProvider";
import { useIsMobileViewport } from "../lib/mobile";
import { EventEditorModal } from "../components/EventEditorModal";
import { TodoEditorModal } from "../components/TodoEditorModal";
import { useTopChrome } from "../components/layout/useTopChrome";
import { ExpandableSearch } from "../components/ExpandableSearch";
import { matchesQuery, normalizeSearchQuery } from "../lib/search-match";
import { Button, SegmentedPill } from "../components/ui";
import { enumCodec, readLocalStorage, writeLocalStorage } from "../lib/local-storage";
import { CALENDAR_TOP_PADDING, CLUSTER_STACK_HEIGHT, CalendarEntry, EMPTY_HOUR_LAYOUT, HOURS, getCalendarHourLayout, getWeekEntryClusters } from "./events/calendar-layout";
import { calendarEntryTimeLabel, calendarEntryTitle, formatHourLabel, isTodoCompletedEvent, isTodoEntry } from "./events/event-format";
import { CalendarTodoRow } from "./events/CalendarTodoRow";
import { AgendaView, type AgendaDay } from "./events/AgendaView";
import { TimelineView } from "./events/TimelineView";
import { EventClusterModal } from "./events/EventClusterModal";
import { EventCreateModal } from "./events/EventCreateModal";

type EventView = "week" | "timeline";

const EVENT_VIEW_KEY = "event-view";

const eventViewCodec = enumCodec<EventView>(["week", "timeline"]);

/** How far forward the mobile agenda runs. See `agendaDateKeys`. */
const AGENDA_DAY_COUNT = 60;

export function EventScreen() {
  const { state, dispatch } = useApp();
  const location = useLocation();
  const isMobile = useIsMobileViewport();
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [editingTodoId, setEditingTodoId] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState<CalendarEntry[] | null>(null);
  const [createState, setCreateState] = useState<{ dateKey: DateKey; startedAt: number } | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const timelineScrollRef = useRef<HTMLDivElement>(null);
  const [eventView, setEventView] = useState<EventView>(() =>
    readLocalStorage(EVENT_VIEW_KEY, eventViewCodec, "week"),
  );
  const changeEventView = (view: EventView) => {
    writeLocalStorage(EVENT_VIEW_KEY, eventViewCodec, view);
    setEventView(view);
  };
  /**
   * Both views stay available on mobile — what changes is how the *calendar*
   * one is drawn.
   *
   * On desktop it's a week grid with an hour gutter. That needs ~920px, so
   * below `md` it used to collapse to a single day column paged one day at a
   * time, which is a calendar that can only ever show you one day. Google
   * Calendar answers the same constraint with a Schedule view: one
   * continuous, forward-looking list of entries grouped by day. That's what
   * mobile renders instead of the grid.
   *
   * The timeline view is untouched and still shows logged events (including
   * the ones a completed todo generates) on both viewports.
   */
  const isMobileCalendar = isMobile && eventView === "week";

  useEffect(() => {
    const focusId = (location.state as { focusEventId?: string } | null)?.focusEventId;
    if (!focusId) return;
    window.history.replaceState({}, "");
    setEventView("timeline");
    writeLocalStorage(EVENT_VIEW_KEY, eventViewCodec, "timeline");
    // TimelineView scrolls to it — it owns the day grouping the windowed list
    // is keyed by, which a DOM query from out here can't see.
    setFocusedEventId(focusId);
    const timer = window.setTimeout(() => setFocusedEventId(null), 2000);
    return () => window.clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const today = useMemo(() => new Date(), []);
  const todayKey = useMemo(() => toDateKey(today), [today]);

  const activeEvents = useMemo(
    () => state.events.filter((event) => !event.deletedAt).sort((left, right) => left.loggedAt - right.loggedAt),
    [state.events],
  );

  const [eventSearch, setEventSearch] = useState("");
  const eventSearchQuery = useMemo(() => normalizeSearchQuery(eventSearch), [eventSearch]);
  const timelineEvents = useMemo(() => {
    if (!eventSearchQuery) return activeEvents;
    return activeEvents.filter((event) => matchesQuery(eventSearchQuery, event.label, event.notes));
  }, [activeEvents, eventSearchQuery]);
  // The week grid is desktop-only, so this is always a full week and the
  // arrows always step by one. Mobile used to collapse it to a single day
  // column, which is exactly the paging the agenda replaces.
  const dayStep = 7;
  const weekDates = useMemo(
    () => buildDateStripWindow(addDays(today, state.ui.dateWindowOffset)),
    [state.ui.dateWindowOffset, today],
  );
  const weekDateKeys = useMemo(() => weekDates.map((date) => toDateKey(date)), [weekDates]);

  // The mobile agenda scrolls forward from today instead of paging, so it
  // needs a range rather than a window. Bounded rather than open-ended
  // because every calendar memo below is built per day in this list, and a
  // recurring todo expands once per day it falls on.
  const agendaDateKeys = useMemo(
    () =>
      isMobileCalendar
        ? Array.from({ length: AGENDA_DAY_COUNT }, (_, index) => toDateKey(addDays(today, index)))
        : [],
    [isMobileCalendar, today],
  );

  // The days every calendar-data memo below is computed over: the visible
  // week on desktop, the agenda range on mobile.
  const calendarDateKeys = isMobileCalendar ? agendaDateKeys : weekDateKeys;

  // Scheduled todos for the calendar: plain todos with a due date, plus a
  // virtual occurrence of each recurring series on every day it's due within
  // the visible week (matching how the canvas expands them).
  const activeScheduledTodos = useMemo(() => {
    const todayKey = toDateKey(today);
    const nonRecurring = state.todos.filter((todo) => !todo.deletedAt && todo.dueDateKey && !todo.recurrence);
    const virtual = listVirtualOccurrencesForDates(state.todos, calendarDateKeys, todayKey);
    return [...nonRecurring, ...virtual];
  }, [state.todos, calendarDateKeys, today]);
  const visibleEvents = activeEvents;
  const allDayTodosByDateKey = useMemo(() => {
    const grouped: Record<string, TodoItem[]> = {};
    for (const todo of activeScheduledTodos) {
      if (!todo.dueDateKey || todo.dueTime || !calendarDateKeys.includes(todo.dueDateKey)) continue;
      grouped[todo.dueDateKey] = [...(grouped[todo.dueDateKey] ?? []), todo];
    }
    return grouped;
  }, [activeScheduledTodos, calendarDateKeys]);
  const timedCalendarEntries = useMemo<CalendarEntry[]>(() => {
    const eventEntries = visibleEvents.map((event) => {
      const date = new Date(event.loggedAt);
      return {
        kind: "event" as const,
        id: event.id,
        dateKey: event.createdDateKey,
        startMinutes: date.getHours() * 60 + date.getMinutes(),
        event,
      };
    });
    const todoEntries = activeScheduledTodos.flatMap((todo) => {
      if (!todo.dueDateKey || !todo.dueTime) return [];
      const [hourRaw, minuteRaw] = todo.dueTime.split(":");
      return [{
        kind: "todo" as const,
        id: todo.id,
        dateKey: todo.dueDateKey,
        startMinutes: Number(hourRaw) * 60 + Number(minuteRaw),
        todo,
      }];
    });
    return [...eventEntries, ...todoEntries];
  }, [activeScheduledTodos, visibleEvents]);
  const weekEntries = useMemo(
    () => visibleEvents.filter((event) => calendarDateKeys.includes(event.createdDateKey)),
    [visibleEvents, calendarDateKeys],
  );
  const weekTodoCount = useMemo(
    () => activeScheduledTodos.filter((todo) => todo.dueDateKey && calendarDateKeys.includes(todo.dueDateKey)).length,
    [activeScheduledTodos, calendarDateKeys],
  );
  // Grid-only, and deliberately skipped on mobile: these lay out an hour
  // gutter per day, which over the agenda's 60-day range would be 60x the
  // work for something never rendered.
  const calendarHourLayout = useMemo(
    () => (isMobileCalendar ? EMPTY_HOUR_LAYOUT : getCalendarHourLayout(timedCalendarEntries, weekDateKeys)),
    [isMobileCalendar, timedCalendarEntries, weekDateKeys],
  );
  const weekClusters = useMemo(
    () => (isMobileCalendar ? {} : getWeekEntryClusters(timedCalendarEntries, weekDateKeys, calendarHourLayout)),
    [isMobileCalendar, calendarHourLayout, timedCalendarEntries, weekDateKeys],
  );
  // Days for the mobile agenda: every day in range that has something on it,
  // plus today unconditionally so the list always has a "you are here".
  const agendaDays = useMemo<AgendaDay[]>(() => {
    if (!isMobileCalendar) return [];
    const timedByDay = new Map<string, CalendarEntry[]>();
    for (const entry of timedCalendarEntries) {
      if (!agendaDateKeys.includes(entry.dateKey as DateKey)) continue;
      timedByDay.set(entry.dateKey, [...(timedByDay.get(entry.dateKey) ?? []), entry]);
    }
    return agendaDateKeys
      .map((dateKey) => ({
        dateKey,
        allDayTodos: allDayTodosByDateKey[dateKey] ?? [],
        timed: [...(timedByDay.get(dateKey) ?? [])].sort((left, right) => left.startMinutes - right.startMinutes),
      }))
      .filter((day) => day.dateKey === todayKey || day.allDayTodos.length > 0 || day.timed.length > 0);
  }, [isMobileCalendar, agendaDateKeys, allDayTodosByDateKey, timedCalendarEntries, todayKey]);

  const editingEvent = state.events.find((event) => event.id === editingEventId) ?? null;
  // A virtual occurrence id (masterId::date) edits its series master.
  const editingTodoRealId = editingTodoId
    ? parseVirtualOccurrenceId(editingTodoId)?.masterId ?? editingTodoId
    : null;
  const editingTodo = state.todos.find((todo) => todo.id === editingTodoRealId) ?? null;

  const weekRangeLabel = useMemo(() => {
    const [firstDate] = weekDateKeys;
    const lastDate = weekDateKeys[weekDateKeys.length - 1];
    return formatMonthDayRange(firstDate, lastDate);
  }, [today, weekDateKeys, weekDates]);

  const calendarGridTemplate = `72px repeat(${weekDates.length}, minmax(0, 1fr))`;

  const stepCalendar = (direction: "prev" | "next") => {
    dispatch({
      type: "ui/set-date-window-offset",
      offset: state.ui.dateWindowOffset + (direction === "next" ? dayStep : -dayStep),
    });
  };
  // Swipe left/right to move the calendar window. Mobile only — wider viewports
  // keep the 920px grid, where horizontal drags are needed to pan the week.
  const calendarScrollRef = useRef<HTMLDivElement | null>(null);
  const agendaScrollRef = useRef<HTMLDivElement>(null);

  // Slide the calendar in from whichever side it came from. The offset moves in
  // both directions, so its delta gives the direction regardless of the source
  // (arrows, swipe, or the "Today" reset).
  const previousOffsetRef = useRef(state.ui.dateWindowOffset);
  const [slideDirection, setSlideDirection] = useState<"prev" | "next" | null>(null);
  useLayoutEffect(() => {
    if (previousOffsetRef.current === state.ui.dateWindowOffset) return;
    const direction = state.ui.dateWindowOffset > previousOffsetRef.current ? "next" : "prev";
    previousOffsetRef.current = state.ui.dateWindowOffset;
    setSlideDirection(direction);
  }, [state.ui.dateWindowOffset]);
  // Applied to the day cells only — the card frame and the hour gutter stay put
  // while the days slide in.
  const daySlideClass = slideDirection ? `omanote-week-slide-${slideDirection}` : "";

  useTopChrome(<ExpandableSearch value={eventSearch} onChange={setEventSearch} placeholder="Search in Events" />);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase text-app-ink-faint">
            {eventView === "timeline" ? "Timeline" : isMobileCalendar ? "Schedule" : "Week view"}
          </p>
          <p className="mt-1 text-sm text-app-ink-muted">
            {eventView === "timeline"
              ? `${timelineEvents.length} total events`
              : isMobileCalendar
                ? `${weekEntries.length} logged · ${weekTodoCount} todos scheduled`
                : `${weekRangeLabel} · ${weekEntries.length} logged · ${weekTodoCount} todos`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {eventView === "week" && !isMobileCalendar && (
            <>
              <Button
                variant="soft"
                onClick={() => {
                  dispatch({ type: "ui/set-date-window-offset", offset: 0 });
                  dispatch({ type: "ui/set-selected-date", dateKey: toDateKey(today) });
                }}
              >
                Today
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-full p-0"
                aria-label="Previous week"
                onClick={() => stepCalendar("prev")}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                className="h-10 w-10 rounded-full p-0"
                aria-label="Next week"
                onClick={() => stepCalendar("next")}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </>
          )}
          <SegmentedPill
            activeKey={eventView}
            ariaLabel="Event view"
            highlightTestId="event-view-highlight"
            items={[
              { key: "week", icon: <CalendarDays className="h-3.5 w-3.5" />, ariaLabel: "Calendar view" },
              { key: "timeline", icon: <List className="h-3.5 w-3.5" />, ariaLabel: "Timeline view" },
            ]}
            onChange={(key) => changeEventView(key as EventView)}
          />
        </div>
      </div>

      {eventView === "timeline" && (
        <div ref={timelineScrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <TimelineView
            scrollRef={timelineScrollRef}
            events={timelineEvents}
            todayKey={todayKey}
            focusedEventId={focusedEventId}
            onEdit={(eventId) => setEditingEventId(eventId)}
            onDelete={(eventId) => dispatch({ type: "event/delete", eventId })}
            onDeleteTodoEvent={(todoId) => dispatch({ type: "todo/toggle", todoId })}
            highlightQuery={eventSearchQuery}
            onLogEvent={() =>
              isMobile
                ? dispatch({ type: "ui/open-composer", mode: "event" })
                : setCreateState({ dateKey: todayKey, startedAt: Date.now() })
            }
          />
        </div>
      )}

      {isMobileCalendar && (
        <div ref={agendaScrollRef} className="scrollbar-hide min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <AgendaView
            days={agendaDays}
            todayKey={todayKey}
            scrollRef={agendaScrollRef}
            onEditEvent={(eventId) => setEditingEventId(eventId)}
            onEditTodo={(todoId) => setEditingTodoId(todoId)}
            onToggleTodo={(todoId) => dispatch({ type: "todo/toggle", todoId })}
          />
        </div>
      )}

      {eventView === "week" && !isMobileCalendar && (
      <div
        className="min-h-0 flex-1 overflow-hidden rounded-app-dialog border border-app-line bg-app-surface shadow-none"
        onAnimationEnd={(event) => {
          // animationend bubbles up from the day columns; ignore unrelated
          // animations from cards inside them.
          if (event.animationName.startsWith("omanote-week-slide")) setSlideDirection(null);
        }}
      >
        {/* The swipe-to-page-the-week gesture lived here; it was mobile-only,
            and this grid renders only on desktop now. */}
        <div ref={calendarScrollRef} className="scrollbar-hide h-full overflow-auto">
          <div className="min-w-[920px]">
            <div className="sticky top-0 z-20">
              <div className="grid border-b border-app-line bg-app-surface/95 backdrop-blur" style={{ gridTemplateColumns: calendarGridTemplate }}>
                <div className="border-r border-app-line px-3 py-3" />
                {weekDates.map((date) => {
                  const dateKey = toDateKey(date);
                  const isToday = dateKey === todayKey;
                  const dayClusters = weekClusters[dateKey] ?? [];
                  const dayCount = dayClusters.reduce((total, cluster) => total + cluster.entries.length, 0) + (allDayTodosByDateKey[dateKey]?.length ?? 0);

                  return (
                    <div
                      key={dateKey}
                      className={[
                        "border-r border-app-line px-3 py-3 text-left transition last:border-r-0",
                        isToday ? "bg-app-surface" : "bg-app-surface-muted/90",
                        daySlideClass,
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={["text-[11px] font-bold uppercase", isToday ? "text-app-ink-faint" : "text-app-ink-faint"].join(" ")}>
                            {date.toLocaleDateString("en-US", { weekday: "short" })}
                          </p>
                          <p className={["mt-1 text-sm font-bold", isToday ? "text-app-ink" : "text-app-ink-faint"].join(" ")}>
                            {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={["rounded-app-badge px-2 py-0.5 text-[10px] font-bold", isToday ? "bg-app-surface-muted text-app-ink-muted" : "bg-app-line text-app-ink-faint"].join(" ")}>
                            {dayCount}
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            <div
              className="relative grid"
              data-testid="week-calendar-grid"
              style={{
                gridTemplateColumns: calendarGridTemplate,
                height: calendarHourLayout.totalHeight,
              }}
            >
              <div className="relative border-r border-app-line bg-app-surface-muted/70">
                <div className="absolute inset-x-0 border-b border-app-line" style={{ top: CALENDAR_TOP_PADDING }} />
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-b border-app-line pr-3 text-right"
                    style={{
                      top: CALENDAR_TOP_PADDING + calendarHourLayout.hourTops[hour],
                      height: calendarHourLayout.rowHeights[hour],
                    }}
                  >
                    <span className="absolute -top-2 right-3 bg-app-surface-muted px-1 text-[10px] font-bold uppercase text-app-ink-faint">
                      {formatHourLabel(hour)}
                    </span>
                  </div>
                ))}
              </div>

              {weekDateKeys.map((dateKey) => {
                const dayClusters = weekClusters[dateKey] ?? [];
                const allDayTodos = allDayTodosByDateKey[dateKey] ?? [];
                const isToday = dateKey === todayKey;

                return (
                  <div
                    key={dateKey}
                    className={[
                      "relative border-r border-app-line last:border-r-0",
                      isToday ? "bg-app-surface" : "bg-app-surface-muted/90",
                      daySlideClass,
                    ].join(" ")}
                  >
                    <div className="absolute inset-x-0 border-b border-app-line" style={{ top: CALENDAR_TOP_PADDING }} />
                    {allDayTodos.length ? (
                      <div className="absolute top-2 z-10" style={{ left: "6px", width: "calc(100% - 12px)" }}>
                        {allDayTodos.length === 1 ? (
                          <div
                            className="overflow-hidden rounded-app-card border border-app-line bg-app-surface px-2 py-1.5 text-left shadow-soft transition hover:border-app-line-strong hover:shadow-soft"
                          >
                            <CalendarTodoRow
                              todo={allDayTodos[0]}
                              onOpen={() => {
                                setEditingTodoId(allDayTodos[0].id);
                              }}
                            />
                          </div>
                        ) : (
                          <button
                            type="button"
                            className="block w-full overflow-hidden rounded-app-card border border-app-line bg-app-surface px-2 py-1.5 text-left shadow-soft transition hover:border-app-line-strong hover:shadow-soft"
                            onClick={(event) => {
                              event.stopPropagation();
                              setActiveCluster(
                                allDayTodos.map((todo) => ({
                                  kind: "todo",
                                  id: todo.id,
                                  dateKey,
                                  startMinutes: 0,
                                  todo,
                                })),
                              );
                            }}
                          >
                            <div className="flex items-center justify-between gap-3">
                              <p className="min-w-0 text-[10px] font-bold uppercase text-app-ink-faint">
                                {allDayTodos.length} todos
                              </p>
                              <span className="shrink-0 rounded-app-badge bg-app-surface-muted px-2 py-0.5 text-[10px] font-bold text-app-ink-muted">
                                Stack
                              </span>
                            </div>
                            <div className="mt-2 space-y-1">
                              {allDayTodos.slice(0, 2).map((todo) => (
                                <p key={todo.id} className="truncate text-sm font-bold leading-5 text-app-ink">
                                  {todo.title}
                                </p>
                              ))}
                              {allDayTodos.length > 2 ? (
                                <p className="text-xs text-app-ink-faint">+{allDayTodos.length - 2} more</p>
                              ) : null}
                            </div>
                          </button>
                        )}
                      </div>
                    ) : null}
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute inset-x-0 border-b border-app-line"
                        style={{
                          top: CALENDAR_TOP_PADDING + calendarHourLayout.hourTops[hour],
                          height: calendarHourLayout.rowHeights[hour],
                        }}
                      />
                    ))}

                    {dayClusters.map((cluster) => {
                      const isGroup = cluster.entries.length > 1;
                      const previewEntries = cluster.entries.slice(0, 2);
                      const firstEntry = cluster.entries[0];

                      return (
                        <div
                          key={cluster.id}
                          className="absolute z-10 overflow-hidden rounded-app-card border border-app-line bg-app-surface px-2 py-1.5 text-left shadow-soft transition hover:border-app-line-strong hover:shadow-soft"
                          style={{
                            top: CALENDAR_TOP_PADDING + cluster.top + 8,
                            left: "6px",
                            width: "calc(100% - 12px)",
                            minHeight: isGroup ? CLUSTER_STACK_HEIGHT : undefined,
                          }}
                        >
                          {isGroup ? (
                            <button
                              type="button"
                              className="block w-full text-left"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveCluster(cluster.entries);
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 text-[10px] font-bold uppercase text-app-ink-faint">
                                  {calendarEntryTimeLabel(cluster.entries[0])} · {cluster.entries.length} items
                                </p>
                                <span className="shrink-0 rounded-app-badge bg-app-surface-muted px-2 py-0.5 text-[10px] font-bold text-app-ink-muted">
                                  Stack
                                </span>
                              </div>
                              <div className="mt-3 space-y-1">
                                {previewEntries.map((entry) => (
                                  <p key={entry.id} className="truncate text-sm font-bold leading-5 text-app-ink">
                                    {calendarEntryTitle(entry)}
                                  </p>
                                ))}
                                {cluster.entries.length > previewEntries.length ? (
                                  <p className="text-xs text-app-ink-faint">+{cluster.entries.length - previewEntries.length} more</p>
                                ) : null}
                              </div>
                            </button>
                          ) : firstEntry && isTodoEntry(firstEntry) ? (
                            <CalendarTodoRow
                              todo={firstEntry.todo}
                              onOpen={() => {
                                setEditingTodoId(firstEntry.todo.id);
                              }}
                            />
                          ) : firstEntry && isTodoCompletedEvent(firstEntry.event) ? (
                            <div className="group/todo relative block w-full text-left">
                              <button
                                type="button"
                                aria-label={`Open todo ${firstEntry.event.label}`}
                                className="block w-full text-left"
                                onClick={(event) => {
                                  event.stopPropagation();
                                  if (!firstEntry.event.sourceTodoId) return;
                                  setEditingTodoId(firstEntry.event.sourceTodoId);
                                }}
                              >
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] font-bold uppercase text-app-ink-faint">
                                  {calendarEntryTimeLabel(firstEntry)}
                                </p>
                                <CheckCheck className="h-3.5 w-3.5 text-app-ink-faint" />
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-app-ink">{firstEntry.event.label}</p>
                              {firstEntry.event.notes ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-4 text-app-ink-muted">{firstEntry.event.notes}</p>
                              ) : null}
                              </button>
                              {firstEntry.event.sourceTodoId ? (
                                <button
                                  type="button"
                                  aria-label="Uncheck todo"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch({ type: "todo/toggle", todoId: firstEntry.event.sourceTodoId! });
                                  }}
                                  className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full text-app-ink-faint opacity-0 transition hover:bg-app-surface-hover hover:text-app-ink-muted group-hover/todo:opacity-100"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              ) : null}
                            </div>
                          ) : (
                            <button
                              type="button"
                              className="block w-full text-left"
                              onClick={(event) => {
                                event.stopPropagation();
                                if (firstEntry) setEditingEventId(firstEntry.event.id);
                              }}
                            >
                              <p className="text-[10px] font-bold uppercase text-app-ink-faint">
                                {firstEntry ? calendarEntryTimeLabel(firstEntry) : ""}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-app-ink">{firstEntry ? firstEntry.event.label : ""}</p>
                              {firstEntry?.event.notes ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-4 text-app-ink-muted">{firstEntry.event.notes}</p>
                              ) : null}
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      </div>
      )}

      {activeCluster ? (
        <EventClusterModal
          entries={activeCluster}
          onClose={() => setActiveCluster(null)}
          onEdit={(eventId) => {
            setActiveCluster(null);
            setEditingEventId(eventId);
          }}
          onToggleTodo={(todoId) => {
            dispatch({ type: "todo/toggle", todoId });
            setActiveCluster((current) => current?.map((entry) => {
              if (entry.kind !== "todo" || entry.todo.id !== todoId) return entry;
              const isDone = entry.todo.status === "done";
              return {
                ...entry,
                todo: {
                  ...entry.todo,
                  status: isDone ? "open" : "done",
                  completedAt: isDone ? undefined : Date.now(),
                  updatedAt: Date.now(),
                },
              };
            }) ?? null);
          }}
          onUpdateTodo={(todoId, payload) => {
            dispatch({
              type: "todo/update",
              todoId,
              title: payload.title,
              dueDateKey: payload.dueDateKey as DateKey,
              dueTime: payload.dueTime,
              folderId: payload.folderId,
              folderName: payload.folderName,
            });
            setActiveCluster((current) => current?.map((entry) => {
              if (entry.kind !== "todo" || entry.todo.id !== todoId) return entry;
              return {
                ...entry,
                todo: {
                  ...entry.todo,
                  title: payload.title,
                  dueDateKey: payload.dueDateKey as DateKey,
                  dueTime: payload.dueTime,
                  updatedAt: Date.now(),
                },
              };
            }) ?? null);
          }}
          onDeleteTodo={(todoId) => {
            dispatch({ type: "todo/delete", todoId });
            setActiveCluster((current) => {
              const next = current?.filter((entry) => entry.kind !== "todo" || entry.todo.id !== todoId) ?? [];
              return next.length ? next : null;
            });
          }}
          onDeleteTodoEvent={(todoId) => {
            dispatch({ type: "todo/toggle", todoId });
            setActiveCluster((current) => {
              const next = current?.filter((entry) => entry.kind !== "event" || entry.event.sourceTodoId !== todoId) ?? [];
              return next.length ? next : null;
            });
          }}
          onOpenTodoEditor={(todoId) => {
            setActiveCluster(null);
            setEditingTodoId(todoId);
          }}
        />
      ) : null}

      {createState ? (
        <EventCreateModal
          dateKey={createState.dateKey}
          startedAt={createState.startedAt}
          onClose={() => setCreateState(null)}
          onSave={(value) => {
            const parsed = parseEventDraftInputForDate(value, createState.startedAt, createState.dateKey);
            if (!parsed.title.trim()) {
              setCreateState(null);
              return;
            }
            dispatch({
              type: "event/create",
              label: parsed.title,
              dateKey: createState.dateKey,
              loggedAt: parsed.loggedAt,
            });
            setCreateState(null);
          }}
        />
      ) : null}

      {editingEvent && editingEvent.sourceType !== "todo_completed" ? (
        <EventEditorModal
          event={editingEvent}
          selectedDateKey={editingEvent.createdDateKey}
          onClose={() => setEditingEventId(null)}
          onSave={(payload) => {
            dispatch({
              type: "event/update",
              eventId: editingEvent.id,
              label: payload.label,
              notes: payload.notes,
              hashtags: payload.hashtags,
              loggedAt: payload.loggedAt,
            });
            setEditingEventId(null);
          }}
          onDelete={() => {
            dispatch({ type: "event/delete", eventId: editingEvent.id });
            setEditingEventId(null);
          }}
        />
      ) : null}

      {editingTodo ? (
        <TodoEditorModal
          todo={editingTodo}
          folders={state.todoFolders}
          selectedFolderId={editingTodo.folderId}
          selectedDateKey={editingTodo.dueDateKey ?? editingTodo.createdDateKey}
          onClose={() => setEditingTodoId(null)}
          onToggle={(todoId) => {
            dispatch({
              type: "todo/toggle",
              todoId,
            });
          }}
          onSave={(payload) => {
            dispatch({
              type: "todo/update",
              todoId: editingTodo.id,
              title: payload.title,
              dueDateKey: payload.dueDateKey as DateKey,
              dueTime: payload.dueTime,
              hashtags: payload.hashtags,
              folderId: payload.folderId,
              folderName: payload.folderName,
              recurrence: payload.recurrence,
              reminderEveryMinutes: payload.reminderEveryMinutes,
              reminderUntil: payload.reminderUntil,
            });
            setEditingTodoId(null);
          }}
        />
      ) : null}
    </div>
  );
}
