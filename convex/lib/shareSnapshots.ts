/**
 * Clearing the plaintext snapshots a public share leaves behind.
 *
 * Everything a user writes is encrypted client-side, but a public share has to
 * be readable by someone who has no key — so enabling one pushes a *plaintext
 * copy* of that folder's contents to the server. That is a deliberate trade,
 * but it means turning a share off has to actually remove the copy. Flipping
 * `isActive: false` alone leaves the folder's contents sitting in the database
 * in the clear, indefinitely, for a user who believes they un-shared it.
 *
 * Field lists live here rather than inline at each call site so there is one
 * place to update when a snapshot field is added — and `shareSnapshots.test.ts`
 * derives the expected set from the schema, so forgetting is a test failure
 * rather than a silent leak.
 */

import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/**
 * Snapshot fields on `sharedFolders`. The table backs both bookmark shares
 * (`snapshotBookmarks`) and todo-folder shares (`snapshotTodos`), distinguished
 * by `type` — both are cleared regardless, since a row only ever carries one.
 */
export const SHARED_FOLDER_SNAPSHOT_FIELDS = [
  "snapshotCategoryName",
  "snapshotFolderIcon",
  "snapshotBookmarks",
  "snapshotTodos",
  "snapshotUpdatedAt",
] as const satisfies readonly (keyof Doc<"sharedFolders">)[];

/** Snapshot fields on `sharedNoteFolders`. */
export const SHARED_NOTE_FOLDER_SNAPSHOT_FIELDS = [
  "snapshotFolderName",
  "snapshotFolderIcon",
  "snapshotNotes",
  "snapshotUpdatedAt",
] as const satisfies readonly (keyof Doc<"sharedNoteFolders">)[];

function clearedFields(fields: readonly string[]) {
  // Patching a field to `undefined` removes it in Convex.
  return Object.fromEntries(fields.map((field) => [field, undefined]));
}

/**
 * Deactivates a bookmark or todo folder share and drops its plaintext copy.
 * Re-enabling the share re-pushes a fresh snapshot from the client, so nothing
 * is lost by clearing here.
 */
export async function deactivateFolderShare(ctx: MutationCtx, shareId: Id<"sharedFolders">) {
  await ctx.db.patch(shareId, {
    isActive: false,
    ...clearedFields(SHARED_FOLDER_SNAPSHOT_FIELDS),
  });
}

/** Same, for note folder shares. */
export async function deactivateNoteFolderShare(
  ctx: MutationCtx,
  shareId: Id<"sharedNoteFolders">,
) {
  await ctx.db.patch(shareId, {
    isActive: false,
    ...clearedFields(SHARED_NOTE_FOLDER_SNAPSHOT_FIELDS),
  });
}
