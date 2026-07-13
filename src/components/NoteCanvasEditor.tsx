import { createPortal } from "react-dom";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import type { NoteFolder } from "@omanote/shared";
import { normalizeLinkUrl } from "@omanote/shared";
import { TiptapRichTextToolbar } from "./rich-text";
import { NoteFolderPicker } from "./NoteFolderPicker";
import { hasMeaningfulNoteInput, isUncategorizedFolderName, resolveNoteFolderByName, writeLastNoteFolder } from "../lib/note-folder-utils";
import { MobileSaveButton } from "./MobileSaveButton";
import { HashtagPickerDropdown } from "./HashtagPicker";
import { EmojiPickerDropdown } from "./EmojiPicker";
import { X } from "lucide-react";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { SaveShortcutHint } from "./settings/SaveShortcutHint";
import { useMobileKeyboardState } from "./layout/useMobileKeyboardState";
import { BulletAfterBreakExtension, HashtagDecorationExtension, MarkdownNoIndentCodeExtension, buildListAwareMarkdown, useTiptapHashtagPicker, useTiptapEmojiPicker } from "../lib/tiptap-note";
import { normalizeLegacyNoteBodyForTiptap } from "../lib/note-body-migration";
import { TiptapLinkPopover } from "./TiptapLinkPopover";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { splitBlock } from "@tiptap/pm/commands";

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

function getToolbarStyle(shellRect: DOMRect, toolbarHeight: number, placement: "above" | "below") {
  const top =
    placement === "above"
      ? Math.max(12, shellRect.top - toolbarHeight - 8)
      : shellRect.bottom + 8;
  return { left: shellRect.left, top };
}

