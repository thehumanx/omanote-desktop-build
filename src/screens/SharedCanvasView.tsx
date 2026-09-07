import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, Link2 } from "lucide-react";
import { normalizeLinkUrl } from "@omanote/shared";
import { publicPageImageUrl } from "../lib/page-images";
import { cn } from "../components/ui";

export interface PublicCanvasTextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  strike?: boolean;
  underline?: boolean;
  code?: boolean;
  href?: string;
}

export interface PublicCanvasBlock {
  type: string;
  text?: string;
  runs?: PublicCanvasTextRun[];
  level?: number;
  url?: string;
  checked?: boolean;
  listKind?: "bullet" | "ordered";
  depth?: number;
  title?: string;
  description?: string;
  thumbnailUrl?: string;
  siteName?: string;
}

export interface PublicCanvas {
  shareCode: string;
  slug: string | null;
  title: string;
  description: string | null;
  thumbnailUrl: string | null;
  blocks: PublicCanvasBlock[];
  ownerName: string;
  ownerImageUrl?: string;
  viewCount: number;
  createdAt: number;
  snapshotUpdatedAt: number | null;
  isOwner: boolean;
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

/**
 * Renders a block's inline formatting. `runs` is absent for older snapshots
 * (published before formatting was captured) and for block types that never
 * carry marks — `text` alone covers those.
 */
function RunsText({ runs, text }: { runs?: PublicCanvasTextRun[]; text?: string }) {
  if (!runs || runs.length === 0) return <>{text}</>;
  return (
    <>
      {runs.map((run, index) => {
        let node: ReactNode = run.text;
        if (run.code) {
          node = <code className="rounded bg-app-surface-muted px-1.5 py-0.5 font-mono text-[0.92em] text-app-ink">{node}</code>;
        }
        if (run.bold) node = <strong>{node}</strong>;
        if (run.italic) node = <em>{node}</em>;
        if (run.strike) node = <s>{node}</s>;
        if (run.underline) node = <u>{node}</u>;
        // Re-checked here for the same reason as the "link" block below — this
        // is user-authored data reaching a visitor's browser.
        const href = run.href ? normalizeLinkUrl(run.href) : null;
        if (href) {
          node = (
            <a href={href} target="_blank" rel="noreferrer nofollow" className="underline decoration-2 underline-offset-2">
              {node}
            </a>
          );
        }
        return <span key={index}>{node}</span>;
      })}
    </>
  );
}

const BULLET_MARKER_CLASSES = ["list-disc", "list-[circle]", "list-[square]"];
const ORDERED_MARKER_CLASSES = ["list-decimal", "list-[lower-alpha]", "list-[lower-roman]"];

interface ListItemNode {
  block: PublicCanvasBlock;
  children: ListTreeNode | null;
}

interface ListTreeNode {
  kind: "bullet" | "ordered";
  depth: number;
  items: ListItemNode[];
}

/**
 * Rebuilds nested <ul>/<ol> structure from the flat, depth-tagged `listItem`
 * blocks pageDocToShareBlocks emits. Blocks are in document (pre-)order, so a
 * deeper item always immediately follows the shallower item it nests under.
 */
function buildListTree(blocks: PublicCanvasBlock[], start: number): { node: ListTreeNode; next: number } {
  const depth = blocks[start].depth ?? 0;
  const node: ListTreeNode = { kind: blocks[start].listKind ?? "bullet", depth, items: [] };
  let index = start;
  while (index < blocks.length && blocks[index].type === "listItem" && (blocks[index].depth ?? 0) >= depth) {
    if ((blocks[index].depth ?? 0) === depth) {
      node.items.push({ block: blocks[index], children: null });
      index += 1;
    } else {
      const { node: child, next } = buildListTree(blocks, index);
      node.items[node.items.length - 1].children = child;
      index = next;
    }
  }
  return { node, next: index };
}

function ListTree({ node }: { node: ListTreeNode }) {
  const Tag = node.kind === "bullet" ? "ul" : "ol";
  const markerClass =
    node.kind === "bullet"
      ? BULLET_MARKER_CLASSES[node.depth % BULLET_MARKER_CLASSES.length]
      : ORDERED_MARKER_CLASSES[node.depth % ORDERED_MARKER_CLASSES.length];

  return (
    <Tag className={cn("pl-5", node.depth === 0 ? "m-0" : "mt-1 mb-0", markerClass)}>
      {node.items.map((item, index) => (
        <li key={index} className={cn("marker:text-app-ink-faint text-app-ink", node.depth === 0 ? "mb-2 mt-0" : "m-0")}>
          <RunsText runs={item.block.runs} text={item.block.text} />
          {item.children ? <ListTree node={item.children} /> : null}
        </li>
      ))}
    </Tag>
  );
}

/** A saved link, rendered with the preview fields captured from the bookmark row at publish time, or as a bare hostname row when there are none. */
function LinkBlock({ block }: { block: PublicCanvasBlock }) {
  const href = normalizeLinkUrl(block.url ?? "");
  if (!href) return null;
  const hasPreview = Boolean(block.title?.trim() || block.description?.trim() || block.thumbnailUrl?.trim());

  if (!hasPreview) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noreferrer nofollow"
        className="group flex items-center gap-2 rounded-2xl border border-app-line bg-app-surface p-3 text-sm font-medium text-app-ink no-underline transition hover:bg-app-surface-hover"
      >
        <Link2 className="h-4 w-4 shrink-0 text-app-ink-faint" />
        <span className="min-w-0 flex-1 truncate">{hostnameOf(href)}</span>
        <ExternalLink className="h-4 w-4 shrink-0 text-app-ink-faint opacity-0 transition group-hover:opacity-100" />
      </a>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer nofollow"
      className="group flex items-center gap-3 rounded-2xl border border-app-line bg-app-surface p-3 no-underline transition hover:bg-app-surface-hover"
    >
      {block.thumbnailUrl ? (
        <img src={block.thumbnailUrl} alt="" className="h-16 w-24 shrink-0 rounded-xl border border-app-line object-cover" />
      ) : null}
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm font-semibold text-app-ink">{block.title?.trim() || hostnameOf(href)}</p>
        {block.description?.trim() ? (
          <p className="mt-0.5 line-clamp-2 text-xs text-app-ink-muted">{block.description}</p>
        ) : null}
        <p className="mt-1 truncate text-xs text-app-ink-faint">{block.siteName?.trim() || hostnameOf(href)}</p>
      </div>
      <ExternalLink className="h-4 w-4 shrink-0 self-start text-app-ink-faint opacity-0 transition group-hover:opacity-100" />
    </a>
  );
}

