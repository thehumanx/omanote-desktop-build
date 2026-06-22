// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("date-scoped content queries", () => {
  it("lists only active notes for the requested date", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "canvas-date-user" });

    const todayId = await asUser.mutation(api.notes.createNote, {
      body: "Today note",
      dateKey: "2026-05-07",
    });
    await asUser.mutation(api.notes.createNote, {
      body: "Tomorrow note",
      dateKey: "2026-05-08",
    });
    const deletedId = await asUser.mutation(api.notes.createNote, {
      body: "Deleted today note",
      dateKey: "2026-05-07",
    });
    await asUser.mutation(api.notes.deleteNote, { noteId: deletedId });

    const notes = await asUser.query(api.notes.listNotes, { dateKey: "2026-05-07" });

    expect(notes.map((note) => note._id)).toEqual([todayId]);
  });

  it("lists only active bookmarks for the requested date", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "canvas-date-user" });

    const todayId = await asUser.mutation(api.bookmarks.createBookmark, {
      createdDateKey: "2026-05-07",
      url: "https://example.com/today",
      title: "Today bookmark",
    });
    await asUser.mutation(api.bookmarks.createBookmark, {
      createdDateKey: "2026-05-08",
      url: "https://example.com/tomorrow",
      title: "Tomorrow bookmark",
    });
    const deletedId = await asUser.mutation(api.bookmarks.createBookmark, {
      createdDateKey: "2026-05-07",
      url: "https://example.com/deleted",
      title: "Deleted bookmark",
    });
    await asUser.mutation(api.bookmarks.deleteBookmark, { bookmarkId: deletedId });

    const bookmarks = await asUser.query(api.bookmarks.listBookmarks, { dateKey: "2026-05-07" });

    expect(bookmarks.map((bookmark) => bookmark._id)).toEqual([todayId]);
  });

  it("lists only active events for the requested date", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "canvas-date-user" });

    const todayId = await asUser.mutation(api.events.createEventEntry, {
      label: "Today event",
      dateKey: "2026-05-07",
      loggedAt: Date.UTC(2026, 4, 7, 12, 0, 0),
    });
    await asUser.mutation(api.events.createEventEntry, {
      label: "Tomorrow event",
      dateKey: "2026-05-08",
      loggedAt: Date.UTC(2026, 4, 8, 12, 0, 0),
    });
    const deletedId = await asUser.mutation(api.events.createEventEntry, {
      label: "Deleted event",
      dateKey: "2026-05-07",
      loggedAt: Date.UTC(2026, 4, 7, 13, 0, 0),
    });
    await asUser.mutation(api.events.deleteEventEntry, { eventId: deletedId });

    const events = await asUser.query(api.events.listEventEntries, { dateKey: "2026-05-07" });

    expect(events.map((event) => event._id)).toEqual([todayId]);
  });

  it("lists todo completion events on the client completion date", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "canvas-date-user" });

    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Submit expenses",
      createdDateKey: "2026-05-06",
      dueDateKey: "2026-05-07",
    });

    await asUser.mutation(api.todos.toggleTodo, {
      todoId,
      eventLabel: "Submitted expenses",
      eventDateKey: "2026-05-07",
    });

    await expect(asUser.query(api.events.listEventEntries, { dateKey: "2026-05-06" })).resolves.toEqual([]);
    await expect(asUser.query(api.events.listEventEntries, { dateKey: "2026-05-07" })).resolves.toEqual([
      expect.objectContaining({
        label: "Submitted expenses",
        sourceType: "todo_completed",
        sourceTodoId: todoId,
        createdDateKey: "2026-05-07",
      }),
    ]);
  });
});
