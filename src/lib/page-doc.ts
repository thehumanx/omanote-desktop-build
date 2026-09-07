import { normalizeLinkUrl } from "@omanote/shared";
import type { BookmarkItem } from "@omanote/shared";
import { parseHashtags } from "./hashtags";

/**
 * Helpers for reading a canvas's ProseMirror JSON without loading Tiptap.
 *
 * These run in three places that must agree: the editor (on autosave), preview
 * cards, and search. Keeping them here rather than in the editor means a card
 * never has to instantiate an editor to show a snippet.
 */

export const PREVIEW_LENGTH = 200;

/** An empty document — what a brand new canvas starts from. */
export function emptyPageDoc(): string {
  return JSON.stringify({ type: "doc", content: [{ type: "paragraph" }] });
}

interface ProseMirrorMark {
  type?: string;
  attrs?: { href?: string };
}

interface ProseMirrorNode {
  type?: string;
  text?: string;
  marks?: ProseMirrorMark[];
  attrs?: Record<string, unknown>;
  content?: ProseMirrorNode[];
}

function parseDoc(docJson: string): ProseMirrorNode | null {
  try {
    const parsed: unknown = JSON.parse(docJson);
    if (!parsed || typeof parsed !== "object") return null;
    return parsed as ProseMirrorNode;
  } catch {
    // A document that won't parse must not take down the card rendering it.
    return null;
  }
}

/**
 * Flattens a document to plain text, one block per line.
 *
 * Block boundaries become newlines rather than being concatenated, so
 * "Groceries" followed by "#shopping" never merges into "Groceries#shopping" —
 * which would both read wrong in a preview and hide the hashtag from the
 * extractor, whose pattern requires whitespace before the "#".
 */
export function pageDocToText(docJson: string): string {
  const doc = parseDoc(docJson);
  if (!doc) return "";

  const lines: string[] = [];
  const walk = (node: ProseMirrorNode, isBlock: boolean) => {
    if (typeof node.text === "string") {
      if (lines.length === 0) lines.push("");
      lines[lines.length - 1] += node.text;
      return;
    }
    if (isBlock) lines.push("");
    for (const child of node.content ?? []) {
      walk(child, isBlockNode(child.type));
    }
  };

  for (const child of doc.content ?? []) {
    walk(child, true);
  }

  return lines.map((line) => line.trim()).filter(Boolean).join("\n");
}

function isBlockNode(type: string | undefined): boolean {
  return type !== undefined && type !== "text" && !INLINE_NODES.has(type);
}

const INLINE_NODES = new Set(["text", "hardBreak"]);

/** The short plaintext extract stored on the row for cards and search. */
export function pageDocToPreview(docJson: string): string {
  const text = pageDocToText(docJson).replace(/\n+/g, " · ");
  return text.length > PREVIEW_LENGTH ? `${text.slice(0, PREVIEW_LENGTH).trimEnd()}…` : text;
}

/**
 * Hashtags for the plaintext `hashtags` column that Explore indexes. Extracted
 * client-side before the document is encrypted — the server only ever sees
 * ciphertext and cannot do this itself.
 */
export function pageDocToHashtags(docJson: string, title?: string): string[] {
  // The title is scanned too — "#launch" typed as the canvas name should file
  // it under that tag exactly like one typed in the body.
  return parseHashtags([title ?? "", pageDocToText(docJson)].join("\n"));
}

/** One run of text carrying a uniform set of marks — what a share block needs to reproduce bold/italic/etc. without shipping a rich-text renderer. */
export interface ShareTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

/**
 * A canvas flattened into the blocks a public share renders.
 *
 * Done on the owner's client for two reasons: the server cannot read the
 * encrypted document at all, and flattening here is what keeps artifact node
 * ids out of the published copy — those point at private `todos`/`bookmarks`
 * rows and have no business in something anyone can fetch. A checklist item
 * publishes as its text plus a checked flag, nothing more.
 */
export interface SharePageBlock {
  type: string;
  text?: string;
  /** Present alongside `text` for block types that carry inline formatting (marks). */
  runs?: ShareTextRun[];
  level?: number;
  url?: string;
  checked?: boolean;
  /** Set on `listItem` blocks — which list they belong to and how deeply nested. */
  listKind?: "bullet" | "ordered";
  depth?: number;
  // Link-preview fields, copied from the bookmark row a `pageBookmark` node
  // points at. Absent when the row hasn't materialized yet or has none.
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  siteName?: string;
}

