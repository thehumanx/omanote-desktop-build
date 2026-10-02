/**
 * One source of truth for every per-folder number on the Todos, Notes and
 * Bookmarks screens: the gallery cards, the list-mode count badges and the
 * folder sort. See docs/superpowers/specs/2026-09-30-folder-gallery-design.md.
 */
import {
  buildRecurringCompletionIndex,
  formatRelativeEditedAt,
  isClosedSeriesMaster,
  isRecurringCompletion,
  isRecurringMaster,
  occursOnDateKey,
  type BookmarkItem,
  type DateKey,
  type NoteItem,
  type RecurrenceRule,
  type TodoItem,
} from "@omanote/shared";

export type FolderStat<T> = { count: number; lastUpdated: number; items: T[] };

export function buildFolderStats<T extends { deletedAt?: number }>(
  items: readonly T[],
  keyOf: (item: T) => string | null,
  updatedAtOf: (item: T) => number,
): Map<string, FolderStat<T>> {
  const stats = new Map<string, FolderStat<T>>();
  for (const item of items) {
    if (item.deletedAt) continue;
    const key = keyOf(item);
    if (key === null) continue;
    const stat = stats.get(key);
    const updatedAt = updatedAtOf(item);
    if (stat) {
      stat.count += 1;
      stat.lastUpdated = Math.max(stat.lastUpdated, updatedAt);
      stat.items.push(item);
    } else {
      stats.set(key, { count: 1, lastUpdated: updatedAt, items: [item] });
    }
  }
  return stats;
}

/** Newest item edit in the folder, never older than the folder itself. */
export function folderLastUpdated(stat: FolderStat<unknown> | undefined, folderCreatedAt: number): number {
  return Math.max(stat?.lastUpdated ?? 0, folderCreatedAt);
}

/**
 * Done/total for a folder's progress bar. `items` must include the folder's
 * completion clones. A recurring series counts once, as done when today's
 * occurrence has a live completion clone; a series not due today (or already
 * closed) is left out, and clones never count on their own — otherwise a
 * daily habit completed 30 times reads as 30/31.
 */
export function todoFolderProgress(items: readonly TodoItem[], todayKey: DateKey): { done: number; total: number } {
  const completions = buildRecurringCompletionIndex(items);
  let done = 0;
  let total = 0;
  for (const todo of items) {
    if (todo.deletedAt || isRecurringCompletion(todo)) continue;
    if (isRecurringMaster(todo)) {
      if (isClosedSeriesMaster(todo)) continue;
      if (!occursOnDateKey(todo.recurrence as RecurrenceRule, todayKey)) continue;
      total += 1;
      if (completions.get(todo.id)?.has(todayKey)) done += 1;
      continue;
    }
    total += 1;
    if (todo.status === "done") done += 1;
  }
  return { done, total };
}

export type TodoPreviewBucket = "overdue" | "today" | "upcoming" | "undated" | "done";
const BUCKET_RANK: Record<TodoPreviewBucket, number> = { overdue: 0, today: 1, upcoming: 2, undated: 3, done: 4 };

export function todoPreviewBucket(todo: TodoItem, todayKey: DateKey): TodoPreviewBucket {
  if (todo.status === "done") return "done";
  if (!todo.dueDateKey) return "undated";
  // A series master's dueDateKey is its earliest *uncompleted* occurrence, so
  // it sits in the past whenever a day was skipped. Mirror the list
  // (getSeriesListBucket): an untimed series is never overdue — each period
  // brings a fresh occurrence — and a timed one is overdue once its day passes.
  if (isRecurringMaster(todo) && todo.dueDateKey < todayKey) return todo.dueTime ? "overdue" : "today";
  if (todo.dueDateKey < todayKey) return "overdue";
  if (todo.dueDateKey === todayKey) return "today";
  return "upcoming";
}

/**
 * Rows for a todo folder card. Pending first (overdue → today → upcoming →
 * undated); completed only when nothing is pending. `frozen` holds the
 * snapshot of any row toggled during this gallery visit — it is ordered by
 * that snapshot so the row stays put, while the live todo is what gets
 * returned (and rendered).
 */
