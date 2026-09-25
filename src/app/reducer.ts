import { buildRecurringCompletionIndex, getVirtualOccurrenceForDate, toDateKey } from "@omanote/shared";
import type { ActivityItem, BookmarkItem, DateKey, EventEntry, NoteItem, PageItem, TodoItem } from "@omanote/shared";
import { createInitialState } from "./demo-data";
import type { AppAction, AppState, ToastItem } from "./types";
import { prefixedRandomId } from "@omanote/shared";

function newId(prefix: string) {
  return prefixedRandomId(prefix);
}

function createActivity(params: Omit<ActivityItem, "id">): ActivityItem {
  return {
    id: newId("activity"),
    ...params,
  };
}

function createToast(input: Omit<ToastItem, "id" | "createdAt">): ToastItem {
  return {
    id: newId("toast"),
    createdAt: Date.now(),
    ...input,
  };
}

function normalizeDateKey(dateKey: DateKey) {
  return dateKey;
}

function isTodoDueOnDate(todo: TodoItem, dateKey: DateKey) {
  return todo.dueDateKey === dateKey;
}

function isTodoVisibleOnCanvas(todo: TodoItem, dateKey: DateKey) {
  if (todo.deletedAt) return false;
  return todo.createdDateKey === dateKey || isTodoDueOnDate(todo, dateKey);
}

function updateTodo(todo: TodoItem, next: Partial<TodoItem>): TodoItem {
  return {
    ...todo,
    ...next,
    updatedAt: Date.now(),
  };
}

