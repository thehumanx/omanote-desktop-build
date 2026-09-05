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

/**
 * Snapshot fields on `sharedPages`.
 *
 * `publishedImages` belongs here: it describes the plaintext copies that exist
 * only because the share does, so it has to be cleared alongside the rest of
 * the snapshot. The caller deletes the objects themselves first — see
 * `deactivatePageShare`.
 */
export const SHARED_PAGE_SNAPSHOT_FIELDS = [
  "snapshotTitle",
  "snapshotBlocks",
  "snapshotUpdatedAt",
  "publishedImages",
] as const satisfies readonly (keyof Doc<"sharedPages">)[];

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

/**
 * Same, for canvas shares.
 *
 * Returns the public keys of the plaintext image copies this share had
 * published, which the caller is expected to hand back to the client so it can
 * delete them from R2. Convex cannot do that itself — the objects live behind
 * the page-images worker, which authorises deletes against the owner's Clerk
 * token — so the row is cleared here and the bytes are removed by whoever
 * called the mutation.
 *
 * Clearing the row regardless of whether that cleanup succeeds is deliberate:
 * the share going dark is the part that must not be allowed to fail. A missed
 * object is a leaked copy of something the user already chose to publish; a
 * share that stays live because cleanup errored is a revocation that silently
 * did nothing.
 */
export async function deactivatePageShare(
  ctx: MutationCtx,
  shareId: Id<"sharedPages">,
): Promise<string[]> {
  const share = await ctx.db.get(shareId);
  const publishedKeys = share?.publishedImages?.map((image) => image.publicKey) ?? [];
  await ctx.db.patch(shareId, {
    isActive: false,
    ...clearedFields(SHARED_PAGE_SNAPSHOT_FIELDS),
  });
  return publishedKeys;
}
