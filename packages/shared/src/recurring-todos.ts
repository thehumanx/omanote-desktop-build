import type { DateKey, TodoItem } from "./domain";
import {
  nextOccurrenceOnOrAfter,
  occursOnDateKey,
  previousOccurrenceOnOrBefore,
  type RecurrenceRule,
} from "./recurrence";

/**
 * Client-side expansion of recurring todo series into per-day occurrences.
 *
 * A series is one master row (`todo.recurrence` set). Occurrences are never
 * materialized ahead of time; each canvas day asks "does this series fire
 * here?". Completing an occurrence materializes a done clone row
 * (`todo.recurringSourceId` -> master) which renders like a normal todo, so
 * this module only synthesizes the *uncompleted* occurrences.
 *
 * Occurrence states:
 *  - "live":     the current period's occurrence — the one a completion
 *                attributes to (today's for daily, this week's for weekly …).
 *  - "missed":   a past occurrence whose period rolled over uncompleted.
 *  - "upcoming": a future occurrence, shown on future canvas days.
 */
export type OccurrenceState = "live" | "missed" | "upcoming";

/**
 * Virtual occurrences of every recurring series that fall on the given
 * calendar dates (e.g. a visible calendar week). Dates already covered by a
 * materialized completion are skipped. Used by surfaces that render a range
 * of days at once (the Event calendar).
 */
export function listVirtualOccurrencesForDates(
  todos: readonly TodoItem[],
  dateKeys: readonly string[],
  todayKey: DateKey,
): (TodoItem & { occurrenceState: OccurrenceState })[] {
  const completionIndex = buildRecurringCompletionIndex(todos);
  const result: (TodoItem & { occurrenceState: OccurrenceState })[] = [];
  for (const todo of todos) {
    if (!todo.recurrence || todo.deletedAt) continue;
    const completed = completionIndex.get(todo.id);
    for (const dateKey of dateKeys) {
      const occurrence = getVirtualOccurrenceForDate(todo, completed, dateKey as DateKey, todayKey);
      if (occurrence) result.push(occurrence);
    }
  }
  return result;
}

const VIRTUAL_ID_SEPARATOR = "::";

export function makeVirtualOccurrenceId(masterId: string, dateKey: string): string {
  return `${masterId}${VIRTUAL_ID_SEPARATOR}${dateKey}`;
}

export function parseVirtualOccurrenceId(id: string): { masterId: string; dateKey: DateKey } | null {
  const index = id.indexOf(VIRTUAL_ID_SEPARATOR);
  if (index === -1) return null;
  const masterId = id.slice(0, index);
  const dateKey = id.slice(index + VIRTUAL_ID_SEPARATOR.length);
  if (!masterId || !/^\d{4}-\d{2}-\d{2}$/.test(dateKey)) return null;
  return { masterId, dateKey: dateKey as DateKey };
}

export function isRecurringMaster(todo: Pick<TodoItem, "recurrence">): boolean {
  return Boolean(todo.recurrence);
}

export function isRecurringCompletion(todo: Pick<TodoItem, "recurringSourceId">): boolean {
  return Boolean(todo.recurringSourceId);
}

/**
 * Which occurrence dates of each series already have a materialized
 * completion. Soft-deleted clones don't count (they were un-completed).
 */
export function buildRecurringCompletionIndex(todos: readonly TodoItem[]): Map<string, Set<string>> {
  const index = new Map<string, Set<string>>();
  for (const todo of todos) {
    if (!todo.recurringSourceId || todo.deletedAt || !todo.dueDateKey) continue;
    let dates = index.get(todo.recurringSourceId);
    if (!dates) {
      dates = new Set();
      index.set(todo.recurringSourceId, dates);
    }
    dates.add(todo.dueDateKey);
  }
  return index;
}

/**
 * The occurrence a completion should attribute to right now: the latest
 * occurrence on or before today, or — when the series starts in the future —
 * its first occurrence.
 */
