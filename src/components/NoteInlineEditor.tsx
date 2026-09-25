import { forwardRef, useEffect, useImperativeHandle, useMemo, useRef, useState, type RefObject } from "react";
import { useCanvasDraftValue } from "../app/useCanvasDraftValue";
import type { NoteFolder, NoteItem } from "@omanote/shared";
import { Button, Input } from "./ui";
import { NoteCanvasEditor } from "./NoteCanvasEditor";
import { isUncategorizedFolderName, readLastNoteFolder, resolveNoteFolderByName, writeLastNoteFolder } from "../lib/note-folder-utils";
import { parseHashtags } from "../lib/hashtags";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { isSaveKeyEvent } from "../lib/editor-shortcuts";
import { useOutsideClick } from "../lib/useOutsideClick";
import { useTiptapHashtagPicker, useTiptapEmojiPicker } from "../lib/tiptap-note";
import { handleNoteEditorKeyDown, handleNoteEditorPaste, noteEditorExtensions, readNoteMarkdown } from "../lib/note-editor-config";
import { NoteEditorOverlays } from "./NoteEditorOverlays";
import { normalizeLegacyNoteBodyForTiptap } from "../lib/note-body-migration";
import { useEditor, EditorContent } from "@tiptap/react";

function tagsToInput(tags: string[]) {
  return tags.join(", ");
}

