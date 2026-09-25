import { normalizeLinkUrl } from "@omanote/shared";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { Markdown } from "tiptap-markdown";
import type { EditorView } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";
import {
  BulletAfterBreakExtension,
  HashtagDecorationExtension,
  MarkdownNoIndentCodeExtension,
  buildListAwareMarkdown,
  handleNoteEnterKey,
} from "./tiptap-note";

/**
 * Tiptap setup shared by the two note editors — NoteCanvasEditor (inline on
 * the canvas) and NoteInlineEditor (the notes screen / modal). They used to
 * each carry a copy, and the copies drifted: only one had `trailingNode: false`.
 * PageEditor is deliberately separate; a page is a document, not a note.
 */
export function noteEditorExtensions(placeholder: string) {
  return [
    StarterKit.configure({
      heading: false,
      blockquote: false,
      horizontalRule: false,
      codeBlock: false,
      link: false,
      // StarterKit bundles TrailingNode in v3, which appends an empty
      // paragraph whenever the doc's last node isn't one — so a note ending in
      // a list always grew a blank line that reappeared the instant you
      // deleted it (its appendTransaction re-inserts on the next transaction).
      // A note is a short block of text, not a document; it doesn't need
      // somewhere to land past the end. Gapcursor is still on, so a list at
      // the very end is still escapable. PageEditor deliberately keeps the
      // trailing node.
      trailingNode: false,
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
  ];
}

/** The editor's content as markdown, with tiptap-markdown's escaped line breaks undone. */
export function readNoteMarkdown(editor: Editor): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (editor.storage as any).markdown.getMarkdown().replace(/\\\n/g, "\n");
}

/**
 * Key handling: open pickers get first refusal, then Enter saves, Shift+Enter
 * breaks the line, Shift+Enter twice starts a paragraph (handleNoteEnterKey),
 * and Escape cancels.
 */
export function handleNoteEditorKeyDown(
  view: EditorView,
  event: KeyboardEvent,
  {
    pickerHandlers,
    commit,
    cancel,
  }: { pickerHandlers: Array<(event: KeyboardEvent) => boolean>; commit: () => void; cancel: (() => void) | undefined },
): boolean {
  for (const handle of pickerHandlers) if (handle(event)) return true;
  if (handleNoteEnterKey(view, event, commit)) return true;
  if (event.key === "Enter") return false;
  if (event.key === "Escape") {
    event.preventDefault();
    cancel?.();
    return true;
  }
  return false;
}

/**
 * Paste handling: a URL pasted onto a selection links it; a URL pasted into
 * an empty editor goes to `onUrlIntoEmpty` when given (the canvas turns it
 * into a bookmark); bullet/indented plain text becomes a markdown list.
 */
export function handleNoteEditorPaste(
  view: EditorView,
  event: ClipboardEvent,
  editor: Editor | null,
  onUrlIntoEmpty?: (url: string) => void,
): boolean {
  const plainText = event.clipboardData?.getData("text/plain") ?? "";

  if (!view.state.selection.empty) {
    const href = normalizeLinkUrl(plainText);
    if (href) {
      editor?.chain().focus().setLink({ href }).run();
      return true;
    }
  }

  if (onUrlIntoEmpty && view.state.doc.textContent.trim() === "") {
    const normalizedUrl = normalizeLinkUrl(plainText);
    if (normalizedUrl) {
      onUrlIntoEmpty(normalizedUrl);
      return true;
    }
  }

  // Real HTML lists already paste correctly — don't interfere.
  const html = event.clipboardData?.getData("text/html") ?? "";
  if (/<(ul|ol|li)\b/i.test(html)) return false;

  const listMarkdown = buildListAwareMarkdown(plainText);
  if (listMarkdown && editor) {
    editor.chain().focus().insertContent(listMarkdown).run();
    return true;
  }

  return false;
}
