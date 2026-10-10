import { buildRecurringCompletionIndex, getSeriesStartPreview, getVirtualOccurrenceForDate, toDateKey } from "@omanote/shared";
import type { BookmarkItem, DateKey, EventEntry, NoteItem, PageItem, TodoItem } from "@omanote/shared";
import type { AppState } from "./types";

// The day feed: which artifacts belong to a canvas day. Lived in reducer.ts
// beside a demo-era reducer nothing ran any more (deleted 2026-10-09).

function isTodoVisibleOnCanvas(todo: TodoItem, dateKey: DateKey) {
  if (todo.deletedAt) return false;
  return todo.createdDateKey === dateKey || todo.dueDateKey === dateKey;
}

function getVisibleCanvasTodos(
  state: AppState,
  dateKey: DateKey,
  // The completion index is date-independent; callers rendering many days can
  // build it once (buildRecurringCompletionIndex) and pass it in to avoid
  // rescanning all todos per day.
  completionIndex: Map<string, Set<string>> = buildRecurringCompletionIndex(state.todos),
) {
  const todayKey = toDateKey(new Date());
  const visible: TodoItem[] = [];
  for (const todo of state.todos) {
    // A checklist item written inside a page lives there, not in the day
    // feed too — see PageScreen / usePageArtifactSync. It still shows in
    // Todos under its folder; this only keeps it out of the duplicate.
    if (todo.pageId) continue;
    // Series masters never render directly — each canvas day gets a virtual
    // occurrence when the rule fires there (daily on every day, weekly on
    // every 7th, …). Materialized completions render via the normal path.
    if (todo.recurrence) {
      const occurrence = getVirtualOccurrenceForDate(
        todo,
        completionIndex.get(todo.id),
        dateKey,
        todayKey,
      );
      if (occurrence) {
        visible.push(occurrence);
      } else {
        // Not firing here, but created here and not started yet: shown like a
        // future todo so the series isn't invisible until its first date.
        const preview = getSeriesStartPreview(todo, dateKey);
        if (preview) visible.push(preview);
      }
      continue;
    }
    if (isTodoVisibleOnCanvas(todo, dateKey)) visible.push(todo);
  }
  return visible;
}

export type CanvasArtifactItem = {
  /**
   * Where this row sits in the day's chronology: creation time for something
   * created today, last-edit time for something older that was edited today.
   * Named `sortAt` rather than `createdAt` precisely because of that second
   * case — an edited row's position is not its creation time, and calling the
   * field `createdAt` would have quietly made it lie.
   */
  sortAt: number;
} & (
  | { kind: "todo"; data: TodoItem }
  | { kind: "note"; data: NoteItem }
  | { kind: "bookmark"; data: BookmarkItem }
  | { kind: "event"; data: EventEntry }
  | { kind: "page"; data: PageItem }
);

/**
 * Every artifact belonging to `dateKey`, sorted chronologically. Shared by the
 * canvas (today) and history (any day) screens.
 * An artifact belongs to the day it was created — todos (including recurring
 * occurrences) also to the day they're due.
 */
export function buildCanvasDayItems(
  state: AppState,
  dateKey: DateKey,
  completionIndex: Map<string, Set<string>> = buildRecurringCompletionIndex(state.todos),
): CanvasArtifactItem[] {
  const todoItems: CanvasArtifactItem[] = getVisibleCanvasTodos(state, dateKey, completionIndex).map((todo) => ({
    kind: "todo",
    sortAt: todo.createdAt,
    data: todo,
  }));
  const noteItems: CanvasArtifactItem[] = state.notes
    .filter((note) => note.createdDateKey === dateKey)
    .map((note) => ({ kind: "note", sortAt: note.createdAt, data: note }));
  // Same as todos above: a link block's bookmark row stays inside its page.
  const bookmarkItems: CanvasArtifactItem[] = state.bookmarks
    .filter((bookmark) => bookmark.createdDateKey === dateKey && !bookmark.pageId)
    .map((bookmark) => ({ kind: "bookmark", sortAt: bookmark.createdAt, data: bookmark }));
  const eventItems: CanvasArtifactItem[] = state.events
    .filter((event) => !event.deletedAt && event.createdDateKey === dateKey)
    .map((event) => ({ kind: "event", sortAt: event.createdAt, data: event }));
  // Canvases file under the day they were created, like notes — editing one
  // later must not *move* it to another day's feed (it gets an additional
  // "edited" row there instead, below).
  const pageItems: CanvasArtifactItem[] = state.pages
    .filter((page) => !page.deletedAt && page.createdDateKey === dateKey)
    .map((page) => ({ kind: "page", sortAt: page.createdAt, data: page }));

  // Created that day, and only that day.
  //
  // A previous version also resurfaced older artifacts *edited* on this day,
  // as a second row flagged "EDITED". Removed 2026-09-22: it made the feed
  // hostage to anything that touched `updatedAt` for non-content reasons. A
  // folder rename, for instance, cascades a denormalized `folderName` onto
  // every todo in that folder and bumps each row's `updatedAt` — which this
  // read as "the user edited 173 todos today" and dumped the lot onto the
  // canvas. That cascade can't stop bumping (the bump is what drives
  // incremental sync), so the feed stopped listening instead.
  //
  // `updatedAt` is a sync timestamp, not a record of user intent, and it was
  // being used as both. If edited rows come back, drive them off the activity
  // log (`state.activity`), which records real user actions.
  return [...todoItems, ...noteItems, ...bookmarkItems, ...eventItems, ...pageItems].sort(
    (left, right) => left.sortAt - right.sortAt,
  );
}
