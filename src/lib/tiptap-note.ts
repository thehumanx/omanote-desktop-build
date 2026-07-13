import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { findActiveHashtag, hashtagColor } from "./hashtags";
import { findActiveEmojiTrigger } from "./emoji-trigger";
import { searchEmoji, quickPickEmojiSuggestions } from "./bookmark-category-icon";
import { Extension, InputRule } from "@tiptap/core";
import { Plugin, PluginKey, TextSelection } from "@tiptap/pm/state";
import { findWrapping } from "@tiptap/pm/transform";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import type { Editor } from "@tiptap/react";

// ---------------------------------------------------------------------------
// Hashtag decoration extension — adds colored background to #hashtag tokens
// ---------------------------------------------------------------------------

const HASHTAG_PLUGIN_KEY = new PluginKey("hashtagDecoration");

function buildHashtagDecorationPlugin() {
  return new Plugin({
    key: HASHTAG_PLUGIN_KEY,
    props: {
      decorations(state) {
        const decorations: Decoration[] = [];
        state.doc.descendants((node, pos) => {
          if (!node.isText || !node.text) return;
          const regex = /(?:^|\s)(#[a-zA-Z]\w*)/g;
          let match: RegExpExecArray | null;
          while ((match = regex.exec(node.text)) !== null) {
            const hashIndex = match.index + match[0].indexOf("#");
            const start = pos + hashIndex;
            const end = start + match[1].length;
            const name = match[1].slice(1);
            const color = hashtagColor(name);
            decorations.push(
              Decoration.inline(start, end, {
                class: `${color.bg} ${color.text} ${color.darkBg} ${color.darkText} rounded-full px-1`,
              }),
            );
          }
        });
        return DecorationSet.create(state.doc, decorations);
      },
    },
  });
}

export const HashtagDecorationExtension = Extension.create({
  name: "hashtagDecoration",
  addProseMirrorPlugins() {
    return [buildHashtagDecorationPlugin()];
  },
});

// ---------------------------------------------------------------------------
// Markdown paste fix — disable markdown-it's indented-code rule
// ---------------------------------------------------------------------------
// Text pasted from web pages often arrives indented (e.g. list items copied as
// plain text). markdown-it treats any 4-space-indented line as a code block, so
// the round-trip through tiptap-markdown turned such pastes into monospace code.
// Disabling the rule makes indented lines stay as normal paragraph text.

// ---------------------------------------------------------------------------
// List-aware paste — convert pasted bullet/indented plain text into markdown
// ---------------------------------------------------------------------------
// Browsers copy rendered lists to the clipboard as plain text that is either
// prefixed with a bullet glyph (•, -, *, …) or simply indented. Pasted as-is
// these lose their list structure. This converts list-looking lines into
// markdown bullets so they re-render as a real list. Returns null when nothing
// looks list-like, so the caller can fall back to the default paste behavior.

const BULLET_GLYPH_LINE = /^[ \t]*([-*+•·‣◦▪●○–—])[ \t]+(.*\S.*)$/;
const INDENTED_LINE = /^(?:[ \t]{2,}|\t)\S/;
const EXTRA_BLANK_LINE_MARKER = "\u00A0";

export function buildListAwareMarkdown(text: string): string | null {
  const lines = text.split(/\r?\n/);
  let converted = false;
  const out: string[] = [];

  for (const line of lines) {
    if (!line.trim()) {
      out.push("");
      continue;
    }
    const glyph = line.match(BULLET_GLYPH_LINE);
    if (glyph) {
      converted = true;
      out.push(`- ${glyph[2].trim()}`);
      continue;
    }
    if (INDENTED_LINE.test(line)) {
      converted = true;
      out.push(`- ${line.trim()}`);
      continue;
    }
    out.push(line);
  }

  if (!converted) return null;

  // Ensure a blank line separates a leading paragraph from the first bullet so
  // markdown-it always starts a fresh list.
  const normalized: string[] = [];
  for (let i = 0; i < out.length; i++) {
    const line = out[i];
    const prev = normalized[normalized.length - 1];
    if (line.startsWith("- ") && prev !== undefined && prev !== "" && !prev.startsWith("- ")) {
      normalized.push("");
    }
    normalized.push(line);
  }
  return normalized.join("\n");
}

// Convert persisted marker paragraphs back to logical newline runs.
// Pattern emitted by preserveExtraBlankLinesInMarkdown:
// \n\n + (NBSP + \n\n)*N  => represents N+1 consecutive '\n'.
function decodePreservedBlankLines(markdown: string): string {
  return markdown.replace(/\n\n(?:\u00A0\n\n)+/g, (segment) => {
    const markerCount = (segment.match(/\u00A0/g) ?? []).length;
    return "\n".repeat(markerCount + 1);
  });
}

// Markdown paragraph parsing collapses blank-line intent in rich editors.
// Preserve user-intent spacing by expanding newline runs into additional
// marker-only paragraphs (NBSP), which survive markdown round-trips.
// This function is intentionally idempotent.
export function preserveExtraBlankLinesInMarkdown(markdown: string): string {
  const normalized = decodePreservedBlankLines(markdown);
  return normalized.replace(/\n{2,}/g, (run) => {
    const blankLines = run.length - 1;
    let next = "\n\n";
    for (let i = 0; i < blankLines; i += 1) {
      next += `${EXTRA_BLANK_LINE_MARKER}\n\n`;
    }
    return next;
  });
}

export const MarkdownNoIndentCodeExtension = Extension.create({
  name: "markdownNoIndentCode",
  addStorage() {
    return {
      markdown: {
        parse: {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          setup(markdownit: any) {
            markdownit.disable("code");
          },
        },
      },
    };
  },
});

// ---------------------------------------------------------------------------
// Bullet list after a hard break — input rule
// ---------------------------------------------------------------------------
// StarterKit's bulletList input rule is anchored to the text-block start (`^`),
// so typing "- " on a visual line that follows a hard break (Shift+Enter inside
// the same paragraph) never matches. Tiptap renders leaf nodes like hard
// breaks as "%leaf%" ("\n" in older versions) when building the match text.
// The leaf marker lives in a lookbehind because its string length differs
// from its document size, which would corrupt the match range. The handler
// re-checks that the node before the match really is a hard break, then
// removes the break + marker, splits the preceding text into its own block,
// and wraps the new line in a bullet list so typing is consistent everywhere.

export const BulletAfterBreakExtension = Extension.create({
  name: "bulletAfterBreak",
  addInputRules() {
    const bulletList = this.editor.schema.nodes.bulletList;
    if (!bulletList) return [];
    return [
      new InputRule({
        find: /(?<=\n|%leaf%)([-+*])[ \t]$/,
        handler: ({ state, range }) => {
          const nodeBefore = state.doc.resolve(range.from).nodeBefore;
          if (nodeBefore?.type.name !== "hardBreak") return null;
          const breakFrom = range.from - 1;
          const { tr } = state;
          tr.delete(breakFrom, range.to);
          tr.split(breakFrom);
          // Map through the delete+split steps to land inside the new block;
          // hand-computed offsets resolve to the boundary between blocks,
          // where blockRange() is null and the wrap never happens.
          const start = tr.mapping.map(range.from);
          const blockRange = tr.doc.resolve(start).blockRange();
          const wrapping = blockRange && findWrapping(blockRange, bulletList);
          if (!wrapping) return null;
          tr.wrap(blockRange, wrapping);
          tr.setSelection(TextSelection.near(tr.doc.resolve(start)));
        },
      }),
    ];
  },
});

// ---------------------------------------------------------------------------
// Hashtag picker hook for Tiptap editors
// ---------------------------------------------------------------------------

interface ActiveHashtag {
  partial: string;
  prosemirrorFrom: number;
}

export interface TiptapHashtagPickerState {
  isOpen: boolean;
  suggestions: Array<{ _id: string; name: string; nameLower: string }>;
  activeIndex: number;
  anchorRect: { left: number; right: number; top: number; bottom: number } | null;
  handleKeyDown: (event: Pick<KeyboardEvent, "key" | "preventDefault">) => boolean;
  selectSuggestion: (name: string) => void;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useTiptapHashtagPicker(editor: Editor | null): TiptapHashtagPickerState {
  const [activeHashtag, setActiveHashtag] = useState<ActiveHashtag | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const detect = () => {
      const { from } = editor.state.selection;
      const textBeforeCursor = editor.state.doc.textBetween(0, from, "\n");
      const active = findActiveHashtag(textBeforeCursor, textBeforeCursor.length);
      if (active) {
        setActiveHashtag({
          partial: active.partial,
          prosemirrorFrom: from - (1 + active.partial.length),
        });
        const coords = editor.view.coordsAtPos(from);
        setAnchorRect({
          left: coords.left,
          right: coords.right,
          top: coords.top,
          bottom: coords.bottom,
        });
      } else {
        setActiveHashtag(null);
        setAnchorRect(null);
      }
    };

    editor.on("selectionUpdate", detect);
    editor.on("update", detect);
    return () => {
      editor.off("selectionUpdate", detect);
      editor.off("update", detect);
    };
  }, [editor]);

  const prefix = activeHashtag?.partial ?? "";

  const allHashtags = useQuery(api.hashtags.listUserHashtags, {
    prefix: prefix || undefined,
    limit: 8,
  });
  const suggestions = useMemo(() => allHashtags ?? [], [allHashtags]);

  useEffect(() => {
    setActiveIndex(0);
  }, [prefix]);

  const selectSuggestion = useCallback(
    (name: string) => {
      if (!editor || !activeHashtag) return;
      const { from } = editor.state.selection;
      editor
        .chain()
        .focus()
        .deleteRange({ from: activeHashtag.prosemirrorFrom, to: from })
        .insertContent(`#${name} `)
        .run();
    },
    [editor, activeHashtag],
  );

  const handleKeyDown = useCallback(
    (event: Pick<KeyboardEvent, "key" | "preventDefault">): boolean => {
      if (!activeHashtag || suggestions.length === 0) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const selected = suggestions[activeIndex];
        if (selected) {
          event.preventDefault();
          selectSuggestion(selected.name);
          return true;
        }
      }
      return false;
    },
    [activeHashtag, suggestions, activeIndex, selectSuggestion],
  );

  return { isOpen: activeHashtag !== null, suggestions, activeIndex, anchorRect, handleKeyDown, selectSuggestion, setActiveIndex };
}

