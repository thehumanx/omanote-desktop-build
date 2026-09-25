import { useEffect, useMemo, useRef, type RefObject } from "react";
import { CalendarDays, CheckCheck, Clock3, Plus, Trash2 } from "lucide-react";
import { AttachmentLinkPreview } from "../../components/AttachmentLinkPreview";
import { RichTextPreview } from "../../components/rich-text";
import { Button } from "../../components/ui";
import { VirtualList, type VirtualListHandle } from "../../components/VirtualList";
import { EventItem } from "./calendar-layout";
import { formatDateLabel, formatEventTime, isTodoCompletedEvent } from "./event-format";

export function TimelineView({
  events,
  todayKey,
  focusedEventId,
  onEdit,
  onDelete,
  onDeleteTodoEvent,
  onLogEvent,
  highlightQuery,
  scrollRef,
}: {
  events: EventItem[];
  todayKey: string;
  focusedEventId: string | null;
  onEdit: (eventId: string) => void;
  onDelete: (eventId: string) => void;
  onDeleteTodoEvent: (todoId: string) => void;
  onLogEvent: () => void;
  highlightQuery?: string | null;
  /** The screen owns the scroll container; the timeline windows inside it. */
  scrollRef: RefObject<HTMLElement>;
}) {
  const listRef = useRef<VirtualListHandle>(null);
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

  // Scrolling to a deep-linked event lives here rather than in EventScreen
  // because this is where the day grouping is: the timeline is windowed by
  // day, so the day has to come into view before its rows exist to scroll to.
  useEffect(() => {
    if (!focusedEventId) return;
    const groupKey = dateGroups.find((group) => group.events.some((event) => event.id === focusedEventId))?.dateKey;
    if (groupKey) listRef.current?.scrollToKey(groupKey);
    const frame = requestAnimationFrame(() => {
      const row = document.querySelector(`[data-event-row-id="${focusedEventId}"]`);
      row?.scrollIntoView({ behavior: "smooth", block: "center" });
    });
    return () => cancelAnimationFrame(frame);
  }, [focusedEventId, dateGroups]);

  if (dateGroups.length === 0) {
    return <p className="py-12 text-center text-sm text-app-ink-faint">No events yet</p>;
  }

  return (
    <VirtualList
      ref={listRef}
      scrollRef={scrollRef}
      items={dateGroups}
      getKey={eventDateGroupKey}
      className="w-full min-w-0 pb-4"
      // No gap: each day draws the connecting timeline rule as absolutely
      // positioned segments that are only continuous because days sit flush
      // against each other.
      gap={0}
      threshold={12}
      estimateSize={260}
      overscan={4}
      renderItem={({ dateKey, events: dayEvents }, groupIndex) => {
        const label = formatDateLabel(dateKey, todayKey);
        const isFirst = groupIndex === 0;
        const isLast = groupIndex === dateGroups.length - 1;

        return (
          <div className="relative">
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
              <span className="app-title-font text-sm font-bold text-app-ink">{label}</span>
              <span className="rounded-app-badge bg-app-surface-muted px-2 py-0.5 text-[11px] font-bold text-app-ink-muted">
                {dayEvents.length}
              </span>
            </div>

            {/* Today empty state */}
            {dateKey === todayKey && dayEvents.length === 0 && (
              <div className="ml-10 mb-3 rounded-app-card bg-app-surface-muted px-5 py-6">
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
                                highlightQuery={highlightQuery}
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
                                highlightQuery={highlightQuery}
                              />
                              {event.notes && (
                                <RichTextPreview
                                  value={event.notes}
                                  className="mt-0.5"
                                  paragraphClassName="text-xs text-app-ink-faint"
                                  highlightQuery={highlightQuery}
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
      }}
    />
  );
}

/** Module scope for referential stability — VirtualList memoises its key map on it. */
const eventDateGroupKey = (group: { dateKey: string }) => group.dateKey;
