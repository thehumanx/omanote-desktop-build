import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { NoteFolder } from "@omanote/shared";
import { cn } from "./ui";
import { NoteFolderPicker } from "./NoteFolderPicker";
import { hasMeaningfulNoteInput, isUncategorizedFolderName, resolveNoteFolderByName, writeLastNoteFolder } from "../lib/note-folder-utils";
import { MobileSaveButton } from "./MobileSaveButton";
import { X } from "lucide-react";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { useMobileKeyboardState } from "./layout/useMobileKeyboardState";
import { useTiptapHashtagPicker, useTiptapEmojiPicker } from "../lib/tiptap-note";
import { handleNoteEditorKeyDown, handleNoteEditorPaste, noteEditorExtensions, readNoteMarkdown } from "../lib/note-editor-config";
import { NoteEditorOverlays } from "./NoteEditorOverlays";
import { normalizeLegacyNoteBodyForTiptap } from "../lib/note-body-migration";
import { useEditor, EditorContent } from "@tiptap/react";

/** Module scope so the defaults stay referentially stable across renders. */
const EMPTY_NOTE_FOLDERS: NoteFolder[] = [];
const noop = () => {};

function findScrollParent(el: HTMLElement): { scrollBy: (delta: number) => void } {
  let node: HTMLElement | null = el.parentElement;
  while (node && node !== document.documentElement) {
    const { overflowY } = getComputedStyle(node);
    if (/(auto|scroll)/.test(overflowY)) {
      return { scrollBy: (delta) => { node!.scrollTop += delta; } };
    }
    node = node.parentElement;
  }
  return { scrollBy: (delta) => window.scrollBy({ top: delta }) };
}