// ---------------------------------------------------------------------------
// Emoji picker hook for Tiptap editors — Slack-style ":shortcode" trigger
// ---------------------------------------------------------------------------

interface ActiveEmojiTrigger {
  partial: string;
  prosemirrorFrom: number;
}

export interface TiptapEmojiPickerState {
  isOpen: boolean;
  suggestions: Array<{ emoji: string; name: string }>;
  activeIndex: number;
  anchorRect: { left: number; right: number; top: number; bottom: number } | null;
  handleKeyDown: (event: Pick<KeyboardEvent, "key" | "preventDefault">) => boolean;
  selectSuggestion: (emoji: string) => void;
  setActiveIndex: React.Dispatch<React.SetStateAction<number>>;
}

export function useTiptapEmojiPicker(editor: Editor | null): TiptapEmojiPickerState {
  const [activeEmoji, setActiveEmoji] = useState<ActiveEmojiTrigger | null>(null);
  const [activeIndex, setActiveIndex] = useState(0);
  const [anchorRect, setAnchorRect] = useState<{ left: number; right: number; top: number; bottom: number } | null>(null);

  useEffect(() => {
    if (!editor) return;

    const detect = () => {
      const { from } = editor.state.selection;
      const textBeforeCursor = editor.state.doc.textBetween(0, from, "\n");
      const active = findActiveEmojiTrigger(textBeforeCursor, textBeforeCursor.length);
      if (active) {
        setActiveEmoji({
          partial: active.partial,
          prosemirrorFrom: from - (1 + active.partial.length),
        });
        const coords = editor.view.coordsAtPos(from);
        setAnchorRect({
          left: coords.left,
          right: coords.right,
          top: coords.top,
          bottom: coords.bottom,
        });
      } else {
        setActiveEmoji(null);
        setAnchorRect(null);
      }
    };

    editor.on("selectionUpdate", detect);
    editor.on("update", detect);
    return () => {
      editor.off("selectionUpdate", detect);
      editor.off("update", detect);
    };
  }, [editor]);

  const prefix = activeEmoji?.partial ?? "";

  const suggestions = useMemo(
    () => (activeEmoji ? (prefix ? searchEmoji(prefix) : quickPickEmojiSuggestions()) : []),
    [activeEmoji, prefix],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [prefix]);

  const selectSuggestion = useCallback(
    (emoji: string) => {
      if (!editor || !activeEmoji) return;
      const { from } = editor.state.selection;
      editor
        .chain()
        .focus()
        .deleteRange({ from: activeEmoji.prosemirrorFrom, to: from })
        .insertContent(`${emoji} `)
        .run();
    },
    [editor, activeEmoji],
  );

  const handleKeyDown = useCallback(
    (event: Pick<KeyboardEvent, "key" | "preventDefault">): boolean => {
      if (!activeEmoji || suggestions.length === 0) return false;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActiveIndex((i) => Math.min(i + 1, suggestions.length - 1));
        return true;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        return true;
      }
      if (event.key === "Enter" || event.key === "Tab") {
        const selected = suggestions[activeIndex];
        if (selected) {
          event.preventDefault();
          selectSuggestion(selected.emoji);
          return true;
        }
      }
      return false;
    },
    [activeEmoji, suggestions, activeIndex, selectSuggestion],
  );

  return { isOpen: activeEmoji !== null, suggestions, activeIndex, anchorRect, handleKeyDown, selectSuggestion, setActiveIndex };
}
