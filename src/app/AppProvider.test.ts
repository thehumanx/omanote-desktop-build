import { describe, expect, it } from "vitest";
import type { DateKey, TodoItem } from "@omanote/shared";
import { getAppProviderQueryScope, mergeTodosForState, shouldScheduleRemoteSync, shouldSyncRss } from "./AppProvider";

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