export function appReducer(state: AppState = createInitialState(), action: AppAction): AppState {
  switch (action.type) {
    case "ui/set-selected-date":
      return {
        ...state,
        ui: {
          ...state.ui,
          selectedDateKey: normalizeDateKey(action.dateKey),
        },
      };
    case "ui/set-date-window-offset":
      return {
        ...state,
        ui: {
          ...state.ui,
          dateWindowOffset: action.offset,
        },
      };
    case "ui/set-tab":
      return {
        ...state,
        ui: {
          ...state.ui,
          tab: action.tab,
          searchOpen: false,
        },
      };
    case "ui/set-todo-filter":
      return {
        ...state,
        ui: {
          ...state.ui,
          todoFilter: action.filter,
        },
      };
    case "ui/set-search-query":
      return {
        ...state,
        ui: {
          ...state.ui,
          searchQuery: action.query,
        },
      };
    case "ui/set-search-open":
      return {
        ...state,
        ui: {
          ...state.ui,
          searchOpen: action.open,
        },
      };
    case "ui/set-notes-drawer-open":
      return {
        ...state,
        ui: {
          ...state.ui,
          notesDrawerOpen: action.open,
        },
      };
    case "ui/open-composer":
      return {
        ...state,
        ui: {
          ...state.ui,
          composerOpen: true,
          composerMode: action.mode ?? state.ui.composerMode,
          composerOpenToken: state.ui.composerOpenToken + 1,
        },
      };
    case "ui/close-composer":
      return {
        ...state,
        ui: {
          ...state.ui,
          composerOpen: false,
        },
      };
    case "todo/create": {
      const dueDateKey = action.dueDateKey ?? toDateKey(new Date());
      const todo: TodoItem = {
        id: newId("todo"),
        title: action.title,
        priority: "normal",
        status: "open",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        createdDateKey: action.dateKey,
        dueDateKey,
        dueTime: action.dueTime,
        folderId: action.folderId,
        folderName: action.folderName,
      };

      return {
        ...state,
        todos: [todo, ...state.todos],
        activity: [
          createActivity({
            module: "todo",
            action: "created",
            itemId: todo.id,
            itemTitle: todo.title,
            restorable: false,
            timestamp: todo.createdAt,
          }),
          ...state.activity,
        ],
      };
    }
    case "todo/toggle": {
      const now = Date.now();
      const todos = state.todos.map((todo) => {
        if (todo.id !== action.todoId) return todo;
        const completed = todo.status !== "done";
        const completedAt = action.completedAt ?? now;
        return updateTodo(todo, {
          status: completed ? "done" : "open",
          completedAt: completed ? completedAt : undefined,
        });
      });

      const updatedTodo = todos.find((todo) => todo.id === action.todoId);
      if (!updatedTodo) return state;

      return {
        ...state,
        todos,
        activity: [
          createActivity({
            module: "todo",
            action: updatedTodo.status === "done" ? "completed" : "edited",
            itemId: updatedTodo.id,
            itemTitle: updatedTodo.title,
            restorable: false,
            timestamp: updatedTodo.status === "done" ? (updatedTodo.completedAt ?? now) : now,
          }),
          ...state.activity,
        ],
      };
    }
    case "todo/delete": {
      const todos = state.todos.map((todo) => {
        if (todo.id !== action.todoId) return todo;
        return updateTodo(todo, { deletedAt: Date.now() });
      });
      const deletedTodo = todos.find((todo) => todo.id === action.todoId);
      if (!deletedTodo) return state;
      return {
        ...state,
        todos,
        activity: [
          createActivity({
            module: "todo",
            action: "deleted",
            itemId: deletedTodo.id,
            itemTitle: deletedTodo.title,
            restorable: true,
            timestamp: Date.now(),
          }),
          ...state.activity,
        ],
      };
    }
    case "todo/restore": {
      const restored = state.todos.map((todo) => {
        if (todo.id !== action.todoId || !todo.deletedAt) return todo;
        return updateTodo(todo, { deletedAt: undefined });
      });

      return {
        ...state,
        todos: restored,
        activity: [
          createActivity({
            module: "todo",
            action: "edited",
            itemId: action.todoId,
            itemTitle: restored.find((todo) => todo.id === action.todoId)?.title ?? "Restored todo",
            restorable: false,
            timestamp: Date.now(),
          }),
          ...state.activity,
        ],
      };
    }
    case "todo/update": {
      const dueDateKey = action.dueDateKey ?? toDateKey(new Date());
      const todos = state.todos.map((todo) =>
        todo.id === action.todoId
          ? updateTodo(todo, {
              title: action.title,
              dueDateKey,
              dueTime: action.dueTime,
              folderId: action.folderId,
              folderName: action.folderName,
              reminderFiredAt: undefined,
            })
          : todo,
      );

      const nextTodo = todos.find((todo) => todo.id === action.todoId);
      if (!nextTodo) return state;

      return {
        ...state,
        todos,
        activity: [
          createActivity({
            module: "todo",
            action: "edited",
            itemId: nextTodo.id,
            itemTitle: nextTodo.title,
            diff: JSON.stringify(action),
            restorable: false,
            timestamp: Date.now(),
          }),
          ...state.activity,
        ],
      };
    }
    case "todo/snooze": {
      const nextDue = new Date();
      nextDue.setMinutes(nextDue.getMinutes() + action.minutes);
      const nextDueDateKey = toDateKey(nextDue);
      const nextDueTime = `${String(nextDue.getHours()).padStart(2, "0")}:${String(nextDue.getMinutes()).padStart(2, "0")}`;

      const todos = state.todos.map((todo) =>
        todo.id === action.todoId
          ? updateTodo(todo, {
              dueDateKey: nextDueDateKey,
              dueTime: nextDueTime,
              reminderFiredAt: undefined,
            })
          : todo,
      );

      const nextTodo = todos.find((todo) => todo.id === action.todoId);
      if (!nextTodo) return state;

      return {
        ...state,
        todos,
        activity: [
          createActivity({
            module: "todo",
            action: "snoozed",
            itemId: nextTodo.id,
            itemTitle: nextTodo.title,
            diff: JSON.stringify({ minutes: action.minutes }),
            restorable: false,
            timestamp: Date.now(),
          }),
          ...state.activity,
        ],
      };
    }
    case "todo/mark-fired": {
      const todos = state.todos.map((todo) =>
        todo.id === action.todoId ? updateTodo(todo, { reminderFiredAt: action.timestamp }) : todo,
      );
      const target = todos.find((todo) => todo.id === action.todoId);
      if (!target) return state;
      return {
        ...state,
        todos,
        activity: [
          createActivity({
            module: "todo",
            action: "fired",
            itemId: target.id,
            itemTitle: target.title,
            restorable: false,
            timestamp: action.timestamp,
          }),
          ...state.activity,
        ],
      };
    }
    case "note/create":
      const noteId = newId("note");
      const noteTitle = action.body.split("\n")[0]?.trim() || "Untitled note";
      return {
        ...state,
        notes: [
          {
            id: noteId,
            title: noteTitle,
            body: action.body,
            tags: [],
            folderId: action.folderId,
            folderName: action.folderName?.trim() || undefined,
            createdAt: Date.now(),
            updatedAt: Date.now(),
            createdDateKey: action.dateKey,
          },
          ...state.notes,
        ],
        activity: [
          createActivity({
            module: "note",
            action: "created",
            itemId: noteId,
            itemTitle: noteTitle,
            restorable: false,
            timestamp: Date.now(),
          }),
          ...state.activity,
        ],
      };
    case "bookmark/create":
      const bookmarkId = newId("bookmark");
      let bookmarkTitle = action.url;
      let bookmarkUrl = action.url;
      try {
        const parsed = new URL(action.url);
        bookmarkTitle = parsed.hostname.replace(/^www\./, "");
        bookmarkUrl = parsed.toString();
      } catch {
        bookmarkTitle = action.url;
      }
      return {
        ...state,
        bookmarks: [
          {
            id: bookmarkId,
            categoryId: state.bookmarkCategories[0]?.id ?? newId("cat"),
            url: bookmarkUrl,
            title: bookmarkTitle,
            description: action.url,
            createdAt: Date.now(),
            createdDateKey: action.dateKey,
          },
          ...state.bookmarks,
        ],
        activity: [
          createActivity({
            module: "bookmark",
            action: "created",
            itemId: bookmarkId,
            itemTitle: bookmarkTitle,
            restorable: false,
            timestamp: Date.now(),
          }),
          ...state.activity,
        ],
      };
    case "event/create":
      const eventId = newId("event");
      return {
        ...state,
        events: [
          {
            id: eventId,
            label: action.label,
            loggedAt: action.loggedAt ?? Date.now(),
            createdAt: Date.now(),
            createdDateKey: action.dateKey,
          },
          ...state.events,
        ],
        activity: [
          createActivity({
            module: "event",
            action: "created",
            itemId: eventId,
            itemTitle: action.label,
            restorable: false,
            timestamp: Date.now(),
          }),
          ...state.activity,
        ],
      };
    case "todo/prompt-recurring-delete":
      return { ...state, recurringDeletePrompt: action.prompt };
    case "todo/close-recurring-delete":
      return { ...state, recurringDeletePrompt: null };
    case "toast/add":
      return {
        ...state,
        toasts: [action.toast, ...state.toasts],
      };
    case "toast/remove":
      return {
        ...state,
        toasts: state.toasts.filter((toast) => toast.id !== action.toastId),
      };
    default:
      return state;
  }
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
      if (occurrence) visible.push(occurrence);
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
  /** Set on a row that is here because it was *edited* today, not created today. */
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
 *
 * Two ways in:
 *
 * 1. **Created** that day — todos (including recurring occurrences), notes,
 *    bookmarks, events, canvases.
 * 2. **Edited** that day, having been created earlier. Adding "apple" to a
 *    paragraph written ten days ago is work done today, and the day feed is
 *    the record of a day's work, so it belongs here — rendered in full, with
 *    an `edited` flag the UI badges. The original stays on its own day too;
 *    this is an additional appearance, not a move.
 *
 * An artifact never appears twice on one day: anything already present via (1)
 * — or via a due date, for todos — is skipped by (2).
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