export function NoteCanvasEditor({
  body,
  folderName = "",
  folders = EMPTY_NOTE_FOLDERS,
  autoFocus = false,
  initialSelectionStart,
  placeholder = "Write your note here",
  onBodyChange,
  onFolderNameChange = noop,
  onCommit,
  onCancel,
  onPastePlainText,
  hideFolderPicker = false,
  // Callers that render their own Save/Cancel elsewhere for mobile (e.g. a
  // shared drawer header) set this so this component's own bottom-row
  // buttons don't also show, duplicating them.
  hideMobileActions = false,
}: {
  body: string;
  /** Only meaningful while the picker is shown, i.e. when composing a new
   *  note — editing an existing one never offers to move it (see
   *  `hideFolderPicker`). */
  folderName?: string;
  folders?: NoteFolder[];
  autoFocus?: boolean;
  initialSelectionStart?: number;
  placeholder?: string;
  onBodyChange: (nextValue: string) => void;
  onFolderNameChange?: (nextValue: string) => void;
  onCommit: (payload: { body: string; folderId?: string; folderName?: string }) => void;
  onCancel?: () => void;
  onPastePlainText?: (url: string) => void;
  hideFolderPicker?: boolean;
  hideMobileActions?: boolean;
}) {
  const [bodyFocused, setBodyFocused] = useState(false);
  const mobileKeyboard = useMobileKeyboardState();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const editorWrapperRef = useRef<HTMLDivElement | null>(null);
  const prevBodyHeightRef = useRef(0);
  useUserSettings();

  const folderValue = folderName.trim();
  const folderExactMatch = useMemo(() => resolveNoteFolderByName(folders, folderName), [folderName, folders]);
  const showFolderPicker = !hideFolderPicker && hasMeaningfulNoteInput(body);
  const canSave = Boolean(body.trim());

  // Stable refs for keydown closures
  const onCancelRef = useRef<(() => void) | undefined>(undefined);
  onCancelRef.current = onCancel;
  const hashtagHandlerRef = useRef<TiptapHashtagPickerState["handleKeyDown"]>(() => false);
  const emojiHandlerRef = useRef<TiptapEmojiPickerState["handleKeyDown"]>(() => false);

  const commit = useCallback(() => {
    const trimmed = body.trim();
    if (!trimmed) return;
    const nextFolderValue = folderValue;
    const shouldTreatAsFolder = Boolean(nextFolderValue) && !isUncategorizedFolderName(nextFolderValue);
    if (shouldTreatAsFolder) writeLastNoteFolder(nextFolderValue);
    onCommit({
      body: trimmed,
      folderId: folderExactMatch?.id,
      folderName: shouldTreatAsFolder ? nextFolderValue : undefined,
    });
  }, [body, folderValue, folderExactMatch, onCommit]);

  const commitRef = useRef(commit);
  commitRef.current = commit;

  const editor = useEditor({
    extensions: noteEditorExtensions(placeholder),
    content: normalizeLegacyNoteBodyForTiptap(body),
    onUpdate: ({ editor }) => onBodyChange(readNoteMarkdown(editor)),
    onFocus: () => setBodyFocused(true),
    onBlur: () => setBodyFocused(false),
    editorProps: {
      attributes: {
        class: "omanote-note-editor relative block w-full text-[15px] leading-6 text-app-ink caret-app-ink outline-none",
      },
      handleKeyDown: (view, event) =>
        handleNoteEditorKeyDown(view, event, {
          pickerHandlers: [hashtagHandlerRef.current, emojiHandlerRef.current],
          commit: () => commitRef.current(),
          cancel: onCancelRef.current,
        }),
      handlePaste: (view, event): boolean => handleNoteEditorPaste(view, event, editor, onPastePlainText),
    },
  });

  const hashtagPicker = useTiptapHashtagPicker(editor);
  hashtagHandlerRef.current = hashtagPicker.handleKeyDown;
  const emojiPicker = useTiptapEmojiPicker(editor);
  emojiHandlerRef.current = emojiPicker.handleKeyDown;

  // Auto-focus with optional initial selection
  useEffect(() => {
    if (!autoFocus || !editor) return;
    const raf = requestAnimationFrame(() => {
      // The editor can be destroyed between scheduling and this frame firing
      if (editor.isDestroyed) return;
      if (initialSelectionStart !== undefined) {
        // Best-effort map of text offset → ProseMirror position
        const doc = editor.state.doc;
        let targetPos = doc.content.size;
        let textOffset = 0;
        let found = false;
        doc.descendants((node, pos) => {
          if (found) return false;
          if (node.isText && node.text) {
            const end = textOffset + node.text.length;
            if (initialSelectionStart >= textOffset && initialSelectionStart <= end) {
              targetPos = pos + (initialSelectionStart - textOffset);
              found = true;
              return false;
            }
            textOffset = end;
          } else if (node.isBlock && pos > 0) {
            textOffset += 1;
          }
          return !found;
        });
        editor.commands.setTextSelection(targetPos);
      }
      editor.commands.focus(initialSelectionStart === undefined ? "end" : undefined);
    });
    return () => cancelAnimationFrame(raf);
  }, [autoFocus, editor]);

  // Keep editor content in sync with upstream body (e.g. opening existing notes)
  // while preserving intended blank-line spacing across markdown round-trips.
  useEffect(() => {
    if (!editor || editor.isDestroyed) return;
    const next = normalizeLegacyNoteBodyForTiptap(body);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const current = ((editor.storage as any).markdown?.getMarkdown?.() as string | undefined)?.replace(/\\\n/g, "\n") ?? "";
    if (current === next) return;
    editor.commands.setContent(next, { emitUpdate: false });
  }, [body, editor]);

  // Scroll-into-view when editor grows (mirrors the old textarea autoResize logic)
  useEffect(() => {
    if (!shellRef.current) return;
    const observer = new ResizeObserver(() => {
      if (!shellRef.current) return;
      const newHeight = shellRef.current.getBoundingClientRect().height;
      const prevHeight = prevBodyHeightRef.current;
      prevBodyHeightRef.current = newHeight;
      if (prevHeight === 0 || newHeight <= prevHeight) return;
      const navHeightRaw = getComputedStyle(document.documentElement).getPropertyValue("--omanote-bottom-nav-height");
      const navHeight = Number.parseFloat(navHeightRaw) || 80;
      const rect = shellRef.current.getBoundingClientRect();
      const visibleBottom = window.innerHeight - navHeight - 28;
      if (rect.bottom <= visibleBottom) return;
      findScrollParent(shellRef.current).scrollBy(rect.bottom - visibleBottom);
    });
    observer.observe(shellRef.current);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={shellRef} className="relative z-20 overflow-visible">
      <div ref={editorWrapperRef} className="relative">
        <EditorContent editor={editor} />
<NoteEditorOverlays editor={editor} wrapperRef={editorWrapperRef} hashtagPicker={hashtagPicker} emojiPicker={emojiPicker} />
      </div>

      {/* The top margin belongs to the folder picker. With the picker hidden
          (editing an existing note) this row has no desktop content left, so
          it must add no height either — otherwise edit mode sits taller than
          view mode, which renders no such row at all. The save hint used to
          live here and was what made that gap visible. */}
      <div className={cn(showFolderPicker && "mt-3", "flex flex-wrap items-center gap-3")}>
        {showFolderPicker ? <NoteFolderPicker folders={folders} value={folderName} onChange={onFolderNameChange} /> : null}
        <div className="ml-auto flex items-center gap-2">
          {!hideMobileActions && (!mobileKeyboard.isMobileViewport || mobileKeyboard.keyboardOpen) ? (
            <>
              {onCancel && (
                <button
                  type="button"
                  aria-label="Cancel"
                  onClick={onCancel}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-app-line bg-app-surface-muted text-app-ink-muted transition hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98] md:hidden"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
              <MobileSaveButton disabled={!canSave} onClick={commit} />
            </>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type TiptapHashtagPickerState = ReturnType<typeof useTiptapHashtagPicker>;
type TiptapEmojiPickerState = ReturnType<typeof useTiptapEmojiPicker>;