/**
 * Renders one published canvas from its plaintext snapshot.
 *
 * The snapshot is a flat block list, not a ProseMirror document — see
 * pageDocToShareBlocks. That keeps the public page free of the editor and its
 * extensions, and means no artifact node id (which points at a private
 * todo/bookmark row) is ever published.
 *
 * Checklist items render read-only. A visitor ticking a box would either do
 * nothing or mutate a stranger's todo; showing state without interaction is
 * the honest option.
 */
export function SharedCanvasBlocks({ blocks }: { blocks: PublicCanvasBlock[] }) {
  const nodes: ReactNode[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];
    const key = `${block.type}-${index}`;

    if (block.type === "listItem") {
      // A run of listItem blocks at the same top-level nesting is one list —
      // buildListTree walks it (and any nested lists inside it) in one pass.
      const { node, next } = buildListTree(blocks, index);
      nodes.push(<ListTree key={key} node={node} />);
      index = next;
      continue;
    }

    switch (block.type) {
      case "heading": {
        const level = block.level ?? 2;
        const className =
          level === 1 ? "text-2xl font-bold text-app-ink"
            : level === 2 ? "text-xl font-bold text-app-ink"
              : "text-lg font-semibold text-app-ink";
        nodes.push(
          <p key={key} className={`${className} mt-3`}>
            <RunsText runs={block.runs} text={block.text} />
          </p>,
        );
        break;
      }
      case "todo":
        nodes.push(
          <div key={key} className="flex items-start gap-2">
            <span
              aria-hidden="true"
              className={[
                "mt-1.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border",
                block.checked ? "border-app-accent bg-app-accent text-app-surface" : "border-app-line-strong",
              ].join(" ")}
            >
              {block.checked ? (
                <svg viewBox="0 0 12 12" className="h-3 w-3">
                  <path d="M2.5 6.5l2.5 2.5 4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
              ) : null}
            </span>
            <span className={block.checked ? "text-app-ink-faint line-through" : "text-app-ink"}>
              <RunsText runs={block.runs} text={block.text} />
            </span>
          </div>,
        );
        break;
      case "link":
        // Preview fields (title/description/thumbnail) come from the bookmark
        // row at publish time — see pageDocToShareBlocks. `LinkBlock` re-checks
        // the url itself (see its own comment) before it ever reaches a
        // visitor's browser.
        nodes.push(<LinkBlock key={key} block={block} />);
        break;
      case "quote":
        nodes.push(
          <blockquote key={key} className="border-l-2 border-app-line-strong pl-4 text-app-ink-muted">
            <RunsText runs={block.runs} text={block.text} />
          </blockquote>,
        );
        break;
      case "code":
        nodes.push(
          <pre key={key} className="overflow-x-auto rounded-xl bg-app-surface-muted p-3 font-mono text-sm text-app-ink">
            {block.text}
          </pre>,
        );
        break;
      case "image":
        // Published copies live under the worker's unauthenticated `p/`
        // prefix, so a visitor with no session can load them directly.
        // A failed publish leaves an empty url — skip rather than render a
        // broken image.
        if (block.url) {
          nodes.push(
            <img
              key={key}
              src={publicPageImageUrl(block.url)}
              alt=""
              loading="lazy"
              className="max-h-[520px] w-full rounded-2xl border border-app-line object-contain"
            />,
          );
        }
        break;
      case "divider":
        nodes.push(<hr key={key} className="my-3 border-t border-app-line" />);
        break;
      default:
        nodes.push(
          <p key={key} className="text-app-ink">
            <RunsText runs={block.runs} text={block.text} />
          </p>,
        );
    }
    index += 1;
  }

  return <div className="flex flex-col gap-3">{nodes}</div>;
}

