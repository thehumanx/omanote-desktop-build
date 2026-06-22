import { describe, expect, it } from "vitest";
import type { BookmarkItem, NoteItem, EventEntry, TodoItem } from "@omanote/shared";
import { LINKED_ARTIFACT_SAVED_CATEGORY_ID, buildLinkedArtifactBookmarks, isLinkedArtifactBookmarkId } from "./linked-artifact-bookmarks";

function makeNote(overrides: Partial<NoteItem>): NoteItem {
  return {
    id: "note-1",
    body: "",
    tags: [],
    createdAt: 100,
    updatedAt: 100,
    createdDateKey: "2026-04-24",
    ...overrides,
  };
}

function makeTodo(overrides: Partial<TodoItem>): TodoItem {
  return {
    id: "todo-1",
    title: "",
    priority: "normal",
    status: "open",
    createdAt: 100,
    updatedAt: 100,
    createdDateKey: "2026-04-24",
    ...overrides,
  };
}

function makeEvent(overrides: Partial<EventEntry>): EventEntry {
  return {
    id: "event-1",
    label: "",
    loggedAt: 100,
    createdAt: 100,
    createdDateKey: "2026-04-24",
    ...overrides,
  };
}

function makeBookmark(overrides: Partial<BookmarkItem>): BookmarkItem {
  return {
    id: "bookmark-1",
    categoryId: "cat-1",
    url: "https://existing.com",
    title: "existing.com",
    createdAt: 100,
    createdDateKey: "2026-04-24",
    ...overrides,
  };
}

describe("buildLinkedArtifactBookmarks", () => {
  it("creates saved-category bookmarks from notes, todos, and events", () => {
    const linked = buildLinkedArtifactBookmarks({
      notes: [makeNote({ body: "See https://note-link.com" })],
      todos: [makeTodo({ title: "todo https://todo-link.com" })],
      events: [makeEvent({ label: "event https://event-link.com" })],
      bookmarks: [],
      savedCategoryId: LINKED_ARTIFACT_SAVED_CATEGORY_ID,
    });

    expect(linked).toHaveLength(3);
    expect(linked.every((item) => item.categoryId === LINKED_ARTIFACT_SAVED_CATEGORY_ID)).toBe(true);
    expect(linked.every((item) => isLinkedArtifactBookmarkId(item.id))).toBe(true);
    expect(linked.map((item) => item.url).sort()).toEqual([
      "https://event-link.com/",
      "https://note-link.com/",
      "https://todo-link.com/",
    ]);
  });

  it("ignores deleted artifacts and URLs already saved as real bookmarks", () => {
    const linked = buildLinkedArtifactBookmarks({
      notes: [makeNote({ body: "https://existing.com", deletedAt: Date.now() })],
      todos: [makeTodo({ title: "https://existing.com" })],
      events: [makeEvent({ label: "https://new-one.com" })],
      bookmarks: [makeBookmark({ url: "https://existing.com/" })],
      savedCategoryId: LINKED_ARTIFACT_SAVED_CATEGORY_ID,
    });

    expect(linked).toHaveLength(1);
    expect(linked[0]?.url).toBe("https://new-one.com/");
  });

  it("dedupes repeated URLs and keeps the newest artifact timestamp", () => {
    const linked = buildLinkedArtifactBookmarks({
      notes: [
        makeNote({ body: "https://same.com", updatedAt: 120, createdDateKey: "2026-04-20" }),
      ],
      todos: [
        makeTodo({ title: "https://same.com", updatedAt: 200, createdDateKey: "2026-04-22" }),
      ],
      events: [],
      bookmarks: [],
      savedCategoryId: LINKED_ARTIFACT_SAVED_CATEGORY_ID,
    });

    expect(linked).toHaveLength(1);
    expect(linked[0]?.url).toBe("https://same.com/");
    expect(linked[0]?.createdAt).toBe(200);
    expect(linked[0]?.createdDateKey).toBe("2026-04-22");
    expect(linked[0]?.description).toBe("Linked in todo");
    expect(linked[0]?.linkedArtifactReferences).toHaveLength(2);
    expect(linked[0]?.linkedArtifactReferences.map((entry) => entry.kind).sort()).toEqual(["note", "todo"]);
  });

  it("supports scoped dedupe urls so non-saved bookmarks do not suppress linked entries", () => {
    const linked = buildLinkedArtifactBookmarks({
      notes: [makeNote({ body: "https://existing.com" })],
      todos: [],
      events: [],
      bookmarks: [makeBookmark({ categoryId: "movies", url: "https://existing.com/" })],
      savedCategoryId: LINKED_ARTIFACT_SAVED_CATEGORY_ID,
      dedupeUrls: [],
    });

    expect(linked).toHaveLength(1);
    expect(linked[0]?.url).toBe("https://existing.com/");
  });
});
