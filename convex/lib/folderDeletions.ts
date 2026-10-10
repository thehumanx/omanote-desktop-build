import type { MutationCtx } from "../_generated/server";

/**
 * Folders and categories are hard-deleted, and sync only pages rows whose
 * `updatedAt` moved — a row that no longer exists can't be paged. So other
 * devices never learned a folder was gone and kept showing it (filing into it
 * then failed with "Folder not found"). Every hard delete of a folder-like row
 * also writes one of these; clients sync them like any table and drop the
 * local row. See src/app/sync.ts, `syncDeletedFolders`.
 */
export type DeletedFolderTable = "todoFolders" | "noteFolders" | "bookmarkCategories" | "rssCategories";

export async function recordFolderDeletion(
  ctx: MutationCtx,
  userId: string,
  table: DeletedFolderTable,
  folderId: string,
): Promise<void> {
  await ctx.db.insert("deletedFolders", { userId, table, folderId, updatedAt: Date.now() });
}
