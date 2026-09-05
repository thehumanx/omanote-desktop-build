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

interface ProseMirrorNode {
  type?: string;
  text?: string;
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
  level?: number;
  url?: string;
  checked?: boolean;
}

export function pageDocToShareBlocks(
  docJson: string,
  isTodoDone: (todoKey: string) => boolean = () => false,
): SharePageBlock[] {
  const doc = parseDoc(docJson);
  if (!doc) return [];

  const blocks: SharePageBlock[] = [];

  const textOf = (node: ProseMirrorNode): string => {
    if (typeof node.text === "string") return node.text;
    return (node.content ?? []).map(textOf).join("");
  };

  const walk = (node: ProseMirrorNode) => {
    switch (node.type) {
      case "heading":
        blocks.push({ type: "heading", text: textOf(node), level: (node as { attrs?: { level?: number } }).attrs?.level ?? 2 });
        return;
      case "paragraph": {
        const text = textOf(node);
        // Empty paragraphs are spacing in the editor and noise in a published
        // document; drop them rather than emitting blank rows.
        if (text.trim()) blocks.push({ type: "paragraph", text });
        return;
      }
      case "pageTodo": {
        const key = (node as { attrs?: { todoKey?: string | null } }).attrs?.todoKey ?? null;
        blocks.push({ type: "todo", text: textOf(node), checked: key ? isTodoDone(key) : false });
        return;
      }
      case "pageBookmark": {
        const url = (node as { attrs?: { url?: string } }).attrs?.url ?? "";
        if (url) blocks.push({ type: "link", url });
        return;
      }
      case "pageImage": {
        const objectKey = (node as { attrs?: { objectKey?: string } }).attrs?.objectKey ?? "";
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
        blocks.push({ type: "quote", text: textOf(node) });
        return;
      case "listItem":
        blocks.push({ type: "listItem", text: textOf(node) });
        return;
      default:
        for (const child of node.content ?? []) walk(child);
    }
  };

  for (const child of doc.content ?? []) walk(child);
  return blocks;
}

/** True when a canvas has neither a title nor any body text. */
export function isPageDocEmpty(docJson: string, title?: string): boolean {
  return !title?.trim() && pageDocToText(docJson).trim() === "";
}
