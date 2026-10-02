import type { NoteItem } from "@omanote/shared";
import { formatCount, formatFolderUpdated, matchesFirst, noteFirstLine, notePreviewOrder } from "../../lib/folder-stats";
import { FOLDER_CARD_ROW_LIMIT, FolderGalleryCard, folderStatusMeta } from "./FolderGalleryCard";
import type { GalleryFolder } from "./types";

export function NoteFolderPreview({
  folder,
  items,
  matches,
  onOpen,
  onOpenNote,
}: {
  folder: GalleryFolder;
  items: NoteItem[];
  /** Active search: matching notes list first and are counted. */
  matches?: (note: NoteItem) => boolean;
  onOpen: () => void;
  onOpenNote: (noteId: string) => void;
}) {
  const { items: ordered, matchCount } = matchesFirst(notePreviewOrder(items), matches);
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
      emptyLabel="No notes yet"
      meta={[
        ...(matches ? [{ label: formatCount(matchCount, "match", "matches") }] : []),
        { label: formatFolderUpdated(folder.lastUpdated) },
        ...folderStatusMeta(folder),
      ]}
      onOpen={onOpen}
      rows={ordered.slice(0, FOLDER_CARD_ROW_LIMIT).map((note) => (
        <button
          key={note.id}
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onOpenNote(note.id);
          }}
          className="block w-full truncate py-0.5 text-left text-sm text-app-ink hover:text-app-ink-muted"
        >
          {noteFirstLine(note) || "Untitled note"}
        </button>
      ))}
    />
  );
}