export function NoteCanvasEditor({
  body,
  folderName,
  folders,
  autoFocus = false,
  initialSelectionStart,
  placeholder = "Write your note here",
  onBodyChange,
  onFolderNameChange,
  onCommit,
  onCancel,
  onPastePlainText,
  hideFolderPicker = false,
  suppressToolbar = false,
  suppressToolbarOnMobile = false,
}: {
  body: string;
  folderName: string;
  folders: NoteFolder[];
  autoFocus?: boolean;
  initialSelectionStart?: number;
  placeholder?: string;
  onBodyChange: (nextValue: string) => void;
  onFolderNameChange: (nextValue: string) => void;
  onCommit: (payload: { body: string; folderId?: string; folderName?: string }) => void;
  onCancel?: () => void;
  onPastePlainText?: (url: string) => void;
  hideFolderPicker?: boolean;
  suppressToolbar?: boolean;
  suppressToolbarOnMobile?: boolean;
}) {
  const [bodyFocused, setBodyFocused] = useState(false);
  const [toolbarStyle, setToolbarStyle] = useState<CSSProperties | null>(null);
  const mobileKeyboard = useMobileKeyboardState();
  const shellRef = useRef<HTMLDivElement | null>(null);
  const toolbarRef = useRef<HTMLDivElement | null>(null);
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
    extensions: [
      StarterKit.configure({
        heading: false,
        blockquote: false,
        horizontalRule: false,
        codeBlock: false,
        link: false,
        code: {
          HTMLAttributes: {
            class: "rounded bg-app-surface-muted px-1.5 py-0.5 font-mono text-[0.92em] text-app-ink",
          },
        },
      }),
      Link.configure({
        openOnClick: false,
        enableClickSelection: true,
        HTMLAttributes: {
          class: "rounded-sm font-bold text-app-ink underline decoration-2 decoration-zinc-300 underline-offset-2 transition hover:decoration-zinc-900",
          rel: "noreferrer",
          target: "_blank",
        },
      }),
      Placeholder.configure({ placeholder }),
      Markdown.configure({ html: false, breaks: true }),
      HashtagDecorationExtension,
      MarkdownNoIndentCodeExtension,
      BulletAfterBreakExtension,
    ],
    content: normalizeLegacyNoteBodyForTiptap(body),
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown().replace(/\\\n/g, "\n");
      onBodyChange(markdown);
    },
    onFocus: () => setBodyFocused(true),
    onBlur: () => setBodyFocused(false),
    editorProps: {
      attributes: {
        class: "omanote-note-editor relative block w-full text-[15px] leading-6 text-app-ink caret-app-ink outline-none",
      },
      handleKeyDown: (_view, event) => {
        if (hashtagHandlerRef.current(event)) return true;
        if (emojiHandlerRef.current(event)) return true;

        if (event.key === "Enter") {
          // Always support Cmd/Ctrl+Enter as an explicit save action.
          if ((event.metaKey || event.ctrlKey) && !event.shiftKey && !event.altKey) {
            event.preventDefault();
            commitRef.current();
            return true;
          }
          const { $from } = _view.state.selection;
          let inListItem = false;
          for (let d = $from.depth; d >= 0; d--) {
            if ($from.node(d).type.name === "listItem") { inListItem = true; break; }
          }
          if (inListItem) return false;

          if (event.shiftKey) {
            // Shift+Enter => hard line break inside current paragraph.
            return false;
          }

          // Enter => new paragraph.
          event.preventDefault();
          splitBlock(_view.state, _view.dispatch);
          return true;
        }

        if (event.key === "Escape") {
          event.preventDefault();
          onCancelRef.current?.();
          return true;
        }

        return false;
      },
      handlePaste: (view, event) => {
        const plainText = event.clipboardData?.getData("text/plain") ?? "";

        // URL pasted onto a selection → wrap selection in a link.
        if (!view.state.selection.empty) {
          const href = normalizeLinkUrl(plainText);
          if (href) {
            editor?.chain().focus().setLink({ href }).run();
            return true;
          }
        }

        if (view.state.doc.textContent.trim() === "") {
          const normalizedUrl = normalizeLinkUrl(plainText);
          if (normalizedUrl) {
            onPastePlainText?.(normalizedUrl);
            return true;
          }
        }

        // Real HTML lists already paste correctly — don't interfere.
        const html = event.clipboardData?.getData("text/html") ?? "";
        if (/<(ul|ol|li)\b/i.test(html)) return false;

        // Convert bullet/indented plain text into a proper markdown list.
        const listMarkdown = buildListAwareMarkdown(plainText);
        if (listMarkdown && editor) {
          editor.chain().focus().insertContent(listMarkdown).run();
          return true;
        }

        return false;
      },
    },
  });

  const hashtagPicker = useTiptapHashtagPicker(editor);
  hashtagHandlerRef.current = hashtagPicker.handleKeyDown;
  const emojiPicker = useTiptapEmojiPicker(editor);
  emojiHandlerRef.current = emojiPicker.handleKeyDown;

  const showToolbar = !suppressToolbar && !(suppressToolbarOnMobile && mobileKeyboard.isMobileViewport) && (bodyFocused || body.trim().length > 0);

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

  const updateToolbarPosition = useCallback(() => {
    if (!showToolbar || !shellRef.current || !toolbarRef.current) return;
    const shellRect = shellRef.current.getBoundingClientRect();
    const toolbarHeight = toolbarRef.current.getBoundingClientRect().height;
    const availableAbove = shellRect.top - 12;
    const availableBelow = window.innerHeight - shellRect.bottom - 12;
    const placement = toolbarHeight > availableAbove && availableBelow > availableAbove ? "below" : "above";
    setToolbarStyle({ ...getToolbarStyle(shellRect, toolbarHeight, placement), visibility: "visible" });
  }, [showToolbar]);

  useLayoutEffect(() => {
    if (!showToolbar) { setToolbarStyle(null); return; }
    setToolbarStyle((current) => current ?? { left: 0, top: 0, visibility: "hidden" });
    updateToolbarPosition();
  }, [body, bodyFocused, showToolbar, updateToolbarPosition]);

  useEffect(() => {
    if (!showToolbar) return;
    window.addEventListener("scroll", updateToolbarPosition, true);
    window.addEventListener("resize", updateToolbarPosition);
    return () => {
      window.removeEventListener("scroll", updateToolbarPosition, true);
      window.removeEventListener("resize", updateToolbarPosition);
    };
  }, [showToolbar, updateToolbarPosition]);

  return (
    <div ref={shellRef} className="relative z-20 overflow-visible">
      {showToolbar && typeof document !== "undefined"
        ? createPortal(
            <div
              ref={toolbarRef}
              data-omanote-ignore-outside-click="true"
              className="fixed z-app-floating rounded-full border border-app-line bg-app-surface/95 p-1 shadow-soft backdrop-blur"
              style={toolbarStyle ?? { left: 0, top: 0, visibility: "hidden" }}
            >
              <TiptapRichTextToolbar editor={editor} className="flex-nowrap" />
            </div>,
            document.body,
          )
        : null}

      <div ref={editorWrapperRef} className="relative">
        <EditorContent editor={editor} />
        <TiptapLinkPopover editor={editor} wrapperRef={editorWrapperRef} />
        <HashtagPickerDropdown
          isOpen={hashtagPicker.isOpen}
          suggestions={hashtagPicker.suggestions}
          activeIndex={hashtagPicker.activeIndex}
          onSelect={hashtagPicker.selectSuggestion}
          onHover={hashtagPicker.setActiveIndex}
          anchorRef={editorWrapperRef}
          anchorRect={hashtagPicker.anchorRect}
        />
        <EmojiPickerDropdown
          isOpen={emojiPicker.isOpen}
          suggestions={emojiPicker.suggestions}
          activeIndex={emojiPicker.activeIndex}
          onSelect={emojiPicker.selectSuggestion}
          onHover={emojiPicker.setActiveIndex}
          anchorRef={editorWrapperRef}
          anchorRect={emojiPicker.anchorRect}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        {showFolderPicker ? <NoteFolderPicker folders={folders} value={folderName} onChange={onFolderNameChange} /> : <div />}
        <div className="flex items-center gap-2">
          <SaveShortcutHint className="hidden md:inline" />
          {(!mobileKeyboard.isMobileViewport || mobileKeyboard.keyboardOpen) ? (
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
