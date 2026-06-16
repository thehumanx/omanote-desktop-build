import { useEffect, useMemo, useRef, useState } from "react";
import { useLocation } from "react-router-dom";
import { addDays, buildDateStripWindow, toDateKey } from "@omanote/shared";
import type { DateKey } from "@omanote/shared";
import { CalendarDays, CheckCheck, ChevronDown, ChevronLeft, ChevronRight, Clock3, List, Plus, Trash2, X } from "lucide-react";
import { useApp } from "../app/AppProvider";
import { BaseModal } from "../components/BaseModal";
import { EventEditorModal } from "../components/EventEditorModal";
import { AttachmentLinkPreview } from "../components/AttachmentLinkPreview";
import { RichTextPreview } from "../components/rich-text";
import { useTopChrome } from "../components/layout/useTopChrome";
import { PageHeader } from "../components/layout/PageHeader";
import { MobileSaveButton } from "../components/MobileSaveButton";
import { Button, SegmentedPill } from "../components/ui";
import { formatMonthDayRange, parseEventDraftInputForDate } from "@omanote/shared";
import { handlePasteAsLink } from "../lib/link-utils";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { isNewlineShortcutEvent, isSaveShortcutEvent } from "../lib/editor-shortcuts";
import { SaveShortcutHint } from "../components/settings/SaveShortcutHint";

type EventView = "week" | "timeline";

const HOURS = Array.from({ length: 24 }, (_, hour) => hour);
const HOUR_ROW_HEIGHT = 72;
const EVENT_BLOCK_HEIGHT = 56;
const EVENT_BLOCK_DURATION_MINUTES = 50;
const CALENDAR_TOP_PADDING = 20;
const CLUSTER_STACK_HEIGHT = 92;

type EventItem = ReturnType<typeof useApp>["state"]["events"][number];

type EventCluster = {
  id: string;
  dateKey: string;
  top: number;
  events: EventItem[];
};

function formatHourLabel(hour: number) {
  const suffix = hour >= 12 ? "PM" : "AM";
  const normalizedHour = hour % 12 === 0 ? 12 : hour % 12;
  return `${normalizedHour} ${suffix}`;
}

function formatEventTime(timestamp: number) {
  return new Date(timestamp)
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
    .replace(":00", "")
    .replace(/\s+/g, "");
}

function isTodoCompletedEvent(event: EventItem) {
  return event.sourceType === "todo_completed";
}

function autoResize(textarea: HTMLTextAreaElement) {
  textarea.style.height = "auto";
  textarea.style.height = `${textarea.scrollHeight}px`;
}

function formatDateLabel(dateKey: string, todayKey: string): string {
  if (dateKey === todayKey) return "Today";
  const date = new Date(`${dateKey}T00:00:00`);
  const weekday = date.toLocaleDateString("en-US", { weekday: "short" });
  const monthDay = date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
  return `${weekday}, ${monthDay}`;
}