export function getLiveOccurrenceDateKey(master: TodoItem, todayKey: DateKey): DateKey | null {
  if (!master.recurrence) return null;
  const rule = master.recurrence as RecurrenceRule;
  return previousOccurrenceOnOrBefore(rule, todayKey) ?? nextOccurrenceOnOrAfter(rule, todayKey);
}

export type TodoListBucket = "today" | "overdue" | "upcoming" | "completed";

/**
 * Which list bucket a recurring series master belongs in, or null when it
 * shouldn't appear as a series row (not recurring, or a closed/exhausted
 * master whose final completion clone already represents it).
 *
 * The master's `dueDateKey` already tracks the earliest uncompleted
 * occurrence, so it drives bucketing directly:
 *  - future dueDateKey      -> upcoming (series not yet started, or today's
 *                              occurrence already completed)
 *  - untimed, due today/past -> today (a fresh occurrence each period; an
 *                              untimed recurring todo is never "overdue")
 *  - timed                  -> today before its time, overdue once it passes
 */
export function getSeriesListBucket(master: TodoItem, now: Date): TodoListBucket | null {
  if (!master.recurrence || master.deletedAt || master.status !== "open" || !master.dueDateKey) return null;
  const todayKey = toDateKeyLocal(now);
  if (master.dueDateKey > todayKey) return "upcoming";
  if (!master.dueTime) return "today";
  const dueAt = combineDateKeyAndTimeLocal(master.dueDateKey, master.dueTime);
  return now.getTime() < dueAt ? "today" : "overdue";
}

/** Should this closed/exhausted series master be hidden from the list entirely? */
export function isClosedSeriesMaster(todo: TodoItem): boolean {
  return Boolean(todo.recurrence) && todo.status === "done";
}

// Local date/time helpers kept chrono-free so this module stays importable
// from any runtime (mirrors dates.ts / date-utils.ts semantics).
function toDateKeyLocal(date: Date): DateKey {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}` as DateKey;
}

function combineDateKeyAndTimeLocal(dateKey: string, time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    Number(dateKey.slice(0, 4)),
    Number(dateKey.slice(5, 7)) - 1,
    Number(dateKey.slice(8, 10)),
    hour,
    minute,
    0,
    0,
  ).getTime();
}

export function getOccurrenceStateForDate(
  master: TodoItem,
  dateKey: DateKey,
  todayKey: DateKey,
): OccurrenceState {
  if (dateKey > todayKey) return "upcoming";
  const rule = master.recurrence as RecurrenceRule;
  const liveKey = previousOccurrenceOnOrBefore(rule, todayKey);
  return dateKey === liveKey && master.status === "open" ? "live" : "missed";
}

/**
 * Synthesize the uncompleted occurrence of a series for one canvas day, or
 * null when the series doesn't fire there / the day is already covered by a
 * materialized completion. The returned TodoItem is virtual: its id encodes
 * master + date and must be routed to complete/uncomplete-occurrence
 * mutations, never to plain todo mutations.
 */
export function getVirtualOccurrenceForDate(
  master: TodoItem,
  completedDates: ReadonlySet<string> | undefined,
  dateKey: DateKey,
  todayKey: DateKey,
): (TodoItem & { occurrenceState: OccurrenceState }) | null {
  // A closed/exhausted master (status done) no longer spawns occurrences —
  // its completion clones stand on their own.
  if (!master.recurrence || master.deletedAt || master.status === "done") return null;
  if (!occursOnDateKey(master.recurrence as RecurrenceRule, dateKey)) return null;
  if (completedDates?.has(dateKey)) return null;
  return {
    ...master,
    id: makeVirtualOccurrenceId(master.id, dateKey),
    createdDateKey: dateKey,
    dueDateKey: dateKey,
    status: "open",
    completedAt: undefined,
    occurrenceState: getOccurrenceStateForDate(master, dateKey, todayKey),
  };
}