function tagsFromInput(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export type NoteInlineEditorHandle = { commit: () => void };

export const NoteInlineEditor = forwardRef<NoteInlineEditorHandle, {
  note?: NoteItem | null;
  folders: NoteFolder[];
  selectedFolderId?: string | null;
  defaultFolderName?: string;
  autoFocus?: boolean;
  initialSelectionStart?: number;
  showTags?: boolean;
  layout?: "card" | "canvas";
  // Suppresses NoteCanvasEditor's own built-in mobile Cancel/Save row —
  // for callers (like NoteEditorModal) that render their own header with
  // those same actions and would otherwise show both.
  hideMobileActions?: boolean;
  saveOnOutsideClick?: boolean;
  // The "outside" a click has to land to count as dismissing/saving (see
  // useOutsideClick below). Defaults to this component's own root, which is
  // right when nothing wraps it, but a caller that renders its own padding
  // or chrome around this editor (e.g. NotesScreen's row wrapper) needs
  // "outside" to mean outside *that whole surface* — otherwise a click on
  // the caller's own wrapper padding (visually still "the note") reads as
  // an outside click and saves/closes on what looks like a normal click.
  outsideClickContainerRef?: RefObject<HTMLElement | null>;
  persistRecentFolderOnSave?: boolean;
  onSave: (payload: { body: string; tags: string[]; hashtags: string[]; folderName?: string; folderId?: string }) => void;
  onCancel?: () => void;
  onDelete?: () => void;
  // Lets a caller mirror canSave into its own externally-rendered Save
  // button (see hideMobileActions above) instead of relying on the
  // built-in one.
  onCanSaveChange?: (canSave: boolean) => void;
}>(function NoteInlineEditor({
  note,
  folders,
  selectedFolderId,
  defaultFolderName,
  autoFocus = false,
  initialSelectionStart,
  showTags = true,
  layout = "card",
  hideMobileActions = false,
  saveOnOutsideClick = false,
  outsideClickContainerRef,
  persistRecentFolderOnSave = false,
  onSave,
  onCancel,
  onDelete,
  onCanSaveChange,
}, ref) {
  const resolvedInitialFolderName = useMemo(() => {
    if (note?.folderId) {
      const folder = folders.find((item) => item.id === note.folderId);
      if (folder) return folder.name;
    }
    if (note) return note.folderName ?? "";
    if (defaultFolderName !== undefined) return defaultFolderName;
    if (selectedFolderId) {
      const folder = folders.find((item) => item.id === selectedFolderId);
      if (folder) return folder.name;
    }
    return readLastNoteFolder() ?? "";
  }, [defaultFolderName, folders, note?.folderId, note?.folderName, selectedFolderId]);

  // Persisted rather than plain `useState`: this editor backs both the inline
  // note row and NoteEditorModal, and closing the device with either open
  // used to lose everything typed. `CanvasNoteBlock` already persisted its
  // body under `note:<id>:body`, so that key is reused here — the two edit
  // the same note and an unsaved draft should follow it between them.
  const draftKey = note?.id ? `note:${note.id}` : "note:new";
  const { value: body, setValue: setBody, clearDraft: clearBodyDraft } =
    useCanvasDraftValue(`${draftKey}:body`, normalizeLegacyNoteBodyForTiptap(note?.body ?? ""));
  const { value: tags, setValue: setTags, clearDraft: clearTagsDraft } =
    useCanvasDraftValue(`${draftKey}:tags`, tagsToInput(note?.tags ?? []));
  const { value: folderName, setValue: setFolderName, clearDraft: clearFolderDraft } =
    useCanvasDraftValue(`${draftKey}:folder`, resolvedInitialFolderName);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const { settings } = useUserSettings();

  // Stable refs so handleKeyDown closures always call the latest commit/cancel
  const commitRef = useRef<() => void>(() => undefined);
  const onCancelRef = useRef<(() => void) | undefined>(undefined);
  const settingsRef = useRef(settings);
  settingsRef.current = settings;
  onCancelRef.current = onCancel;

  const hashtagHandlerRef = useRef<TiptapHashtagPickerState["handleKeyDown"]>(() => false);
  const emojiHandlerRef = useRef<TiptapEmojiPickerState["handleKeyDown"]>(() => false);

  const editor = useEditor({
    extensions: noteEditorExtensions("Write your note here"),
    content: normalizeLegacyNoteBodyForTiptap(body),
    onUpdate: ({ editor }) => setBody(readNoteMarkdown(editor)),
    editorProps: {
      attributes: {
        class: "omanote-note-editor relative block w-full min-h-[140px] text-[15px] leading-7 text-app-ink caret-app-ink outline-none",
      },
      handleKeyDown: (view, event) =>
        handleNoteEditorKeyDown(view, event, {
          pickerHandlers: [hashtagHandlerRef.current, emojiHandlerRef.current],
          commit: () => commitRef.current(),
          cancel: onCancelRef.current,
        }),
      handlePaste: (view, event): boolean => handleNoteEditorPaste(view, event, editor),
    },
    autofocus: autoFocus ? "end" : false,
  });

  const hashtagPicker = useTiptapHashtagPicker(editor);
  hashtagHandlerRef.current = hashtagPicker.handleKeyDown;
  const emojiPicker = useTiptapEmojiPicker(editor);
  emojiHandlerRef.current = emojiPicker.handleKeyDown;

  const canSave = Boolean(body.trim());
  const exactFolderMatch = resolveNoteFolderByName(folders, folderName);

  const commit = () => {
    if (!canSave) return;
    const folderValue = folderName.trim();
    const shouldTreatAsFolder = Boolean(folderValue) && !isUncategorizedFolderName(folderValue);
    if (persistRecentFolderOnSave && shouldTreatAsFolder) writeLastNoteFolder(folderValue);
    const trimmedBody = body.trim();
    onSave({
      body: trimmedBody,
      tags: tagsFromInput(tags),
      hashtags: parseHashtags(trimmedBody),
      folderId: exactFolderMatch?.id,
      folderName: shouldTreatAsFolder ? folderValue : undefined,
    });
    // Saved content stops being a draft. The write itself is durable via the
    // outbox, so clearing here can't lose anything — whereas leaving it would
    // resurrect the pre-save text next time this note is opened.
    clearBodyDraft();
    clearTagsDraft();
    clearFolderDraft();
  };
  commitRef.current = commit;

  useImperativeHandle(ref, () => ({ commit }), [commit]);

  useEffect(() => {
    onCanSaveChange?.(canSave);
  }, [canSave, onCanSaveChange]);

  // Sync editor content when note changes (e.g. switching notes)
  useEffect(() => {
    const newBody = normalizeLegacyNoteBodyForTiptap(note?.body ?? "");
    setBody(newBody);
    setTags(tagsToInput(note?.tags ?? []));
    setFolderName(resolvedInitialFolderName);
    if (editor && !editor.isDestroyed) {
      editor.commands.setContent(newBody, { emitUpdate: false });
    }
  }, [note, resolvedInitialFolderName]);

  // Click-based (not blur-based) so a click that lands on a non-focusable
  // part of the editor's own chrome (padding, the folder-picker footer)
  // doesn't get misread as "left the editor" — that click never moves focus
  // anywhere, which used to leave `relatedTarget` null and made the old
  // blur handler treat it as an outside click, closing and saving on what
  // was really just a second click on the same note.
  useOutsideClick(outsideClickContainerRef ?? rootRef, saveOnOutsideClick, commit);

  return (
    layout === "canvas" ? (
      <div ref={rootRef} className="relative z-20">
        <NoteCanvasEditor
          body={body}
          folderName={folderName}
          folders={folders}
          autoFocus={autoFocus}
          initialSelectionStart={initialSelectionStart}
          onBodyChange={(nextValue) => setBody(nextValue)}
          onFolderNameChange={(nextValue) => setFolderName(nextValue)}
          onCommit={commit}
          onCancel={onCancel}
          // Always hidden, never a prop: every editor reached through this
          // component is editing an *existing* note, and editing a note must
          // not offer to move it between folders. Composing a new note goes
          // through CanvasDraftBlock, which omits this so the picker shows.
          hideFolderPicker
          hideMobileActions={hideMobileActions}
        />
      </div>
    ) : (
      <div ref={rootRef} className="rounded-xl border border-app-line bg-app-surface">
        <div ref={editorWrapperRef} className="relative px-3 py-3">
          <EditorContent editor={editor} />
  <NoteEditorOverlays editor={editor} wrapperRef={editorWrapperRef} hashtagPicker={hashtagPicker} emojiPicker={emojiPicker} />
        </div>
        <div className="flex flex-wrap items-center gap-2 border-t border-app-line px-3 py-2">
          {showTags ? (
            <Input
              value={tags}
              onChange={(event) => setTags(event.target.value)}
              placeholder="Tags, comma separated"
              className="min-w-[220px] flex-1"
            />
          ) : (
            <div className="flex-1" />
          )}
          <Button disabled={!canSave} onClick={commit}>
            Save
          </Button>
          {onCancel ? (
            <Button variant="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {onDelete ? (
            <Button variant="ghost" className="ml-auto text-app-ink-muted" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    )
  );
});

// Type import for the ref
type TiptapHashtagPickerState = ReturnType<typeof useTiptapHashtagPicker>;
type TiptapEmojiPickerState = ReturnType<typeof useTiptapEmojiPicker>;
