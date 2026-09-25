import type { TodoItem } from "@omanote/shared";
import { type RefObject } from "react";
import { CheckCheck, Clock3 } from "lucide-react";
import { TodoCheckmark, cn } from "../../components/ui";
import { VirtualList } from "../../components/VirtualList";
import { formatDateLabel, formatEntryTime, isTodoCompletedEvent } from "./event-format";
import type { CalendarEntry } from "./calendar-layout";

export type AgendaDay = {
  dateKey: string;
  allDayTodos: TodoItem[];
  timed: CalendarEntry[];
};

/**
 * The calendar as a continuous, forward-looking list — what the week grid
 * becomes on mobile.
 *
 * The grid needs an hour gutter and seven columns (~920px). Below `md` that
 * used to collapse to a single day paged with arrows, so finding next
 * Thursday took seven taps. This is the same content, read top to bottom:
 * every day that has something scheduled, with today always shown even when
 * it's empty so there is a "you are here".
 *
 * Windowed by day rather than by row, matching `TimelineView` — the day
 * header and its entries have to stay together, and a row is only reachable
 * once its day is mounted.
 */
export function AgendaView({
  days,
  todayKey,
  scrollRef,
  onEditEvent,
  onEditTodo,
  onToggleTodo,
}: {
  days: AgendaDay[];
  todayKey: string;
  scrollRef: RefObject<HTMLElement>;
  onEditEvent: (eventId: string) => void;
  onEditTodo: (todoId: string) => void;
  onToggleTodo: (todoId: string) => void;
}) {
  if (!days.length) {
    return <p className="py-12 text-center text-sm text-app-ink-faint">Nothing scheduled</p>;
  }

  return (
    <VirtualList
      items={days}
      getKey={(day) => day.dateKey}
      scrollRef={scrollRef}
      className="w-full min-w-0 pb-4"
      gap={16}
      threshold={12}
      estimateSize={140}
      overscan={4}
      renderItem={(day) => {
        const isToday = day.dateKey === todayKey;
        return (
          <section aria-label={formatDateLabel(day.dateKey, todayKey)}>
            <div className="flex items-baseline gap-2 border-b border-app-line pb-1">
              <h3 className={cn("text-sm font-bold", isToday ? "text-app-ink" : "text-app-ink-muted")}>
                {formatDateLabel(day.dateKey, todayKey)}
              </h3>
              <span className="text-[11px] text-app-ink-faint">
                {day.allDayTodos.length + day.timed.length || "nothing"}
              </span>
            </div>
            <ul className="mt-2 flex flex-col gap-1">
              {day.allDayTodos.map((todo) => (
                <li key={`all-day-${todo.id}`} className="flex items-start gap-3 rounded-app-panel px-2 py-1.5">
                  <span className="w-14 flex-none pt-0.5 text-[11px] uppercase text-app-ink-faint">All day</span>
                  <TodoCheckmark
                    type="button"
                    checked={todo.status === "done"}
                    align="text"
                    onClick={() => onToggleTodo(todo.id)}
                    aria-label={todo.status === "done" ? `Reopen ${todo.title}` : `Complete ${todo.title}`}
                  />
                  <button
                    type="button"
                    onClick={() => onEditTodo(todo.id)}
                    className={cn(
                      "min-w-0 flex-1 text-left text-sm",
                      todo.status === "done" ? "text-app-ink-faint line-through" : "text-app-ink",
                    )}
                  >
                    {todo.title}
                  </button>
                </li>
              ))}
              {day.timed.map((entry) => (
                <li key={`${entry.kind}-${entry.id}`} className="flex items-start gap-3 rounded-app-panel px-2 py-1.5">
                  <span className="w-14 flex-none pt-0.5 text-[11px] tabular-nums text-app-ink-faint">
                    {formatEntryTime(entry.startMinutes)}
                  </span>
                  {entry.kind === "todo" ? (
                    <TodoCheckmark
                      type="button"
                      checked={entry.todo.status === "done"}
                      align="text"
                      onClick={() => onToggleTodo(entry.todo.id)}
                      aria-label={entry.todo.status === "done" ? `Reopen ${entry.todo.title}` : `Complete ${entry.todo.title}`}
                    />
                  ) : (
                    // Same icons the timeline and week grid use: a double
                    // check marks an event that a completed todo generated,
                    // a clock marks one logged directly. A bare dot said
                    // neither.
                    <span
                      aria-hidden="true"
                      data-agenda-event-icon={isTodoCompletedEvent(entry.event) ? "completed-todo" : "logged"}
                      className="mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full bg-app-surface-muted"
                    >
                      {isTodoCompletedEvent(entry.event) ? (
                        <CheckCheck className="h-3 w-3 text-app-ink-faint" />
                      ) : (
                        <Clock3 className="h-3 w-3 text-app-ink-faint" />
                      )}
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={() => (entry.kind === "todo" ? onEditTodo(entry.todo.id) : onEditEvent(entry.event.id))}
                    className={cn(
                      "min-w-0 flex-1 text-left text-sm",
                      entry.kind === "todo" && entry.todo.status === "done"
                        ? "text-app-ink-faint line-through"
                        : "text-app-ink",
                    )}
                  >
                    {entry.kind === "todo" ? entry.todo.title : entry.event.label}
                  </button>
                </li>
              ))}
              {!day.allDayTodos.length && !day.timed.length ? (
                <li className="px-2 py-1.5 text-sm text-app-ink-faint">Nothing scheduled</li>
              ) : null}
            </ul>
          </section>
        );
      }}
    />
  );
}