export function todoPreviewOrder(
  items: readonly TodoItem[],
  todayKey: DateKey,
  frozen: ReadonlyMap<string, TodoItem> = new Map(),
): TodoItem[] {
  const rows = items.filter((todo) => {
    if (todo.deletedAt) return false;
    if (isRecurringCompletion(todo) && !frozen.has(todo.id)) return false;
    if (isClosedSeriesMaster(todo) && !frozen.has(todo.id)) return false;
    return true;
  });
  const sortView = (todo: TodoItem) => frozen.get(todo.id) ?? todo;
  const pendingExists = rows.some((todo) => todoPreviewBucket(sortView(todo), todayKey) !== "done");
  const visible = pendingExists ? rows.filter((todo) => todoPreviewBucket(sortView(todo), todayKey) !== "done") : rows;
  return [...visible].sort((left, right) => {
    const a = sortView(left);
    const b = sortView(right);
    const bucketDiff = BUCKET_RANK[todoPreviewBucket(a, todayKey)] - BUCKET_RANK[todoPreviewBucket(b, todayKey)];
    if (bucketDiff !== 0) return bucketDiff;
    if (a.status === "done") return (b.completedAt ?? b.updatedAt) - (a.completedAt ?? a.updatedAt);
    if (a.dueDateKey && b.dueDateKey && a.dueDateKey !== b.dueDateKey) return a.dueDateKey < b.dueDateKey ? -1 : 1;
    return b.createdAt - a.createdAt;
  });
}

export function notePreviewOrder(items: readonly NoteItem[]): NoteItem[] {
  return [...items].sort((left, right) => right.updatedAt - left.updatedAt);
}

export function bookmarkUpdatedAt(bookmark: BookmarkItem): number {
  return bookmark.updatedAt ?? bookmark.createdAt;
}

export function bookmarkPreviewOrder(items: readonly BookmarkItem[]): BookmarkItem[] {
  return [...items].sort((left, right) => bookmarkUpdatedAt(right) - bookmarkUpdatedAt(left));
}

/** A note's title, or its first non-empty body line with markdown removed. */
export function noteFirstLine(note: NoteItem): string {
  const title = note.title?.trim();
  if (title) return title;
  for (const raw of note.body.split("\n")) {
    const line = raw
      .replace(/^\s{0,3}#{1,6}\s+/, "")
      .replace(/^\s*(?:[-*+]|\d+\.)\s+(?:\[[ xX]\]\s+)?/, "")
      .replace(/^\s*>\s?/, "")
      .replace(/!?\[([^\]]*)\]\([^)]*\)/g, "$1")
      .replace(/[*_~`]+/g, "")
      .trim();
    if (line) return line;
  }
  return "";
}

export function formatFolderUpdated(timestamp: number, now: Date = new Date()): string {
  return `Updated ${formatRelativeEditedAt(timestamp, now)}`;
}

export function formatCount(count: number, singular: string, plural: string): string {
  return `${count.toLocaleString("en-US")} ${count === 1 ? singular : plural}`;
}

/**
 * While searching, a card lists the matching items first (stable within each
 * half) so the rows explain why the folder survived the filter. `extra` are
 * matching items the card's own ordering left out (e.g. completed todos
 * hidden behind pending ones), inserted after the visible matches.
 */
export function matchesFirst<T>(
  ordered: readonly T[],
  matches: ((item: T) => boolean) | undefined,
  extra: readonly T[] = [],
): { items: T[]; matchCount: number } {
  if (!matches) return { items: [...ordered], matchCount: 0 };
  const hits = ordered.filter(matches);
  const extraHits = extra.filter((item) => matches(item) && !ordered.includes(item));
  const misses = ordered.filter((item) => !matches(item));
  return { items: [...hits, ...extraHits, ...misses], matchCount: hits.length + extraHits.length };
}
