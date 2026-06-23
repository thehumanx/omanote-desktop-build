import { toDateKey } from "@omanote/shared";
import type { ActivityItem, DateKey, TodoItem } from "@omanote/shared";
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

export function getVisibleCanvasTodos(state: AppState, dateKey: DateKey) {
  return state.todos.filter((todo) => isTodoVisibleOnCanvas(todo, dateKey));
}

export function hydrateState(raw: AppState | null) {
  if (!raw) return createInitialState();
  return raw;
}
