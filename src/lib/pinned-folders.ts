/**
 * Splitting a folder list into its pinned and unpinned halves.
 *
 * Lives here rather than in each screen because all three folder lists
 * (Notes, Todos, Bookmarks) render the same two-group shape, and each of
 * them renders it twice — once as the desktop rail's rows and once as the
 * mobile grid's cards.
 */

type PinnedFolderGroups<T> = {
  pinned: T[];
  unpinned: T[];
  /** False when nothing is pinned — the caller then renders one flat, unlabelled list. */
  hasPinned: boolean;
};

/**
 * Partitions in place, **preserving the caller's existing order within each
 * group**. That is what makes the user's chosen sort (alphabetical / last
 * updated / count, ascending or descending) keep applying among several
 * pinned folders instead of pinning silently reordering them.
 *
 * `isPinned` is a predicate rather than a fixed `.pinned` read so the Notes
 * screen can pass it — its rows are derived view-models keyed by folder name,
 * not the `NoteFolder` rows themselves, and a synthetic "Uncategorized" row
 * has no folder behind it at all.
 */
export function groupByPinned<T>(items: T[], isPinned: (item: T) => boolean): PinnedFolderGroups<T> {
  const pinned: T[] = [];
  const unpinned: T[] = [];
  for (const item of items) {
    (isPinned(item) ? pinned : unpinned).push(item);
  }
  return { pinned, unpinned, hasPinned: pinned.length > 0 };
}
