// @vitest-environment edge-runtime

import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";
import { api } from "./_generated/api";
import schema from "./schema";

const modules = import.meta.glob("./**/*.*s");

describe("notes folders", () => {
  it("treats deleting an already-deleted folder as a no-op", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "notes-folder-delete-user" });
    const folderId = await asUser.mutation(api.notes.createNoteFolder, { name: "Archive" });

    await asUser.mutation(api.notes.deleteNoteFolder, { folderId });

    await expect(asUser.mutation(api.notes.deleteNoteFolder, { folderId })).resolves.toBeNull();
  });

  it("treats deleting an already-deleted folder with notes as a no-op", async () => {
    const t = convexTest(schema, modules);
    const asUser = t.withIdentity({ tokenIdentifier: "notes-folder-delete-with-notes-user" });
    const folderId = await asUser.mutation(api.notes.createNoteFolder, { name: "Projects" });

    await asUser.mutation(api.notes.deleteNoteFolderWithNotes, { folderId });

    await expect(asUser.mutation(api.notes.deleteNoteFolderWithNotes, { folderId })).resolves.toBeNull();
  });
});