export function pageDocToShareBlocks(
  docJson: string,
  isTodoDone: (todoKey: string) => boolean = () => false,
  getBookmark: (bookmarkKey: string) => BookmarkItem | undefined = () => undefined,
): SharePageBlock[] {
  const doc = parseDoc(docJson);
  if (!doc) return [];

  const blocks: SharePageBlock[] = [];

  const textOf = (node: ProseMirrorNode): string => {
    if (typeof node.text === "string") return node.text;
    return (node.content ?? []).map(textOf).join("");
  };

  const runsOf = (node: ProseMirrorNode): ShareTextRun[] => {
    if (typeof node.text === "string") {
      if (!node.text) return [];
      const run: ShareTextRun = { text: node.text };
      for (const mark of node.marks ?? []) {
        switch (mark.type) {
          case "bold":
            run.bold = true;
            break;
          case "italic":
            run.italic = true;
            break;
          case "strike":
            run.strike = true;
            break;
          case "underline":
            run.underline = true;
            break;
          case "code":
            run.code = true;
            break;
          case "link": {
            const href = normalizeLinkUrl(mark.attrs?.href ?? "");
            if (href) run.href = href;
            break;
          }
          default:
            break;
        }
      }
      return [run];
    }
    return (node.content ?? []).flatMap(runsOf);
  };

  // Lists are flattened to one `listItem` block per `<li>`, tagged with the
  // list's kind and nesting depth — that's enough for the renderer to rebuild
  // <ul>/<ol> structure without a tree-shaped block format.
  const walkList = (list: ProseMirrorNode, kind: "bullet" | "ordered", depth: number) => {
    for (const item of list.content ?? []) {
      if (item.type !== "listItem") continue;
      const itemContent = item.content ?? [];
      const textNode = itemContent.find((child) => child.type === "paragraph") ?? itemContent[0];
      const runs = textNode ? runsOf(textNode) : [];
      blocks.push({
        type: "listItem",
        listKind: kind,
        depth,
        runs,
        text: runs.map((run) => run.text).join(""),
      });
      for (const child of itemContent) {
        if (child.type === "orderedList") walkList(child, "ordered", depth + 1);
        else if (child.type === "bulletList") walkList(child, "bullet", depth + 1);
      }
    }
  };

  const walk = (node: ProseMirrorNode) => {
    switch (node.type) {
      case "heading":
        blocks.push({ type: "heading", text: textOf(node), runs: runsOf(node), level: (node.attrs?.level as number | undefined) ?? 2 });
        return;
      case "paragraph": {
        const text = textOf(node);
        // Empty paragraphs are spacing in the editor and noise in a published
        // document; drop them rather than emitting blank rows.
        if (text.trim()) blocks.push({ type: "paragraph", text, runs: runsOf(node) });
        return;
      }
      case "pageTodo": {
        const key = (node.attrs?.todoKey as string | null | undefined) ?? null;
        blocks.push({ type: "todo", text: textOf(node), runs: runsOf(node), checked: key ? isTodoDone(key) : false });
        return;
      }
      case "pageBookmark": {
        const url = (node.attrs?.url as string | undefined) ?? "";
        const key = (node.attrs?.bookmarkKey as string | null | undefined) ?? null;
        const bookmark = key ? getBookmark(key) : undefined;
        if (url) {
          blocks.push({
            type: "link",
            url,
            title: bookmark?.title,
            description: bookmark?.description,
            thumbnailUrl: bookmark?.thumbnailUrl,
            siteName: bookmark?.siteName,
          });
        }
        return;
      }
      case "pageImage": {
        const objectKey = (node.attrs?.objectKey as string | undefined) ?? "";
        // The private key is published as-is. Publishing is what moves the
        // bytes to the public `p/` prefix (see publishCanvasImages), and the
        // block carries whichever key the copy landed under.
        if (objectKey) blocks.push({ type: "image", url: objectKey });
        return;
      }
      case "horizontalRule":
        blocks.push({ type: "divider" });
        return;
      case "codeBlock":
        blocks.push({ type: "code", text: textOf(node) });
        return;
      case "blockquote":
        blocks.push({ type: "quote", text: textOf(node), runs: runsOf(node) });
        return;
      case "orderedList":
        walkList(node, "ordered", 0);
        return;
      case "bulletList":
        walkList(node, "bullet", 0);
        return;
      default:
        for (const child of node.content ?? []) walk(child);
    }
  };

  for (const child of doc.content ?? []) walk(child);
  return blocks;
}

export interface PageDocStats {
  words: number;
  todos: number;
  links: number;
  images: number;
}

/** Word/artifact counts shared by the open canvas's metadata row and its preview cards. */
export function pageDocStats(docJson: string): PageDocStats {
  const blocks = pageDocToShareBlocks(docJson);
  return {
    words: pageDocToText(docJson).split(/\s+/).filter(Boolean).length,
    todos: blocks.filter((block) => block.type === "todo").length,
    links: blocks.filter((block) => block.type === "link").length,
    images: blocks.filter((block) => block.type === "image").length,
  };
}

/** True when a canvas has neither a title nor any body text. */
export function isPageDocEmpty(docJson: string, title?: string): boolean {
  return !title?.trim() && pageDocToText(docJson).trim() === "";
}
