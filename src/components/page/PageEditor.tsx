import { useEffect, useRef } from "react";
import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Placeholder from "@tiptap/extension-placeholder";
import { normalizeLinkUrl } from "@omanote/shared";
import {
  HashtagDecorationExtension,
  useTiptapEmojiPicker,
  useTiptapHashtagPicker,
} from "../../lib/tiptap-note";
import { useTiptapSlashMenu } from "../../lib/tiptap-slash-menu";
import { HashtagPickerDropdown } from "../HashtagPicker";
import { EmojiPickerDropdown } from "../EmojiPicker";
import { SlashMenuDropdown } from "./SlashMenuDropdown";
import { TiptapLinkPopover } from "../TiptapLinkPopover";
import { PageTodoNode, PageTodoProvider, type PageTodoLookup } from "./PageTodoNode";
import { PageBookmarkNode, PageBookmarkProvider, type PageBookmarkLookup } from "./PageBookmarkNode";
import { PageImageNode } from "./PageImageNode";
import { isAllowedImageType, uploadPageImage } from "../../lib/page-images";
import { useAuth } from "@clerk/react";
import { useEncryption } from "../../contexts/EncryptionContext";

/**
 * The canvas body editor.
 *
 * Unlike NoteCanvasEditor this keeps StarterKit's headings, blockquote,
 * horizontal rule and code block — a canvas is a document, not a quick note —
 * and it reports ProseMirror JSON rather than markdown, because artifact
 * blocks carry node ids that markdown cannot represent (see PageItem.docJson).
 *
 * There is no save affordance: PageScreen autosaves. Escape is not bound
 * either, since nothing here is a dismissable draft.
 */
