import { describe, expect, it } from "vitest";
import type { DateKey, TodoItem } from "@omanote/shared";
import { getAppProviderQueryScope, mergeTodosForState, shouldScheduleRemoteSync, shouldSyncRss } from "./AppProvider";
import { appReducer } from "./reducer";
import type { AppState } from "./types";

function makeTodo(overrides: Partial<TodoItem> = {}): TodoItem {
  return {
    id: "todo_1",
    title: "File quarterly receipts",
    dueDateKey: "2026-04-28" as DateKey,
    priority: "normal",
    status: "open",
    createdAt: 1_776_816_000_000,
    updatedAt: 1_776_816_000_000,
    createdDateKey: "2026-04-28" as DateKey,
    ...overrides,
  };
}

function makeState(todos: TodoItem[]): AppState {
  return {
    ui: {
      selectedDateKey: "2026-04-29" as DateKey,
      dateWindowOffset: 0,
      tab: "todos",
      todoFilter: "today",
      searchQuery: "",
      searchOpen: false,
      notesDrawerOpen: false,
    },
    todos,
    checklistItems: [],
    notes: [],
    deletedNotes: [],
    noteFolders: [],
    bookmarks: [],
    deletedBookmarks: [],
    bookmarkCategories: [],
    events: [],
    habits: [],
    activity: [],
    toasts: [],
  };
}

describe("mergeTodosForState", () => {
  it("hides todos that are being deleted before the server query catches up", () => {
    const todos = mergeTodosForState({
      decryptedTodos: [makeTodo({ id: "todo_1" }), makeTodo({ id: "todo_2", title: "Send weekly notes" })],
      optimisticTodos: [],
      serverTodoClientKeys: new Set(),
      deletingTodoIds: ["todo_1"],
    });

    expect(todos.map((todo) => todo.id)).toEqual(["todo_2"]);
  });

  it("hides optimistic todos that are being deleted", () => {
    const todos = mergeTodosForState({
      decryptedTodos: [],
      optimisticTodos: [
        makeTodo({ id: "client_todo_1", clientKey: "client_todo_1", pendingSync: true }),
        makeTodo({ id: "client_todo_2", clientKey: "client_todo_2", pendingSync: true }),
      ],
      serverTodoClientKeys: new Set(),
      deletingTodoIds: ["client_todo_1"],
    });

    expect(todos.map((todo) => todo.id)).toEqual(["client_todo_2"]);
  });
});

describe("todo toggle reducer", () => {
  it("uses a provided completion timestamp when marking a todo done", () => {
    const completedAt = new Date("2026-04-28T14:30:00").getTime();
    const next = appReducer(makeState([makeTodo()]), {
      type: "todo/toggle",
      todoId: "todo_1",
      completedAt,
    });

    expect(next.todos[0]?.status).toBe("done");
    expect(next.todos[0]?.completedAt).toBe(completedAt);
    expect(next.activity[0]?.timestamp).toBe(completedAt);
  });
});

describe("getAppProviderQueryScope", () => {
  it("skips deleted items and activity on the canvas route", () => {
    expect(getAppProviderQueryScope("/canvas")).toEqual({
      includeDeleted: false,
      includeActivity: false,
    });
  });

  it("includes deleted items and activity on non-canvas routes", () => {
    expect(getAppProviderQueryScope("/notes")).toEqual({
      includeDeleted: true,
      includeActivity: true,
    });
  });

  it("includes deleted items and activity on root route", () => {
    expect(getAppProviderQueryScope("/")).toEqual({
      includeDeleted: true,
      includeActivity: true,
    });
  });
});

describe("shouldSyncRss", () => {
  it("syncs RSS while the reader is enabled", () => {
    expect(shouldSyncRss({
      pathname: "/canvas",
      rssReaderEnabled: true,
    })).toBe(true);
  });

  it("syncs RSS on reader routes even before settings finish loading", () => {
    expect(shouldSyncRss({
      pathname: "/reader",
      rssReaderEnabled: false,
    })).toBe(true);
    expect(shouldSyncRss({
      pathname: "/reader/saved",
      rssReaderEnabled: false,
    })).toBe(true);
  });

  it("skips RSS on non-reader routes when the reader is disabled", () => {
    expect(shouldSyncRss({
      pathname: "/canvas",
      rssReaderEnabled: false,
    })).toBe(false);
  });
});

describe("shouldScheduleRemoteSync", () => {
  it("schedules sync when a later remote update arrives while unlocked", () => {
    expect(shouldScheduleRemoteSync({
      isAuthenticated: true,
      isLocked: false,
      previousTimestamp: 100,
      nextTimestamp: 101,
    })).toBe(true);
  });

  it("does not schedule for the initial timestamp snapshot", () => {
    expect(shouldScheduleRemoteSync({
      isAuthenticated: true,
      isLocked: false,
      previousTimestamp: null,
      nextTimestamp: 101,
    })).toBe(false);
  });

  it("does not schedule while locked or signed out", () => {
    expect(shouldScheduleRemoteSync({
      isAuthenticated: true,
      isLocked: true,
      previousTimestamp: 100,
      nextTimestamp: 101,
    })).toBe(false);
    expect(shouldScheduleRemoteSync({
      isAuthenticated: false,
      isLocked: false,
      previousTimestamp: 100,
      nextTimestamp: 101,
    })).toBe(false);
  });
});
