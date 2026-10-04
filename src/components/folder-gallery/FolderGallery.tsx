import { useLayoutEffect, useRef, type ReactNode } from "react";
import { useScrollEdgeFade } from "../../hooks/useScrollEdgeFade";

// Survives the gallery unmounting while a folder is open on desktop, so
// "back to gallery" lands where the user left off. Session-lifetime only.
const scrollPositions = new Map<string, number>();

type FolderGalleryProps<T> = {
  /** Scroll-restore key, one per screen. */
  storageKey: string;
  /** True until content has decrypted — shows skeletons, never an empty state. */
  loading: boolean;
  groups: { pinned: T[]; unpinned: T[]; hasPinned: boolean };
  getKey: (item: T) => string;
  renderCard: (item: T) => ReactNode;
  newFolderTile?: ReactNode;
  /**
   * Identifies the chosen sort (and search). While it is unchanged, cards keep
   * the position they first appeared in for this visit — checking off a todo
   * bumps its folder's "last updated", and re-sorting live would move the
   * card out from under the cursor. A new key re-sorts.
   */
  orderKey?: string;
};

const GRID = "grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3";

export function FolderGallery<T>({ storageKey, loading, groups, getKey, renderCard, newFolderTile, orderKey = "" }: FolderGalleryProps<T>) {
  const scrollRef = useRef<HTMLDivElement>(null);
  // The scroller runs under the bottom nav, so the bottom fade starts above it.
  const edgeFade = useScrollEdgeFade(scrollRef, { bottomSize: "calc(var(--omanote-bottom-nav-height, 64px) + 3.5rem)" });
  const positions = useRef<{ orderKey: string; index: Map<string, number> }>({ orderKey, index: new Map() });
  if (positions.current.orderKey !== orderKey) positions.current = { orderKey, index: new Map() };
  const stable = (items: T[]) => {
    const { index } = positions.current;
    for (const item of items) {
      const key = getKey(item);
      if (!index.has(key)) index.set(key, index.size);
    }
    return [...items].sort((left, right) => index.get(getKey(left))! - index.get(getKey(right))!);
  };

  useLayoutEffect(() => {
    const node = scrollRef.current;
    if (!node) return;
    node.scrollTop = scrollPositions.get(storageKey) ?? 0;
    return () => {
      scrollPositions.set(storageKey, node.scrollTop);
    };
  }, [storageKey]);

  const renderGroup = (items: T[]) =>
    stable(items).map((item) => (
      <div key={getKey(item)} className="min-w-0">
        {renderCard(item)}
      </div>
    ));

  return (
    // The breathing room above the first row lives inside the scroller, so
    // cards scroll right up to the top bar under a fade instead of clipping
    // at a padded edge.
    <div ref={scrollRef} data-testid="folder-gallery-scroll" className="scrollbar-hide min-h-0 flex-1 overflow-y-auto pt-4" style={edgeFade}>
      {loading ? (
        <div className={GRID}>
          {Array.from({ length: 6 }, (_, index) => (
            <div
              key={index}
              data-testid="folder-gallery-skeleton"
              className="h-48 animate-pulse rounded-app-card bg-app-surface-muted motion-reduce:animate-none"
            />
          ))}
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {groups.hasPinned ? (
            <div className={GRID}>
              {newFolderTile}
              {renderGroup(groups.pinned)}
            </div>
          ) : null}
          <div className={GRID}>
            {groups.hasPinned ? null : newFolderTile}
            {renderGroup(groups.unpinned)}
          </div>
        </div>
      )}
      {/* The screens are fixed to the viewport bottom, so without this the
          last row of cards would scroll no further than behind the nav. */}
      <div
        aria-hidden="true"
        data-testid="folder-gallery-bottom-inset"
        style={{ height: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)", flexShrink: 0 }}
      />
    </div>
  );
}
