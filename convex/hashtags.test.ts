// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("hashtags", () => {
  it("does not list hashtags whose only artifact was deleted", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "hashtags-test-user" });

    const noteId = await asUser.mutation(api.notes.createNote, {
      body: "A note with #ghost",
      tags: [],
      dateKey: "2026-04-29",
    });

    await expect(asUser.query(api.hashtags.listAllUserHashtags, {})).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ nameLower: "ghost" })]),
    );

    await asUser.mutation(api.notes.deleteNote, { noteId });

    await expect(asUser.query(api.hashtags.listAllUserHashtags, {})).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ nameLower: "ghost" })]),
    );
    await expect(asUser.query(api.hashtags.getHashtagUsage, { name: "ghost" })).resolves.toMatchObject({
      notes: [],
      todos: [],
      events: [],
    });
  });

  it("does not return hashtag usages for notes deleted with their folder", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "hashtags-folder-test-user" });

    await asUser.mutation(api.notes.createNote, {
      body: "Folder note #archive",
      tags: [],
      folderName: "Archive",
      dateKey: "2026-04-29",
    });
    const [note] = await asUser.query(api.notes.listNotes, {});

    expect(note.folderId).toBeTruthy();

    await asUser.mutation(api.notes.deleteNoteFolderWithNotes, { folderId: note.folderId! });

    await expect(asUser.query(api.hashtags.getHashtagUsage, { name: "archive" })).resolves.toMatchObject({
      notes: [],
      todos: [],
      events: [],
    });
    await expect(asUser.query(api.hashtags.listAllUserHashtags, {})).resolves.not.toEqual(
      expect.arrayContaining([expect.objectContaining({ nameLower: "archive" })]),
    );
  });

  it("restores hashtag usages when restoring a deleted note", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "hashtags-restore-note-user" });

    const noteId = await asUser.mutation(api.notes.createNote, {
      body: "A note with #phoenix",
      tags: [],
      dateKey: "2026-04-29",
    });

    await asUser.mutation(api.notes.deleteNote, { noteId });
    await asUser.mutation(api.notes.restoreNote, { noteId });

    await expect(asUser.query(api.hashtags.listAllUserHashtags, {})).resolves.toEqual(
      expect.arrayContaining([expect.objectContaining({ nameLower: "phoenix" })]),
    );
    await expect(asUser.query(api.hashtags.getHashtagUsage, { name: "phoenix" })).resolves.toMatchObject({
      notes: [expect.objectContaining({ artifactId: noteId })],
    });
  });

  it("restores hashtag usages when restoring a deleted todo", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "hashtags-restore-todo-user" });

    const todoId = await asUser.mutation(api.todos.createTodo, {
      title: "Finish #comeback",
      createdDateKey: "2026-04-29",
      hashtags: ["comeback"],
    });

    await asUser.mutation(api.todos.deleteTodo, { todoId });
    await asUser.mutation(api.todos.restoreTodo, { todoId });

    await expect(asUser.query(api.hashtags.getHashtagUsage, { name: "comeback" })).resolves.toMatchObject({
      todos: [expect.objectContaining({ artifactId: todoId })],
    });
  });

  it("restores hashtag usages when restoring a deleted event", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "hashtags-restore-event-user" });

    const eventId = await asUser.mutation(api.events.createEventEntry, {
      label: "Launch #return",
      loggedAt: Date.UTC(2026, 3, 29, 9),
      hashtags: ["return"],
    });

    await asUser.mutation(api.events.deleteEventEntry, { eventId });
    await asUser.mutation(api.events.restoreEventEntry, { eventId });

    await expect(asUser.query(api.hashtags.getHashtagUsage, { name: "return" })).resolves.toMatchObject({
      events: [expect.objectContaining({ artifactId: eventId })],
    });
  });
});
