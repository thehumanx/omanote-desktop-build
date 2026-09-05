import { Link } from "react-router-dom";
import { ExternalLink } from "lucide-react";
import { normalizeLinkUrl } from "@omanote/shared";
import { publicPageImageUrl } from "../lib/page-images";

export interface PublicCanvasBlock {
  type: string;
  text?: string;
  level?: number;
  url?: string;
  checked?: boolean;
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
  return (
    <div className="flex flex-col gap-3">
      {blocks.map((block, index) => {
        const key = `${block.type}-${index}`;
        switch (block.type) {
          case "heading": {
            const level = block.level ?? 2;
            const className =
              level === 1 ? "text-2xl font-bold text-app-ink"
                : level === 2 ? "text-xl font-bold text-app-ink"
                  : "text-lg font-semibold text-app-ink";
            return <p key={key} className={`${className} mt-3`}>{block.text}</p>;
          }
          case "todo":
            return (
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
                  {block.text}
                </span>
              </div>
            );
          case "listItem":
            return (
              <div key={key} className="flex items-start gap-2 text-app-ink">
                <span aria-hidden="true" className="mt-2 h-1 w-1 shrink-0 rounded-full bg-app-ink-faint" />
                <span>{block.text}</span>
              </div>
            );
          case "link": {
            // Re-checked at render even though `pageBookmark`'s url attribute
            // is only ever set from normalizeLinkUrl today. This is the one
            // place a stored url is handed to a *visitor's* browser on our own
            // origin, so a `javascript:` value arriving here — via some future
            // path that skips the editor, or a hand-edited document — would be
            // stored XSS. The allowlist is cheap; the assumption upstream is
            // not one this file should have to depend on.
            const href = normalizeLinkUrl(block.url ?? "");
            if (!href) return null;
            return (
              <a
                key={key}
                href={href}
                target="_blank"
                rel="noreferrer nofollow"
                className="group flex items-center gap-2 rounded-2xl border border-app-line bg-app-surface p-3 text-sm font-medium text-app-ink no-underline transition hover:bg-app-surface-hover"
              >
                <span className="min-w-0 flex-1 truncate">{hostnameOf(href)}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-app-ink-faint opacity-0 transition group-hover:opacity-100" />
              </a>
            );
          }
          case "quote":
            return (
              <blockquote key={key} className="border-l-2 border-app-line-strong pl-4 text-app-ink-muted">
                {block.text}
              </blockquote>
            );
          case "code":
            return (
              <pre key={key} className="overflow-x-auto rounded-xl bg-app-surface-muted p-3 font-mono text-sm text-app-ink">
                {block.text}
              </pre>
            );
          case "image":
            // Published copies live under the worker's unauthenticated `p/`
            // prefix, so a visitor with no session can load them directly.
            // A failed publish leaves an empty url — skip rather than render a
            // broken image.
            return block.url ? (
              <img
                key={key}
                src={publicPageImageUrl(block.url)}
                alt=""
                loading="lazy"
                className="max-h-[520px] w-full rounded-2xl border border-app-line object-contain"
              />
            ) : null;
          case "divider":
            return <hr key={key} className="my-3 border-t border-app-line" />;
          default:
            return <p key={key} className="text-app-ink">{block.text}</p>;
        }
      })}
    </div>
  );
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