export function SharedCanvasView({
  canvas,
  onUnshare,
  formatDate,
}: {
  canvas: PublicCanvas;
  onUnshare: () => void;
  formatDate: (ts?: number | null) => string;
}) {
  return (
    <div className="public-page min-h-screen bg-app-canvas">
      <div className="mx-auto w-full max-w-[720px] px-5 py-10">
        <div className="mb-8 flex items-center justify-between gap-3">
          <Link to="/" className="flex items-center gap-2 text-app-ink">
            <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
          </Link>
          {canvas.isOwner ? (
            <button
              type="button"
              onClick={onUnshare}
              className="rounded-full border border-app-line px-3 py-1 text-xs font-medium text-app-ink-muted transition hover:bg-app-surface-hover"
            >
              Stop sharing
            </button>
          ) : null}
        </div>

        <h1 className="text-3xl font-bold text-app-ink md:text-4xl">
          {canvas.title.trim() || "Untitled page"}
        </h1>
        {canvas.description ? (
          <p className="mt-2 text-sm text-app-ink-muted">{canvas.description}</p>
        ) : null}

        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-app-ink-faint">
          {canvas.ownerImageUrl ? (
            <img src={canvas.ownerImageUrl} alt="" className="h-5 w-5 rounded-full" />
          ) : null}
          <span>{canvas.ownerName}</span>
          <span aria-hidden="true">·</span>
          <span>{canvas.viewCount} {canvas.viewCount === 1 ? "view" : "views"}</span>
          {canvas.snapshotUpdatedAt ? (
            <>
              <span aria-hidden="true">·</span>
              <span>Updated {formatDate(canvas.snapshotUpdatedAt)}</span>
            </>
          ) : null}
        </div>

        <div className="mt-8">
          {canvas.blocks.length === 0 ? (
            <p className="text-sm text-app-ink-faint">This page is empty.</p>
          ) : (
            <SharedCanvasBlocks blocks={canvas.blocks} />
          )}
        </div>
      </div>
    </div>
  );
}
