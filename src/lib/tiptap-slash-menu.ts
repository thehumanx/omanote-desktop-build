import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Editor } from "@tiptap/react";

/**
 * The "/" block menu for the canvas editor.
 *
 * Deliberately built on the same detect-from-editor-state pattern as
 * `useTiptapHashtagPicker` and `useTiptapEmojiPicker` in ./tiptap-note.ts
 * rather than on @tiptap/suggestion: that package's release line has moved
 * ahead of the pinned @tiptap/pm in this repo and installing it forces a peer
 * bump of the whole Tiptap tree. Three hooks sharing one shape is also easier
 * to reason about than two conventions.
 */

export interface SlashCommandContext {
  /** Opens the editor's hidden file input. Images upload out of band. */
  onPickImage?: () => void;
}

export interface SlashCommand {
  id: string;
  label: string;
  /** Extra words that should match the typed query, e.g. "h1" for Heading 1. */
  keywords: string[];
  hint: string;
  run: (editor: Editor, context: SlashCommandContext) => void;
}

// Ordered by how often a writer reaches for them, not alphabetically.
export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: "heading1",
    label: "Heading 1",
    keywords: ["h1", "title", "big"],
    hint: "#",
    run: (editor: Editor) => editor.chain().focus().setNode("heading", { level: 1 }).run(),
  },
  {
    id: "heading2",
    label: "Heading 2",
    keywords: ["h2", "subtitle"],
    hint: "##",
    run: (editor: Editor) => editor.chain().focus().setNode("heading", { level: 2 }).run(),
  },
  {
    id: "heading3",
    label: "Heading 3",
    keywords: ["h3"],
    hint: "###",
    run: (editor: Editor) => editor.chain().focus().setNode("heading", { level: 3 }).run(),
  },
  {
    id: "paragraph",
    label: "Text",
    keywords: ["body", "plain", "p"],
    hint: "¶",
    run: (editor: Editor) => editor.chain().focus().setParagraph().run(),
  },
  {
    id: "pageTodo",
    label: "To-do",
    keywords: ["todo", "task", "checklist", "check", "checkbox"],
    hint: "☐",
    // Backed by a real todos row — see PageTodoNode and usePageArtifactSync.
    run: (editor: Editor) => editor.chain().focus().setNode("pageTodo").run(),
  },
  {
    id: "bulletList",
    label: "Bulleted list",
    keywords: ["ul", "unordered", "bullet"],
    hint: "-",
    run: (editor: Editor) => editor.chain().focus().toggleBulletList().run(),
  },
  {
    id: "orderedList",
    label: "Numbered list",
    keywords: ["ol", "ordered", "number"],
    hint: "1.",
    run: (editor: Editor) => editor.chain().focus().toggleOrderedList().run(),
  },
  {
    id: "blockquote",
    label: "Quote",
    keywords: ["citation", "blockquote"],
    hint: ">",
    run: (editor: Editor) => editor.chain().focus().toggleBlockquote().run(),
  },
  {
    id: "codeBlock",
    label: "Code block",
    keywords: ["snippet", "pre", "monospace"],
    hint: "```",
    run: (editor: Editor) => editor.chain().focus().toggleCodeBlock().run(),
  },
  {
    id: "pageImage",
    label: "Image",
    keywords: ["image", "picture", "photo", "img", "upload"],
    hint: "🖼",
    // The node is inserted by the upload callback once the key comes back, so
    // this only opens the picker.
    run: (_editor, context) => context.onPickImage?.(),
  },
  {
    id: "horizontalRule",
    label: "Divider",
    keywords: ["hr", "rule", "separator", "line"],
    hint: "---",
    run: (editor: Editor) => editor.chain().focus().setHorizontalRule().run(),
  },
];

export function matchSlashCommands(query: string): SlashCommand[] {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return SLASH_COMMANDS;
  return SLASH_COMMANDS.filter(
    (command) =>
      command.label.toLowerCase().includes(normalized) ||
      command.keywords.some((keyword) => keyword.startsWith(normalized)),
  );
}

/**
 * Finds an active "/" trigger in the text before the caret.
 *
 * Only fires when the slash opens the block, so "and/or" mid-sentence and a
 * pasted URL never open the menu. Returns the query typed after it, or null.
 */
export function findActiveSlashQuery(textBeforeCaret: string): string | null {
  const match = /(?:^|\n)\/([^\s/]*)$/.exec(textBeforeCaret);
  return match ? match[1]! : null;
}

export interface TiptapSlashMenuState {
  isOpen: boolean;
  commands: SlashCommand[];
  activeIndex: number;
  anchorRect: { left: number; right: number; top: number; bottom: number } | null;
  handleKeyDown: (event: Pick<KeyboardEvent, "key" | "preventDefault">) => boolean;
  selectCommand: (command: SlashCommand) => void;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useTiptapSlashMenu(
  editor: Editor | null,
  context: SlashCommandContext = {},
): TiptapSlashMenuState {
  const [query, setQuery] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<TiptapSlashMenuState["anchorRect"]>(null);
  // Held in a ref so callers can pass an inline object without invalidating
  // selectCommand (and with it every keydown handler) on each render.
  const contextRef = useRef(context);
  contextRef.current = context;

  useEffect(() => {
    if (!editor) return;

    const detect = () => {
      const { from } = editor.state.selection;
      const textBeforeCaret = editor.state.doc.textBetween(0, from, "\n");
      const active = findActiveSlashQuery(textBeforeCaret);
      if (active === null) {
        setQuery(null);
        setAnchorRect(null);
        return;
      }
      setQuery(active);
      const coords = editor.view.coordsAtPos(from);
      setAnchorRect({ left: coords.left, right: coords.right, top: coords.top, bottom: coords.bottom });
    };

    editor.on("selectionUpdate", detect);
    editor.on("update", detect);
    return () => {
      editor.off("selectionUpdate", detect);
      editor.off("update", detect);
    };
  }, [editor]);

  const commands = useMemo(() => (query === null ? [] : matchSlashCommands(query)), [query]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  const selectCommand = useCallback(
    (command: SlashCommand) => {
      if (!editor || query === null) return;
      const { from } = editor.state.selection;
      // Remove the "/" and everything typed after it before applying the block
      // change, so the trigger text never survives into the document.
      editor
        .chain()
        .focus()
        .deleteRange({ from: from - (query.length + 1), to: from })
        .run();
      command.run(editor, contextRef.current);
      setQuery(null);
      setAnchorRect(null);
    },
    [editor, query],
  );

  const handleKeyDown = useCallback(
    (event: Pick<KeyboardEvent, "key" | "preventDefault">): boolean => {
      if (query === null || commands.length === 0) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, commands.length - 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const selected = commands[activeIndex];
        if (selected) {
          event.preventDefault();
          selectCommand(selected);
          return true;
        }
      }
      if (event.key === "Escape") {
        event.preventDefault();
        setQuery(null);
        setAnchorRect(null);
        return true;
      }
      return false;
    },
    [query, commands, activeIndex, selectCommand],
  );

  return { isOpen: query !== null, commands, activeIndex, anchorRect, handleKeyDown, selectCommand, setActiveIndex };
}
