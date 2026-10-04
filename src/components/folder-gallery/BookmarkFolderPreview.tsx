import { useState } from "react";
import { Globe } from "lucide-react";
import type { BookmarkItem } from "@omanote/shared";
import { bookmarkPreviewOrder, formatCount, formatFolderUpdated, matchesFirst } from "../../lib/folder-stats";
import { FOLDER_CARD_ROW_LIMIT, FolderGalleryCard, folderStatusMeta } from "./FolderGalleryCard";
import type { GalleryFolder } from "./types";
import { RemoteImage } from "../RemoteImage";

function domainOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function Favicon({ src }: { src?: string }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) return <Globe aria-hidden="true" className="h-4 w-4 shrink-0 text-app-ink-faint" />;
  return <RemoteImage src={src} alt="" className="h-4 w-4 shrink-0 rounded-sm object-cover" onError={() => setFailed(true)} />;
}

export function BookmarkFolderPreview({
  folder,
  items,
  matches,
  onOpen,
}: {
  folder: GalleryFolder;
  items: BookmarkItem[];
  /** Active search: matching bookmarks list first and are counted. */
  matches?: (bookmark: BookmarkItem) => boolean;
  onOpen: () => void;
}) {
  const { items: ordered, matchCount } = matchesFirst(bookmarkPreviewOrder(items), matches);
  return (
    <FolderGalleryCard
      name={folder.name}
      icon={folder.icon}
      color={folder.color}
      onIconClick={folder.onIconClick}
      editing={folder.editing}
      actions={folder.actions}
      count={items.length}
      totalCount={ordered.length}
      emptyLabel="No bookmarks yet"
      meta={[
        ...(matches ? [{ label: formatCount(matchCount, "match", "matches") }] : []),
        { label: formatFolderUpdated(folder.lastUpdated) },
        ...folderStatusMeta(folder),
      ]}
      onOpen={onOpen}
      rows={ordered.slice(0, FOLDER_CARD_ROW_LIMIT).map((bookmark) => {
        const label = bookmark.title?.trim() || domainOf(bookmark.url);
        // Only http(s) becomes a link: a stored `javascript:` URL must never be clickable.
        const safe = /^https?:\/\//i.test(bookmark.url);
        return (
          <div key={bookmark.id} className="flex min-w-0 items-center gap-2 py-0.5">
            <Favicon src={bookmark.faviconUrl?.trim() || undefined} />
            {safe ? (
              <a
                href={bookmark.url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="min-w-0 truncate text-sm text-app-ink hover:underline"
              >
                {label}
              </a>
            ) : (
              <span className="min-w-0 truncate text-sm text-app-ink">{label}</span>
            )}
          </div>
        );
      })}
    />
  );
}
