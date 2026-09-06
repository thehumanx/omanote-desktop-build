import type { DateKey } from "@omanote/shared";
import { addDays, toDateKey } from "@omanote/shared";
import type { AppState } from "./types";

/** Earliest date with any user content, falling back to `fallbackDateKey` when there's none. */
export function earliestDateKeyFromState(state: AppState, fallbackDateKey: DateKey): DateKey {
  const keys: DateKey[] = [
    ...state.todos.map((todo) => todo.createdDateKey),
    ...state.notes.map((note) => note.createdDateKey),
    ...state.deletedNotes.map((note) => note.createdDateKey),
    ...state.bookmarks.map((bookmark) => bookmark.createdDateKey),
    ...state.deletedBookmarks.map((bookmark) => bookmark.createdDateKey),
    ...state.events.map((event) => event.createdDateKey),
    ...state.pages.map((page) => page.createdDateKey),
  ].filter(Boolean);

  if (!keys.length) return fallbackDateKey;
  return keys.reduce((earliest, key) => (key < earliest ? key : earliest), keys[0]!);
}

/**
 * Every date key that has at least one (non-deleted) artifact, for the
 * history date list's visual marker and its "hide empty days" filter.
 * `pagesOnly` narrows this to canvas pages alone, for when the page-only
 * filter is active — a day with only todos/notes counts as empty there.
 */
export function buildDatesWithContentSet(state: AppState, options?: { pagesOnly?: boolean }): Set<DateKey> {
  const dates = new Set<DateKey>();
  if (options?.pagesOnly) {
    for (const page of state.pages) if (!page.deletedAt) dates.add(page.createdDateKey);
    return dates;
  }
  for (const todo of state.todos) if (!todo.deletedAt) dates.add(todo.createdDateKey);
  for (const note of state.notes) if (!note.deletedAt) dates.add(note.createdDateKey);
  for (const bookmark of state.bookmarks) if (!bookmark.deletedAt) dates.add(bookmark.createdDateKey);
  for (const event of state.events) if (!event.deletedAt) dates.add(event.createdDateKey);
  for (const page of state.pages) if (!page.deletedAt) dates.add(page.createdDateKey);
  return dates;
}

/** Every calendar day from `startKey` to `endKey` (inclusive), newest first. */
export function buildDateKeyRangeDescending(startKey: DateKey, endKey: DateKey): DateKey[] {
  const dates: DateKey[] = [];
  let cursor = new Date(`${endKey}T12:00:00`);
  const start = new Date(`${startKey}T12:00:00`);
  while (cursor >= start) {
    dates.push(toDateKey(cursor));
    cursor = addDays(cursor, -1);
  }
  return dates;
}
