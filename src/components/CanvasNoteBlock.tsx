import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { MouseEvent, TouchEvent } from "react";
import { Trash2, WifiOff } from "lucide-react";
import type { NoteFolder, NoteItem } from "@omanote/shared";
import type { AppAction } from "../app/types";
import { useCanvasDraftValue } from "../app/useCanvasDraftValue";
import { NoteCanvasEditor } from "./NoteCanvasEditor";
import { RichTextPreview } from "./rich-text";
import { useOutsideClick } from "../lib/useOutsideClick";
import { useIsMobileViewport } from "../lib/mobile";
import { MobileEditDrawer } from "./MobileEditDrawer";
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

  const isMobile = useIsMobileViewport();

  // On mobile the editor renders inside a MobileEditDrawer portal, so a
  // click there wouldn't register as "outside" rootRef anyway — the
  // drawer's own backdrop/drag dismissal (wired to commit()) replaces this.
  useOutsideClick(rootRef, isEditing && !isMobile, () => {
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

  const startEditingAt = (x: number, y: number, target: HTMLElement) => {
    restoreEditScrollRef.current = captureScrollSnapshot(rootRef.current ?? target);
    setInitialSelectionStart(resolveRichTextSourceOffsetFromPoint(target.ownerDocument, x, y, body));
    setIsEditing(true);
  };

  const startEditingFromClick = (event: MouseEvent<HTMLElement>) => {
    startEditingAt(event.clientX, event.clientY, event.currentTarget);
  };

  // Mobile opens editing on long-press instead of a tap, so a normal tap
  // can still be used to scroll/select without accidentally entering edit
  // mode. The click handler stays wired for non-touch activation (keyboard,
  // assistive tech) — handleTouchEnd suppresses the synthetic click that
  // would otherwise follow a genuine touch tap.
  const LONG_PRESS_MS = 450;
  const LONG_PRESS_MOVE_CANCEL_PX = 10;
  const longPressTimerRef = useRef<number | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const longPressFiredRef = useRef(false);
  // Links/popovers inside the note handle their own taps — don't hijack
  // those gestures into starting a long-press-to-edit.
  const longPressSkipRef = useRef(false);

  const clearLongPressTimer = () => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  useEffect(() => clearLongPressTimer, []);

  const handleTouchStart = (event: TouchEvent<HTMLElement>) => {
    const touch = event.touches[0];
    if (!touch) return;
    const eventTarget = event.target as HTMLElement | null;
    longPressSkipRef.current = Boolean(eventTarget?.closest('a, button, [data-rich-text-popover="true"]'));
    if (longPressSkipRef.current) return;
    longPressStartRef.current = { x: touch.clientX, y: touch.clientY };
    longPressFiredRef.current = false;
    const target = event.currentTarget;
    clearLongPressTimer();
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      longPressFiredRef.current = true;
      startEditingAt(touch.clientX, touch.clientY, target);
    }, LONG_PRESS_MS);
  };

  const handleTouchMove = (event: TouchEvent<HTMLElement>) => {
    const start = longPressStartRef.current;
    const touch = event.touches[0];
    if (!start || !touch) return;
    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.hypot(dx, dy) > LONG_PRESS_MOVE_CANCEL_PX) {
      clearLongPressTimer();
    }
  };

  const handleTouchEnd = (event: TouchEvent<HTMLElement>) => {
    clearLongPressTimer();
    // Whether this was a short tap or the long-press already fired, don't
    // let the browser's synthetic click also fire for a touch interaction —
    // except when the tap was on a link/popover, which needs its own click
    // to fire normally.
    if (!longPressSkipRef.current) {
      event.preventDefault();
    }
    longPressStartRef.current = null;
  };

  const handleTouchCancel = () => {
    clearLongPressTimer();
    longPressStartRef.current = null;
  };

  const editingInline = isEditing && !isMobile;

  const preview = (
    <div
      role={isEditing ? undefined : "button"}
      tabIndex={isEditing ? undefined : 0}
      className={
        isEditing || !isMobile
          ? "block w-full text-left"
          : "block w-full select-none text-left [-webkit-touch-callout:none]"
      }
      onClick={isEditing ? undefined : startEditingFromClick}
      onDoubleClick={isEditing ? undefined : startEditingFromClick}
      onTouchStart={isEditing || !isMobile ? undefined : handleTouchStart}
      onTouchMove={isEditing || !isMobile ? undefined : handleTouchMove}
      onTouchEnd={isEditing || !isMobile ? undefined : handleTouchEnd}
      onTouchCancel={isEditing || !isMobile ? undefined : handleTouchCancel}
    >
      <RichTextPreview
        value={renderedBody}
        className="text-[15px] leading-6 text-app-ink"
        paragraphClassName="text-[15px] leading-6 text-app-ink"
        onLinkEdit={isEditing ? undefined : setBody}
      />
      <AttachmentLinkPreview textValues={[renderedBody]} className="mt-2" />
    </div>
  );

  return (
    <div
      ref={rootRef}
      className={
        editingInline
          ? "group relative -ml-3 -mr-2 -my-1 px-2 py-1 pl-3 overflow-visible"
          : "group relative -ml-3 -mr-2 -my-1 rounded-xl px-2 py-1 pl-3 transition hover:bg-app-surface-hover focus-within:bg-app-surface-muted focus-within:ring-1 focus-within:ring-app-focus/15 before:pointer-events-none before:absolute before:inset-y-2 before:left-0 before:w-px before:rounded-full before:bg-transparent focus-within:before:bg-app-line-strong"
      }
    >
      {pendingSync && (
        <div className="absolute right-2 top-2 flex items-center justify-center rounded-full bg-app-surface-muted p-1" title="Not synced — will upload when you reconnect">
          <WifiOff className="h-2.5 w-2.5 text-app-ink-faint" />
        </div>
      )}
      {/* On mobile, editing opens in a drawer elsewhere on screen — keep
          showing the (live-updating) preview here instead of leaving this
          canvas row blank while the drawer is open. */}
      {editingInline ? null : preview}
      {isEditing ? (
        <MobileEditDrawer onClose={commit} onCancel={cancelEdit} onSave={commit} canSave={Boolean(body.trim())}>
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
            hideMobileActions={isMobile}
          />
        </MobileEditDrawer>
      ) : null}
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
