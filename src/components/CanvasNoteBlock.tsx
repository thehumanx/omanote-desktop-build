import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent } from "react";
import { Trash2, WifiOff } from "lucide-react";
import type { NoteFolder, NoteItem } from "@omanote/shared";
import type { AppAction } from "../app/types";
import { useCanvasDraftValue } from "../app/useCanvasDraftValue";
import { NoteCanvasEditor } from "./NoteCanvasEditor";
import { RichTextPreview } from "./rich-text";
import { useOutsideClick } from "../lib/useOutsideClick";
import { parseHashtags } from "../lib/hashtags";
import { AttachmentLinkPreview } from "./AttachmentLinkPreview";
import { captureScrollSnapshot, restoreScrollForNextFrames } from "../lib/preserve-focus-scroll";
import { resolveRichTextSourceOffsetFromPoint } from "../lib/rich-text-caret";
import { normalizeLegacyNoteBodyForTiptap } from "../lib/note-body-migration";

export type CanvasNoteBlockProps = {
  note: NoteItem;
  pendingSync?: boolean;
  dispatch: (action: AppAction) => void;
  noteFolders: NoteFolder[];
};

function areCanvasNoteBlockPropsEqual(prev: CanvasNoteBlockProps, next: CanvasNoteBlockProps) {
  return (
    prev.note === next.note &&
    prev.pendingSync === next.pendingSync &&
    prev.dispatch === next.dispatch &&
    prev.noteFolders === next.noteFolders
  );
}

function CanvasNoteBlockComponent({ note, pendingSync, dispatch, noteFolders }: CanvasNoteBlockProps) {
  const draftKey = `note:${note.id}:body`;
  const { value: body, setValue: setBody, clearDraft } = useCanvasDraftValue(draftKey, note.body);
  const [isEditing, setIsEditing] = useState(false);
  const [initialSelectionStart, setInitialSelectionStart] = useState<number | undefined>(undefined);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const restoreEditScrollRef = useRef<(() => void) | null>(null);
  const [folderName, setFolderName] = useState(() => {
    if (note.folderId) {
      const folder = noteFolders.find((item) => item.id === note.folderId);
      if (folder) return folder.name;
    }
    return note.folderName?.trim() ?? "";
  });

  const exactFolderMatch = useMemo(
    () => noteFolders.find((folder) => folder.name.trim().toLowerCase() === folderName.trim().toLowerCase()) ?? null,
    [folderName, noteFolders],
  );
  const renderedBody = useMemo(() => normalizeLegacyNoteBodyForTiptap(body), [body]);

  useEffect(() => {
    if (note.folderId) {
      const folder = noteFolders.find((item) => item.id === note.folderId);
      setFolderName(folder?.name ?? note.folderName?.trim() ?? "");
      return;
    }
    setFolderName(note.folderName?.trim() ?? "");
  }, [note.folderId, note.folderName, noteFolders]);

  useEffect(() => {
    if (!isEditing) return;
    setBody(note.body);
    if (note.folderId) {
      const folder = noteFolders.find((item) => item.id === note.folderId);
      setFolderName(folder?.name ?? note.folderName?.trim() ?? "");
    } else {
      setFolderName(note.folderName?.trim() ?? "");
    }
  }, [isEditing, note.body, note.folderId, note.folderName, setBody, noteFolders]);

  useOutsideClick(rootRef, isEditing, () => {
    commit();
  });

  useLayoutEffect(() => {
    if (!isEditing || !restoreEditScrollRef.current) return;
    const cleanup = restoreScrollForNextFrames(restoreEditScrollRef.current);
    restoreEditScrollRef.current = null;
    return cleanup;
  }, [isEditing]);

  const commit = () => {
    const trimmed = body.trim();
    if (!trimmed) {
      dispatch({ type: "note/delete", noteId: note.id });
      clearDraft();
      setIsEditing(false);
      return;
    }

    const nextFolderValue = folderName.trim();
    const shouldTreatAsFolder = Boolean(nextFolderValue) && !/^uncategorized$/i.test(nextFolderValue);
    dispatch({
      type: "note/update",
      noteId: note.id,
      body: trimmed,
      tags: note.tags,
      hashtags: parseHashtags(trimmed),
      folderId: exactFolderMatch?.id,
      folderName: shouldTreatAsFolder ? nextFolderValue : undefined,
    });
    clearDraft();
    setIsEditing(false);
  };

  const cancelEdit = () => {
    clearDraft();
    setIsEditing(false);
    setBody(note.body);
    if (note.folderId) {
      const folder = noteFolders.find((item) => item.id === note.folderId);
      setFolderName(folder?.name ?? note.folderName?.trim() ?? "");
    } else {
      setFolderName(note.folderName?.trim() ?? "");
    }
  };

  const startEditingFromClick = (event: MouseEvent<HTMLElement>) => {
    restoreEditScrollRef.current = captureScrollSnapshot(rootRef.current ?? event.currentTarget);
    setInitialSelectionStart(resolveRichTextSourceOffsetFromPoint(event.currentTarget.ownerDocument, event.clientX, event.clientY, body));
    setIsEditing(true);
  };

  return (
    <div
      ref={rootRef}
      className={
        isEditing
          ? "group relative -ml-3 -mr-2 -my-1 px-2 py-1 pl-3 overflow-visible"
          : "group relative -ml-3 -mr-2 -my-1 rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong"
      }
    >
      {pendingSync && (
        <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-app-surface-muted p-1" title="Not synced — will upload when you reconnect">
          <WifiOff className="h-2.5 w-2.5 text-app-ink-faint" />
        </div>
      )}
      {isEditing ? (
        <NoteCanvasEditor
          body={body}
          folderName={folderName}
          folders={noteFolders}
          autoFocus
          initialSelectionStart={initialSelectionStart}
          onBodyChange={setBody}
          onFolderNameChange={setFolderName}
          onCommit={commit}
          onCancel={cancelEdit}
        />
      ) : (
        <div
          role="button"
          tabIndex={0}
          className="block w-full text-left"
          onClick={startEditingFromClick}
          onDoubleClick={startEditingFromClick}
        >
          <RichTextPreview
            value={renderedBody}
            className="text-[15px] leading-6 text-app-ink"
            paragraphClassName="text-[15px] leading-6 text-app-ink"
            onLinkEdit={setBody}
          />
          <AttachmentLinkPreview textValues={[renderedBody]} className="mt-2" />
        </div>
      )}
      {!isEditing ? (
        <button
          type="button"
          aria-label="delete note"
          onClick={() => {
            dispatch({ type: "note/delete", noteId: note.id });
            clearDraft();
          }}
          className="absolute right-1 top-1 rounded-full p-1 text-app-line-strong opacity-0 transition group-hover:bg-app-surface group-hover:opacity-100 group-focus-within:opacity-100 hover:bg-app-surface-hover hover:text-danger-ink"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}

export const CanvasNoteBlock = memo(CanvasNoteBlockComponent, areCanvasNoteBlockPropsEqual);