function TimelineView({
  events,
  todayKey,
  focusedEventId,
  onEdit,
  onDelete,
  onDeleteTodoEvent,
  onLogEvent,
}: {
  events: EventItem[];
  todayKey: string;
  focusedEventId: string | null;
  onEdit: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onDeleteTodoEvent: (todoId: string) => void;
  onLogEvent: () => void;
}) {
  const dateGroups = useMemo(() => {
    const byDate = new Map<string, EventItem[]>();
    for (const event of events) {
      const key = event.createdDateKey;
      const group = byDate.get(key) ?? [];
      group.push(event);
      byDate.set(key, group);
    }

    // Always include today; only include past dates that have events
    const groups: { dateKey: string; events: EventItem[] }[] = [];

    // Today always appears
    groups.push({
      dateKey: todayKey,
      events: [...(byDate.get(todayKey) ?? [])].sort((a, b) => b.loggedAt - a.loggedAt),
    });

    // Past dates with events, sorted newest first
    const pastKeys = [...byDate.keys()]
      .filter((k) => k < todayKey)
      .sort((a, b) => b.localeCompare(a));

    for (const key of pastKeys) {
      groups.push({
        dateKey: key,
        events: [...(byDate.get(key) ?? [])].sort((a, b) => b.loggedAt - a.loggedAt),
      });
    }

    return groups;
  }, [events, todayKey]);

  if (dateGroups.length === 0) {
    return <p className="py-12 text-center text-sm text-app-ink-faint">No events yet</p>;
  }

  return (
    <div className="w-full min-w-0 pb-4">
      {dateGroups.map(({ dateKey, events: dayEvents }, groupIndex) => {
        const label = formatDateLabel(dateKey, todayKey);
        const isFirst = groupIndex === 0;
        const isLast = groupIndex === dateGroups.length - 1;

        return (
          <div key={dateKey} className="relative">
            {/* Outer date line — top segment (skip for first) */}
            {!isFirst && (
              <div className="absolute left-[11px] top-0 h-[17px] w-px bg-app-line" />
            )}
            {/* Outer date line — bottom segment (skip for last) */}
            {!isLast && (
              <div className="absolute bottom-0 left-[11px] top-[22px] w-px bg-app-line" />
            )}

            {/* Date header row */}
            <div className="relative flex items-center gap-1.5 py-2.5">
              {/* Date dot */}
              <div className="relative z-10 flex h-[14px] w-[22px] shrink-0 items-center justify-center">
                <div className="h-[10px] w-[10px] rounded-full border-2 border-app-ink-faint bg-app-canvas" />
              </div>
              <span className="text-sm font-bold text-app-ink">{label}</span>
              <span className="rounded-full bg-app-surface-muted px-2 py-0.5 text-[11px] font-bold text-app-ink-muted">
                {dayEvents.length}
              </span>
            </div>

            {/* Today empty state */}
            {dateKey === todayKey && dayEvents.length === 0 && (
              <div className="ml-10 mb-3 rounded-2xl bg-app-surface-muted px-5 py-6">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="flex h-9 w-9 items-center justify-center rounded-full bg-app-surface">
                    <CalendarDays className="h-4 w-4 text-app-ink-faint" />
                  </div>
                  <p className="text-sm text-app-ink-faint">Today seems eventless so far</p>
                  <Button
                    type="button"
                    onClick={onLogEvent}
                    className="gap-1.5 px-3.5 py-1.5 text-xs"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Log your event
                  </Button>
                </div>
              </div>
            )}

            {/* Events — indented with their own timeline */}
            {dayEvents.length > 0 && (
              <div className="relative ml-6 pb-3">
                {dayEvents.map((event, eventIndex) => {
                  const isTodoCEvent = isTodoCompletedEvent(event);
                  const isFirstEvent = eventIndex === 0;
                  const isLastEvent = eventIndex === dayEvents.length - 1;
                  return (
                    <div key={event.id} data-event-row-id={event.id} className={["relative flex items-start gap-3 py-1.5 rounded-lg transition-colors duration-700", focusedEventId === event.id ? "bg-app-surface-hover" : ""].join(" ")}>
                      {/* Inner event line — top segment (skip for first event) */}
                      {!isFirstEvent && (
                        <div className="absolute left-[10px] top-0 h-[6px] w-px bg-app-line" />
                      )}
                      {/* Inner event line — bottom segment (skip for last event) */}
                      {!isLastEvent && (
                        <div className="absolute left-[10px] top-[26px] bottom-0 w-px bg-app-line" />
                      )}
                      {/* Event type icon on the inner line */}
                      <div className="relative z-10 flex w-[21px] shrink-0 items-center justify-center">
                        <div className="flex h-[20px] w-[20px] items-center justify-center rounded-full bg-app-surface-muted">
                          {isTodoCEvent
                            ? <CheckCheck className="h-3 w-3 text-app-ink-faint" />
                            : <Clock3 className="h-3 w-3 text-app-ink-faint" />
                          }
                        </div>
                      </div>

                      {isTodoCEvent ? (
                        /* Todo event: read-only, with link/hashtag rendering */
                        <div className="min-w-0 flex-1">
                          <div className="flex items-start gap-1.5">
                            <span className="w-[68px] shrink-0 tabular-nums text-xs text-app-ink-faint">
                              {formatEventTime(event.loggedAt)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <RichTextPreview
                                value={event.label}
                                paragraphClassName="text-sm text-app-ink-muted"
                              />
                              <AttachmentLinkPreview
                                textValues={[event.label, event.notes]}
                                className="mt-2"
                              />
                            </div>
                          </div>
                        </div>
                      ) : (
                        /* Normal event: clickable, hover bg, delete on hover */
                        <div
                          role="button"
                          tabIndex={0}
                          className="group/event relative min-w-0 flex-1 cursor-pointer rounded-lg px-2 -mx-2 transition hover:bg-app-surface-hover"
                          onClick={() => onEdit(event.id)}
                          onDoubleClick={() => onEdit(event.id)}
                          onKeyDown={(e) => { if (e.key === "Enter") onEdit(event.id); }}
                        >
                          {/* Delete button — visible on hover */}
                          <button
                            type="button"
                            aria-label="Delete event"
                            onClick={(e) => { e.stopPropagation(); onDelete(event.id); }}
                            className="absolute right-1 top-1 flex h-6 w-6 items-center justify-center rounded-full text-app-ink-faint opacity-0 transition hover:bg-app-surface-muted hover:text-app-ink-muted group-hover/event:opacity-100"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>

                          <div className="flex items-start gap-1.5 pr-6">
                            <span className="w-[68px] shrink-0 tabular-nums text-xs text-app-ink-faint">
                              {formatEventTime(event.loggedAt)}
                            </span>
                            <div className="min-w-0 flex-1">
                              <RichTextPreview
                                value={event.label}
                                paragraphClassName="text-sm text-app-ink-muted"
                              />
                              {event.notes && (
                                <RichTextPreview
                                  value={event.notes}
                                  className="mt-0.5"
                                  paragraphClassName="text-xs text-app-ink-faint"
                                />
                              )}
                              <AttachmentLinkPreview
                                textValues={[event.label, event.notes]}
                                className="mt-2"
                              />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function getWeekEntryClusters(events: EventItem[], weekDateKeys: string[]): Record<string, EventCluster[]> {
  const grouped = new Map<string, EventItem[]>();
  for (const event of events) {
    if (!weekDateKeys.includes(event.createdDateKey)) continue;
    const next = grouped.get(event.createdDateKey) ?? [];
    next.push(event);
    grouped.set(event.createdDateKey, next);
  }

  const clustersByDateKey: Record<string, EventCluster[]> = {};
  for (const dateKey of weekDateKeys) {
    const dayEvents = [...(grouped.get(dateKey) ?? [])].sort((left, right) => left.loggedAt - right.loggedAt);
    const clusters: EventCluster[] = [];
    let currentCluster: EventCluster | null = null;
    let currentClusterEnd = -1;

    for (const event of dayEvents) {
      const date = new Date(event.loggedAt);
      const startMinutes = date.getHours() * 60 + date.getMinutes();
      const endMinutes = startMinutes + EVENT_BLOCK_DURATION_MINUTES;

      if (!currentCluster || startMinutes >= currentClusterEnd) {
        currentCluster = {
          id: `${dateKey}:${event.id}`,
          dateKey,
          top: (startMinutes / 60) * HOUR_ROW_HEIGHT,
          events: [event],
        };
        clusters.push(currentCluster);
        currentClusterEnd = endMinutes;
        continue;
      }

      currentCluster.events.push(event);
      currentClusterEnd = Math.max(currentClusterEnd, endMinutes);
    }

    clustersByDateKey[dateKey] = clusters;
  }

  return clustersByDateKey;
}

function EventClusterModal({
  events,
  onClose,
  onEdit,
  onDeleteTodoEvent,
}: {
  events: EventItem[];
  onClose: () => void;
  onEdit: (eventId: string) => void;
  onDeleteTodoEvent: (todoId: string) => void;
}) {
  const sortedEvents = [...events].sort((left, right) => left.loggedAt - right.loggedAt);

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose}>
      <div
        className="w-full max-w-lg rounded-app-dialog border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-app-ink-faint">
              {sortedEvents.length} events
            </p>
            <p className="mt-1 text-sm text-app-ink-muted">{sortedEvents[0] ? formatEventTime(sortedEvents[0].loggedAt) : ""}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="space-y-2">
          {sortedEvents.map((event) => (
            <div key={event.id} className="rounded-2xl border border-app-line bg-app-surface px-4 py-3">
              <div className="flex items-start gap-3">
                <div className="min-w-[76px] rounded-md bg-app-surface-muted px-2 py-1 text-xs font-bold text-app-ink-faint">
                  {formatEventTime(event.loggedAt)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    {isTodoCompletedEvent(event) ? <CheckCheck className="h-4 w-4 text-app-ink-faint" /> : null}
                    <p className="text-sm font-bold text-app-ink">{event.label}</p>
                  </div>
                  {event.notes ? <p className="mt-1 text-sm leading-6 text-app-ink-muted">{event.notes}</p> : null}
                  <AttachmentLinkPreview textValues={[event.label, event.notes]} className="mt-2" />
                </div>
                {!isTodoCompletedEvent(event) ? (
                  <Button tone="ghost" onClick={() => onEdit(event.id)}>
                    Open
                  </Button>
                ) : event.sourceTodoId ? (
                  <button
                    type="button"
                    aria-label="Uncheck todo"
                    onClick={() => onDeleteTodoEvent(event.sourceTodoId!)}
                    className="flex h-7 w-7 items-center justify-center rounded-full text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </div>
    </BaseModal>
  );
}

function EventCreateModal({
  dateKey,
  startedAt,
  onClose,
  onSave,
}: {
  dateKey: DateKey;
  startedAt: number;
  onClose: () => void;
  onSave: (value: string) => void;
}) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const canSave = Boolean(value.trim());
  const { settings } = useUserSettings();

  useEffect(() => {
    textareaRef.current?.focus();
    if (textareaRef.current) autoResize(textareaRef.current);
  }, []);

  useEffect(() => {
    if (textareaRef.current) autoResize(textareaRef.current);
  }, [value]);

  return (
    <BaseModal onClose={onClose} onBackdropMouseDown={onClose}>
      <div
        className="w-full max-w-2xl rounded-app-dialog border border-app-line bg-app-surface p-5 shadow-soft"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-4">
          <div className="min-w-[104px] rounded-md border border-app-line bg-app-surface-muted px-2 py-1.5 text-sm font-medium text-app-ink-faint">
            {new Date(startedAt).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true }).replace(":00", "").replace(/\s+/g, "")}
          </div>
          <div className="min-w-0 flex-1">
            <textarea
              ref={textareaRef}
              value={value}
              onChange={(event) => setValue(event.target.value)}
              onPaste={(event) => {
                handlePasteAsLink(event, value, setValue);
              }}
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;
                if (isSaveShortcutEvent(event, settings.saveShortcut)) {
                  event.preventDefault();
                  onSave(value);
                  return;
                }
                if (isNewlineShortcutEvent(event, settings.newlineShortcut)) {
                  return;
                }
                event.preventDefault();
              }}
              rows={1}
              placeholder="Write your event like in canvas, for example: woke up 6am"
              className="block w-full resize-none border-0 bg-transparent p-0 text-[28px] font-bold leading-[1.25] text-app-ink caret-app-ink outline-none placeholder:text-app-line-strong selection:bg-app-surface-muted selection:text-app-ink"
            />
            <p className="mt-2 text-sm text-app-ink-faint">{dateKey}</p>
            <div className="mt-3 flex items-center justify-end gap-2">
              <SaveShortcutHint className="hidden text-sm md:inline" />
              <MobileSaveButton disabled={!canSave} onClick={() => onSave(value)} />
            </div>
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

export function EventScreen() {
  const { state, dispatch } = useApp();
  const location = useLocation();
  const [editingEventId, setEditingEventId] = useState<string | null>(null);
  const [activeCluster, setActiveCluster] = useState<EventItem[] | null>(null);
  const [createState, setCreateState] = useState<{ dateKey: DateKey; startedAt: number } | null>(null);
  const [focusedEventId, setFocusedEventId] = useState<string | null>(null);
  const [eventView, setEventView] = useState<EventView>(() => {
    const saved = localStorage.getItem("event-view");
    return saved === "timeline" ? "timeline" : "week";
  });
  const changeEventView = (view: EventView) => {
    localStorage.setItem("event-view", view);
    setEventView(view);
  };

  useEffect(() => {
    const focusId = (location.state as { focusEventId?: string } | null)?.focusEventId;
    if (!focusId) return;
    window.history.replaceState({}, "");
    setEventView("timeline");
    localStorage.setItem("event-view", "timeline");
    setFocusedEventId(focusId);
    requestAnimationFrame(() => {
      const el = document.querySelector(`[data-event-row-id="${focusId}"]`);
      el?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
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

  const weekDates = useMemo(() => buildDateStripWindow(addDays(today, state.ui.dateWindowOffset)), [state.ui.dateWindowOffset, today]);
  const weekDateKeys = useMemo(() => weekDates.map((date) => toDateKey(date)), [weekDates]);
  const visibleEvents = activeEvents;
  const weekEntries = useMemo(
    () => visibleEvents.filter((event) => weekDateKeys.includes(event.createdDateKey)),
    [visibleEvents, weekDateKeys],
  );
  const weekClusters = useMemo(() => getWeekEntryClusters(visibleEvents, weekDateKeys), [visibleEvents, weekDateKeys]);
  const editingEvent = state.events.find((event) => event.id === editingEventId) ?? null;

  const weekRangeLabel = useMemo(() => {
    const [firstDate] = weekDateKeys;
    const lastDate = weekDateKeys[weekDateKeys.length - 1];
    return formatMonthDayRange(firstDate, lastDate);
  }, [weekDateKeys]);

  const topChrome = useMemo(() => <PageHeader stat="events_this_week" />, []);
  useTopChrome(topChrome);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-app-ink-faint">
            {eventView === "week" ? "Week view" : "Timeline"}
          </p>
          <p className="mt-1 text-sm text-app-ink-muted">
            {eventView === "week"
              ? `${weekRangeLabel} · ${weekEntries.length} logged`
              : `${activeEvents.length} total events`}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {eventView === "week" && (
            <>
              <Button
                tone="soft"
                onClick={() => {
                  dispatch({ type: "ui/set-date-window-offset", offset: 0 });
                  dispatch({ type: "ui/set-selected-date", dateKey: toDateKey(today) });
                }}
              >
                Today
              </Button>
              <Button
                tone="ghost"
                className="h-10 w-10 rounded-full p-0"
                aria-label="Previous week"
                onClick={() => dispatch({ type: "ui/set-date-window-offset", offset: state.ui.dateWindowOffset - 7 })}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                tone="ghost"
                className="h-10 w-10 rounded-full p-0"
                aria-label="Next week"
                onClick={() => dispatch({ type: "ui/set-date-window-offset", offset: state.ui.dateWindowOffset + 7 })}
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
        <div className="min-h-0 flex-1 overflow-y-auto overflow-x-hidden">
          <TimelineView
            events={activeEvents}
            todayKey={todayKey}
            focusedEventId={focusedEventId}
            onEdit={(eventId) => setEditingEventId(eventId)}
            onDelete={(eventId) => dispatch({ type: "event/delete", eventId })}
            onDeleteTodoEvent={(todoId) => dispatch({ type: "todo/toggle", todoId })}
            onLogEvent={() => setCreateState({ dateKey: todayKey, startedAt: Date.now() })}
          />
        </div>
      )}

      {eventView === "week" && (
      <div className="min-h-0 flex-1 overflow-hidden rounded-app-dialog border border-app-line bg-app-surface shadow-none">
        <div className="h-full overflow-auto">
          <div className="min-w-[920px]">
            <div className="sticky top-0 z-20">
              <div className="grid border-b border-app-line bg-app-surface/95 backdrop-blur" style={{ gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))" }}>
                <div className="border-r border-app-line px-3 py-3" />
                {weekDates.map((date) => {
                  const dateKey = toDateKey(date);
                  const isToday = dateKey === todayKey;
                  const dayClusters = weekClusters[dateKey] ?? [];
                  const dayCount = dayClusters.reduce((total, cluster) => total + cluster.events.length, 0);

                  return (
                    <div
                      key={dateKey}
                      onClick={() => {
                        if (!isToday) return;
                        setCreateState({ dateKey, startedAt: Date.now() });
                      }}
                      className={[
                        "border-r border-app-line px-3 py-3 text-left transition last:border-r-0",
                        isToday ? "bg-app-surface" : "bg-app-surface-muted/90",
                        isToday ? "cursor-text hover:bg-app-surface-hover" : "",
                      ].join(" ")}
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className={["text-[11px] font-bold uppercase tracking-[0.18em]", isToday ? "text-app-ink-faint" : "text-app-ink-faint"].join(" ")}>
                            {date.toLocaleDateString("en-US", { weekday: "short" })}
                          </p>
                          <p className={["mt-1 text-sm font-bold", isToday ? "text-app-ink" : "text-app-ink-faint"].join(" ")}>
                            {date.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className={["rounded-full px-2 py-0.5 text-[10px] font-bold", isToday ? "bg-app-surface-muted text-app-ink-muted" : "bg-app-line text-app-ink-faint"].join(" ")}>
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
              style={{
                gridTemplateColumns: "72px repeat(7, minmax(0, 1fr))",
                height: HOURS.length * HOUR_ROW_HEIGHT + CALENDAR_TOP_PADDING,
              }}
            >
              <div className="relative border-r border-app-line bg-app-surface-muted/70">
                <div className="absolute inset-x-0 border-b border-app-line" style={{ top: CALENDAR_TOP_PADDING }} />
                {HOURS.map((hour) => (
                  <div
                    key={hour}
                    className="absolute inset-x-0 border-b border-app-line pr-3 text-right"
                    style={{ top: CALENDAR_TOP_PADDING + hour * HOUR_ROW_HEIGHT, height: HOUR_ROW_HEIGHT }}
                  >
                    <span className="absolute -top-2 right-3 bg-app-surface-muted px-1 text-[10px] font-bold uppercase tracking-[0.18em] text-app-ink-faint">
                      {formatHourLabel(hour)}
                    </span>
                  </div>
                ))}
              </div>

              {weekDateKeys.map((dateKey) => {
                const dayClusters = weekClusters[dateKey] ?? [];
                const isToday = dateKey === todayKey;

                return (
                  <div
                    key={dateKey}
                    onClick={() => {
                      if (!isToday) return;
                      setCreateState({ dateKey, startedAt: Date.now() });
                    }}
                    className={[
                      "relative border-r border-app-line last:border-r-0",
                      isToday ? "bg-app-surface" : "bg-app-surface-muted/90",
                      isToday ? "cursor-text" : "",
                    ].join(" ")}
                  >
                    <div className="absolute inset-x-0 border-b border-app-line" style={{ top: CALENDAR_TOP_PADDING }} />
                    {HOURS.map((hour) => (
                      <div
                        key={hour}
                        className="absolute inset-x-0 border-b border-app-line"
                        style={{ top: CALENDAR_TOP_PADDING + hour * HOUR_ROW_HEIGHT, height: HOUR_ROW_HEIGHT }}
                      />
                    ))}

                    {dayClusters.map((cluster) => {
                      const isGroup = cluster.events.length > 1;
                      const previewEvents = cluster.events.slice(0, 2);

                      return (
                        <div
                          key={cluster.id}
                          className="absolute z-10 overflow-hidden rounded-2xl border border-app-line bg-app-surface px-3 py-2 text-left shadow-soft transition hover:border-app-line-strong hover:shadow-soft"
                          style={{
                            top: CALENDAR_TOP_PADDING + cluster.top + 8,
                            left: "6px",
                            width: "calc(100% - 12px)",
                            minHeight: isGroup ? CLUSTER_STACK_HEIGHT : EVENT_BLOCK_HEIGHT,
                          }}
                        >
                          {isGroup ? (
                            <button
                              type="button"
                              className="block w-full text-left"
                              onClick={(event) => {
                                event.stopPropagation();
                                setActiveCluster(cluster.events);
                              }}
                            >
                              <div className="flex items-center justify-between gap-3">
                                <p className="min-w-0 text-[10px] font-bold uppercase tracking-[0.18em] text-app-ink-faint">
                                  {formatEventTime(cluster.events[0].loggedAt)} · {cluster.events.length} events
                                </p>
                                <span className="shrink-0 rounded-full bg-app-surface-muted px-2 py-0.5 text-[10px] font-bold text-app-ink-muted">
                                  Stack
                                </span>
                              </div>
                              <div className="mt-3 space-y-1">
                                {previewEvents.map((event) => (
                                  <p key={event.id} className="truncate text-sm font-bold leading-5 text-app-ink">
                                    {event.label}
                                  </p>
                                ))}
                                {cluster.events.length > previewEvents.length ? (
                                  <p className="text-xs text-app-ink-faint">+{cluster.events.length - previewEvents.length} more</p>
                                ) : null}
                              </div>
                            </button>
                          ) : isTodoCompletedEvent(cluster.events[0]) ? (
                            <div className="group/todo block w-full text-left">
                              <div className="flex items-center gap-2">
                                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-app-ink-faint">
                                  {formatEventTime(cluster.events[0].loggedAt)}
                                </p>
                                <CheckCheck className="h-3.5 w-3.5 text-app-ink-faint" />
                              </div>
                              <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-app-ink">{cluster.events[0].label}</p>
                              {cluster.events[0].notes ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-4 text-app-ink-muted">{cluster.events[0].notes}</p>
                              ) : null}
                              {cluster.events[0].sourceTodoId ? (
                                <button
                                  type="button"
                                  aria-label="Uncheck todo"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    dispatch({ type: "todo/toggle", todoId: cluster.events[0].sourceTodoId! });
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
                                setEditingEventId(cluster.events[0].id);
                              }}
                            >
                              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-app-ink-faint">
                                {formatEventTime(cluster.events[0].loggedAt)}
                              </p>
                              <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-app-ink">{cluster.events[0].label}</p>
                              {cluster.events[0].notes ? (
                                <p className="mt-1 line-clamp-2 text-xs leading-4 text-app-ink-muted">{cluster.events[0].notes}</p>
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
          events={activeCluster}
          onClose={() => setActiveCluster(null)}
          onEdit={(eventId) => {
            setActiveCluster(null);
            setEditingEventId(eventId);
          }}
          onDeleteTodoEvent={(todoId) => {
            dispatch({ type: "todo/toggle", todoId });
            setActiveCluster((current) => {
              const next = current?.filter((e) => e.sourceTodoId !== todoId) ?? [];
              return next.length ? next : null;
            });
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
    </div>
  );
}