export function PageEditor({
  docJson,
  autoFocus = false,
  todoLookup,
  bookmarkLookup,
  onDocChange,
  onEditorReady,
  onImageError,
  onImageOptimized,
}: {
  docJson: string;
  autoFocus?: boolean;
  /** Live todo rows behind the checklist blocks — see PageTodoNode. */
  todoLookup: PageTodoLookup;
  /** Live bookmark rows behind the link blocks — see PageBookmarkNode. */
  bookmarkLookup: PageBookmarkLookup;
  onDocChange: (nextDocJson: string) => void;
  onEditorReady?: (editor: ReturnType<typeof useEditor>) => void;
  /** Surfaced to the user — a silently dropped image looks like a broken paste. */
  onImageError?: (message: string) => void;
  /** Called once per image that had to be recompressed to fit under the upload cap. */
  onImageOptimized?: (fileName: string) => void;
}) {
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const { getToken } = useAuth();
  const { encryptBinary, decryptBinary } = useEncryption();
  // Ref rather than a dependency of useEditor: the editor is built once, and
  // its paste/drop handlers must not be rebuilt on every auth-state tick.
  const uploadImageRef = useRef<(file: File) => void>(() => {});
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const hashtagHandlerRef = useRef<(event: Pick<KeyboardEvent, "key" | "preventDefault">) => boolean>(() => false);
  const emojiHandlerRef = useRef<(event: Pick<KeyboardEvent, "key" | "preventDefault">) => boolean>(() => false);
  const slashHandlerRef = useRef<(event: Pick<KeyboardEvent, "key" | "preventDefault">) => boolean>(() => false);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        link: false,
        code: {
          HTMLAttributes: {
            class: "rounded bg-app-surface-muted px-1.5 py-0.5 font-mono text-[0.92em] text-app-ink",
          },
        },
        codeBlock: {
          HTMLAttributes: {
            class: "rounded-xl bg-app-surface-muted p-3 font-mono text-[0.92em] text-app-ink",
          },
        },
        blockquote: {
          HTMLAttributes: { class: "border-l-2 border-app-line-strong pl-4 text-app-ink-muted" },
        },
        horizontalRule: {
          HTMLAttributes: { class: "my-6 border-t border-app-line" },
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
      Placeholder.configure({ placeholder: "Write, or press / for blocks" }),
      HashtagDecorationExtension,
      PageTodoNode,
      PageBookmarkNode,
      PageImageNode,
    ],
    content: safeParse(docJson),
    onUpdate: ({ editor }) => {
      onDocChange(JSON.stringify(editor.getJSON()));
    },
    editorProps: {
      attributes: {
        class: "omanote-page-editor relative block w-full text-base leading-7 text-app-ink caret-app-ink outline-none",
      },
      handleKeyDown: (_view, event) => {
        // Order matters: the slash menu claims Enter/Tab/Escape while it is
        // open, and the other two claim Enter for their own selection.
        if (slashHandlerRef.current(event)) return true;
        if (hashtagHandlerRef.current(event)) return true;
        if (emojiHandlerRef.current(event)) return true;
        return false;
      },
      handleDrop: (_view, event) => {
        const files = Array.from((event as DragEvent).dataTransfer?.files ?? []);
        const images = files.filter((file) => isAllowedImageType(file.type));
        if (images.length === 0) return false;
        event.preventDefault();
        for (const file of images) uploadImageRef.current(file);
        return true;
      },
      handlePaste: (view, event) => {
        // Screenshot pastes arrive as files with no useful text alternative.
        const files = Array.from(event.clipboardData?.files ?? []);
        const images = files.filter((file) => isAllowedImageType(file.type));
        if (images.length > 0) {
          for (const file of images) uploadImageRef.current(file);
          return true;
        }

        const plainText = event.clipboardData?.getData("text/plain") ?? "";
        // A URL pasted over a selection turns that selection into a link,
        // matching NoteCanvasEditor.
        if (!view.state.selection.empty) {
          const href = normalizeLinkUrl(plainText);
          if (href) {
            editor?.chain().focus().setLink({ href }).run();
            return true;
          }
        }
        // A bare URL pasted onto an empty block becomes a saved link — the
        // canvas equivalent of saving a bookmark, and the gesture people
        // already use in Notion and friends. Pasted mid-sentence it stays
        // inline text, because breaking a sentence into a card is never what
        // was meant.
        if (view.state.selection.empty && view.state.selection.$from.parent.content.size === 0) {
          const href = normalizeLinkUrl(plainText);
          if (href) {
            editor?.chain().focus().insertContent({ type: "pageBookmark", attrs: { url: href } }).run();
            return true;
          }
        }

        return false;
      },
    },
  });

  // Uploads happen out of band and insert the node when the key comes back —
  // a paste should never block on the network.
  uploadImageRef.current = (file: File) => {
    void (async () => {
      try {
        const { key: objectKey, bytes } = await uploadPageImage(
          file,
          () => getToken({ template: "convex" }),
          { encryptBinary, decryptBinary },
          () => onImageOptimized?.(file.name),
        );
        if (!editor || editor.isDestroyed) return;
        // alt starts empty rather than the filename — it doubles as the
        // visible caption (see PageImageNode), and "IMG_2931.jpg" is not a
        // caption anyone wants to see by default.
        editor.chain().focus().insertContent({ type: "pageImage", attrs: { objectKey, alt: "", bytes } }).run();
      } catch (error) {
        onImageError?.(error instanceof Error ? error.message : "Could not upload that image");
      }
    })();
  };

  const hashtagPicker = useTiptapHashtagPicker(editor);
  hashtagHandlerRef.current = hashtagPicker.handleKeyDown;
  const emojiPicker = useTiptapEmojiPicker(editor);
  emojiHandlerRef.current = emojiPicker.handleKeyDown;
  const slashMenu = useTiptapSlashMenu(editor, { onPickImage: () => fileInputRef.current?.click() });
  slashHandlerRef.current = slashMenu.handleKeyDown;

  useEffect(() => {
    if (editor) onEditorReady?.(editor);
  }, [editor, onEditorReady]);

  useEffect(() => {
    if (!autoFocus || !editor) return;
    const raf = requestAnimationFrame(() => {
      if (editor.isDestroyed) return;
      editor.commands.focus("end");
    });
    return () => cancelAnimationFrame(raf);
  }, [autoFocus, editor]);

  return (
    <PageTodoProvider value={todoLookup}>
    <PageBookmarkProvider value={bookmarkLookup}>
    <div ref={wrapperRef} className="relative">
      {/* Driven by the "/ Image" command, which has no DOM of its own. */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/avif"
        multiple
        className="hidden"
        onChange={(event) => {
          const files = Array.from(event.target.files ?? []);
          for (const file of files) uploadImageRef.current(file);
          // Reset so picking the same file twice in a row still fires onChange.
          event.target.value = "";
        }}
      />
      <EditorContent editor={editor} />
      <TiptapLinkPopover editor={editor} wrapperRef={wrapperRef} />
      <SlashMenuDropdown
        isOpen={slashMenu.isOpen}
        commands={slashMenu.commands}
        activeIndex={slashMenu.activeIndex}
        onSelect={slashMenu.selectCommand}
        onHover={slashMenu.setActiveIndex}
        anchorRef={wrapperRef}
        anchorRect={slashMenu.anchorRect}
      />
      <HashtagPickerDropdown
        isOpen={hashtagPicker.isOpen}
        suggestions={hashtagPicker.suggestions}
        activeIndex={hashtagPicker.activeIndex}
        onSelect={hashtagPicker.selectSuggestion}
        onHover={hashtagPicker.setActiveIndex}
        anchorRef={wrapperRef}
        anchorRect={hashtagPicker.anchorRect}
      />
      <EmojiPickerDropdown
        isOpen={emojiPicker.isOpen}
        suggestions={emojiPicker.suggestions}
        activeIndex={emojiPicker.activeIndex}
        onSelect={emojiPicker.selectSuggestion}
        onHover={emojiPicker.setActiveIndex}
        anchorRef={wrapperRef}
        anchorRect={emojiPicker.anchorRect}
      />
    </div>
    </PageBookmarkProvider>
    </PageTodoProvider>
  );
}

// A row whose JSON is unreadable opens as an empty document rather than
// throwing inside Tiptap's constructor and blanking the whole route.
function safeParse(docJson: string): object | undefined {
  try {
    const parsed: unknown = JSON.parse(docJson);
    return parsed && typeof parsed === "object" ? (parsed as object) : undefined;
  } catch {
    return undefined;
  }
}
