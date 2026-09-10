import { toDateKey } from "@omanote/shared";
import type { DateKey, TodoItem } from "@omanote/shared";
import { parseHashtags } from "../lib/hashtags";
import { parseMentions } from "../lib/mentions";

/**
 * Pure decision and normalisation helpers lifted out of AppProvider.tsx.
 *
 * These were already exported from that file, but only so AppProvider.test.ts
 * could reach them — nothing else imported them. That is a reliable sign of a
 * seam: logic with no dependency on React, Convex, or provider state, sitting
 * inside a 3,300-line component file where it is hard to find and easy to
 * mistake for provider internals. Extracting them makes the boundary real
 * rather than implied, and gives the tests a module that matches their scope.
 *
 * Everything here must stay pure. Anything needing hooks, mutations, or
 * provider state belongs in AppProvider.tsx.
 */

/** Fills in today's date when a todo is created without an explicit due date. */
export function normalizeTodoDueInput(args: { dueDateKey?: DateKey; dueTime?: string }): {
  dueDateKey: DateKey;
  dueTime?: string;
} {
  return {
    dueDateKey: args.dueDateKey ?? toDateKey(new Date()),
    dueTime: args.dueTime?.trim() || undefined,
  };
}

/** Hashtags parsed across several text fields at once (e.g. title + notes). */
export function buildHashtagsFromText(...parts: Array<string | undefined>) {
  return parseHashtags(parts.filter((part): part is string => Boolean(part)).join(" "));
}

/** @email mentions parsed across several text fields at once. */
export function buildGuestEmailsFromText(...parts: Array<string | undefined>) {
  return parseMentions(parts.filter((part): part is string => Boolean(part)).join(" "));
}

/**
 * True when stored hashtags have fallen behind the text they were parsed from —
 * either never recorded, or missing a tag the text now contains. Case-
 * insensitive, because the catalogue stores lowercase.
 */
export function needsHashtagRepair(existing: string[] | undefined, parsed: string[]) {
  if (!parsed.length) return false;
  if (existing === undefined) return true;
  const existingSet = new Set(existing.map((tag) => tag.toLowerCase()));
  return parsed.some((tag) => !existingSet.has(tag));
}

/**
 * Combines server todos with not-yet-acknowledged optimistic ones.
 *
 * An optimistic todo is dropped once the server echoes back a row with the
 * same clientKey, otherwise it would render twice for a frame. Todos mid-delete
 * are filtered from both sides so they disappear immediately rather than
 * flickering back while the mutation is in flight.
 */
export function mergeTodosForState({
  decryptedTodos,
  optimisticTodos,
  serverTodoClientKeys,
  deletingTodoIds,
}: {
  decryptedTodos: TodoItem[];
  optimisticTodos: TodoItem[];
  serverTodoClientKeys: ReadonlySet<string>;
  deletingTodoIds: string[];
}) {
  const deletingTodoIdSet = new Set(deletingTodoIds);
  return [
    ...decryptedTodos.filter((todo) => !deletingTodoIdSet.has(todo.id)),
    ...optimisticTodos.filter(
      (optimisticTodo) =>
        !serverTodoClientKeys.has(optimisticTodo.clientKey ?? "") &&
        !deletingTodoIdSet.has(optimisticTodo.id),
    ),
  ];
}

/**
 * Narrows what the provider subscribes to for the current route. The canvas
 * needs neither deleted rows nor the activity feed, and skipping them there
 * keeps the largest queries off the app's most-visited screen.
 */
export function getAppProviderQueryScope(pathname: string) {
  const onCanvas = pathname.startsWith("/canvas");
  return {
    includeDeleted: !onCanvas,
    includeActivity: !onCanvas,
  };
}

/**
 * Whether a remote sync pass is worth scheduling. Requires an unlocked,
 * authenticated session and a server timestamp that has actually moved
 * forward — a first observation (null previous) is not a change.
 */
export function shouldScheduleRemoteSync({
  isAuthenticated,
  isLocked,
  previousTimestamp,
  nextTimestamp,
}: {
  isAuthenticated: boolean;
  isLocked: boolean;
  previousTimestamp: number | null;
  nextTimestamp: number | undefined;
}) {
  if (!isAuthenticated || isLocked) return false;
  if (previousTimestamp === null || nextTimestamp === undefined) return false;
  return nextTimestamp > previousTimestamp;
}

/**
 * RSS sync runs when the reader is enabled, or unconditionally while the user
 * is on a reader route — opening a shared feed link should work even for
 * someone who has never turned the reader on.
 */
export function shouldSyncRss({
  pathname,
  rssReaderEnabled,
}: {
  pathname: string;
  rssReaderEnabled: boolean;
}) {
  return rssReaderEnabled || pathname === "/reader" || pathname.startsWith("/reader/");
}
