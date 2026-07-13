import { useEffect, useMemo, useRef, useState } from "react";
import type { NoteFolder, NoteItem } from "@omanote/shared";
import { normalizeLinkUrl } from "@omanote/shared";
import { Button, Input } from "./ui";
import { TiptapRichTextToolbar } from "./rich-text";
import { NoteFolderPicker } from "./NoteFolderPicker";
import { NoteCanvasEditor } from "./NoteCanvasEditor";
import { hasMeaningfulNoteInput, isUncategorizedFolderName, readLastNoteFolder, resolveNoteFolderByName, writeLastNoteFolder } from "../lib/note-folder-utils";
import { HashtagPickerDropdown } from "./HashtagPicker";
import { EmojiPickerDropdown } from "./EmojiPicker";
import { parseHashtags } from "../lib/hashtags";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { isSaveShortcutEvent } from "../lib/editor-shortcuts";
import { SaveShortcutHint } from "./settings/SaveShortcutHint";
import { BulletAfterBreakExtension, HashtagDecorationExtension, MarkdownNoIndentCodeExtension, buildListAwareMarkdown, useTiptapHashtagPicker, useTiptapEmojiPicker } from "../lib/tiptap-note";
import { normalizeLegacyNoteBodyForTiptap } from "../lib/note-body-migration";
import { TiptapLinkPopover } from "./TiptapLinkPopover";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import { splitBlock } from "@tiptap/pm/commands";

function tagsToInput(tags: string[]) {
  return tags.join(", ");
}

function tagsFromInput(input: string) {
  return input
    .split(",")
    .map((tag) => tag.trim())
    .filter(Boolean);
}

export function NoteInlineEditor({
  note,
  folders,
  selectedFolderId,
  defaultFolderName,
  autoFocus = false,
  initialSelectionStart,
  showTags = true,
  layout = "card",
  hideFolderPicker = false,
  saveOnOutsideClick = false,
  persistRecentFolderOnSave = false,
  suppressToolbar = false,
  onSave,
  onCancel,
  onDelete,
}: {
  note?: NoteItem | null;
  folders: NoteFolder[];
  selectedFolderId?: string | null;
  defaultFolderName?: string;
  autoFocus?: boolean;
  initialSelectionStart?: number;
  showTags?: boolean;
  layout?: "card" | "canvas";
  hideFolderPicker?: boolean;
  saveOnOutsideClick?: boolean;
  persistRecentFolderOnSave?: boolean;
  suppressToolbar?: boolean;
  onSave: (payload: { body: string; tags: string[]; hashtags: string[]; folderName?: string; folderId?: string }) => void;
  onCancel?: () => void;
  onDelete?: () => void;
}) {
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

  const [body, setBody] = useState(normalizeLegacyNoteBodyForTiptap(note?.body ?? ""));
  const [tags, setTags] = useState(tagsToInput(note?.tags ?? []));
  const [folderName, setFolderName] = useState(resolvedInitialFolderName);
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
      Placeholder.configure({ placeholder: "Write your note here" }),
      Markdown.configure({ html: false, breaks: true }),
      HashtagDecorationExtension,
      MarkdownNoIndentCodeExtension,
      BulletAfterBreakExtension,
    ],
    content: normalizeLegacyNoteBodyForTiptap(body),
    onUpdate: ({ editor }) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const markdown = (editor.storage as any).markdown.getMarkdown().replace(/\\\n/g, "\n");
      setBody(markdown);
    },
    editorProps: {
      attributes: {
        class: "omanote-note-editor relative block w-full min-h-[140px] text-[15px] leading-7 text-app-ink caret-app-ink outline-none",
      },
      handleKeyDown: (_view, event) => {
        if (hashtagHandlerRef.current(event)) return true;
        if (emojiHandlerRef.current(event)) return true;

        if (event.key === "Enter") {
          if ((event.metaKey || event.ctrlKey) && isSaveShortcutEvent(event, settingsRef.current.saveShortcut)) {
            event.preventDefault();
            commitRef.current();
            return true;
          }
          // Inside a list: let Tiptap handle list behavior.
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
    autofocus: autoFocus ? "end" : false,
  });

  const hashtagPicker = useTiptapHashtagPicker(editor);
  hashtagHandlerRef.current = hashtagPicker.handleKeyDown;
  const emojiPicker = useTiptapEmojiPicker(editor);
  emojiHandlerRef.current = emojiPicker.handleKeyDown;

  const canSave = Boolean(body.trim());
  const showFolderPicker = hasMeaningfulNoteInput(body);
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
  };
  commitRef.current = commit;

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

  const handleCanvasBlur = (event: React.FocusEvent<HTMLDivElement>) => {
    if (!saveOnOutsideClick) return;
    const relatedTarget = event.relatedTarget;
    if (relatedTarget instanceof Node && rootRef.current?.contains(relatedTarget)) return;
    if (relatedTarget instanceof Element && relatedTarget.closest("[data-omanote-ignore-outside-click='true']")) return;
    commit();
  };

  return (
    layout === "canvas" ? (
      <div ref={rootRef} className="relative z-20" onBlur={handleCanvasBlur}>
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
          hideFolderPicker={hideFolderPicker}
          suppressToolbar={suppressToolbar}
        />
      </div>
    ) : (
      <div ref={rootRef} className="rounded-xl border border-app-line bg-app-surface">
        <div className="border-b border-app-line bg-app-surface/95 px-3 py-2 backdrop-blur">
          <TiptapRichTextToolbar editor={editor} className="flex-nowrap" />
        </div>
        <div ref={editorWrapperRef} className="relative px-3 py-3">
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
          {!hideFolderPicker && showFolderPicker ? <NoteFolderPicker folders={folders} value={folderName} onChange={setFolderName} /> : null}
          <SaveShortcutHint />
          <Button disabled={!canSave} onClick={commit}>
            Save
          </Button>
          {onCancel ? (
            <Button tone="ghost" onClick={onCancel}>
              Cancel
            </Button>
          ) : null}
          {onDelete ? (
            <Button tone="ghost" className="ml-auto text-app-ink-muted" onClick={onDelete}>
              Delete
            </Button>
          ) : null}
        </div>
      </div>
    )
  );
}

// Type import for the ref
type TiptapHashtagPickerState = ReturnType<typeof useTiptapHashtagPicker>;
type TiptapEmojiPickerState = ReturnType<typeof useTiptapEmojiPicker>;
