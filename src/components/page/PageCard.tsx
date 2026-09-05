import { useCallback, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Check, Copy, ExternalLink, FileText, Share2, Trash2 } from "lucide-react";
import type { PageItem } from "@omanote/shared";
import { CategoryIconView } from "../../lib/bookmark-category-icon";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const SHARE_DOMAIN = "omanote.com";

function buildShareUrl(codeOrSlug: string) {
  return `https://${SHARE_DOMAIN}/s/${codeOrSlug}`;
}

/**
 * A canvas as it appears in a feed — modelled on BookmarkCard's
 * `surface="canvas"` row so a canvas sits alongside the other artifacts
 * without looking like a different species.
 *
 * The whole card is a link; the hover actions sit above it and stop
 * propagation so clicking "delete" never also opens the canvas.
 */
export function PageCard({
  page,
  onDelete,
  onShare,
}: {
  page: PageItem;
  onDelete?: (pageId: string) => void;
  onShare?: (pageId: string) => void;
}) {
  const [copied, setCopied] = useState(false);
  const href = `/p/${page.id}`;

  // Optimistic (clientKey-only) pages have no server id to look a share up
  // against yet — "skip" until one lands.
  const serverPageId = page.id !== page.clientKey ? page.id : null;
  const share = useQuery(
    api.sharedPages.getPageShare,
    serverPageId ? { pageId: serverPageId as Id<"pages"> } : "skip",
  );
  const isShared = !!share?.isActive;
  const shareUrl = isShared && share ? buildShareUrl(share.customSlug || share.shareCode) : null;

  const copyLink = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault();
      event.stopPropagation();
      if (!shareUrl) return;
      void navigator.clipboard?.writeText(shareUrl).then(
        () => {
          setCopied(true);
          window.setTimeout(() => setCopied(false), 1600);
        },
        // Clipboard access can be denied (permissions, insecure context).
        // Silently leaving the icon unchanged is the honest signal here.
        () => {},
      );
    },
    [shareUrl],
  );

  const title = page.title?.trim() || "Untitled page";
  const snippet = page.preview?.trim();

  return (
    <div className="group relative">
      <Link
        to={href}
        className="flex min-w-0 items-start gap-3 rounded-2xl border border-app-line bg-app-surface p-3 transition hover:bg-app-surface-hover"
      >
        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-surface-muted text-app-ink-faint">
          {page.icon ? <CategoryIconView icon={page.icon} /> : <FileText className="h-4 w-4" />}
        </span>
        <span className="flex min-w-0 flex-col gap-1">
          <span className="truncate text-sm font-semibold text-app-ink">{title}</span>
          {snippet ? (
            <span className="line-clamp-2 text-sm text-app-ink-muted">{snippet}</span>
          ) : (
            <span className="text-sm text-app-ink-faint">Empty page</span>
          )}
        </span>
      </Link>

      <div className="absolute right-3 top-3 z-app-overlay flex items-center gap-1 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
        <a
          href={href}
          target="_blank"
          rel="noreferrer"
          aria-label="open page in a new tab"
          title="Open in new tab"
          onClick={(event) => event.stopPropagation()}
          className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
        {/* Only shows up once there's an actual public link to hand out. */}
        {isShared ? (
          <button
            type="button"
            aria-label={copied ? "share link copied" : "copy share link"}
            title={copied ? "Copied" : "Copy share link"}
            onClick={copyLink}
            className="rounded-full p-1 text-app-line-strong transition duration-200 ease-out hover:bg-app-surface-hover hover:text-app-ink-muted active:scale-95"
          >
            <span className="relative block h-4 w-4">
              <Copy
                className={[
                  "absolute inset-0 h-4 w-4 transition-all duration-200 ease-out",
                  copied ? "scale-75 opacity-0" : "scale-100 opacity-100",
                ].join(" ")}
              />
              <Check
                className={[
                  "absolute inset-0 h-4 w-4 transition-all duration-200 ease-out",
                  copied ? "scale-100 opacity-100" : "scale-75 opacity-0",
                ].join(" ")}
              />
            </span>
          </button>
        ) : null}
        {onShare ? (
          <button
            type="button"
            aria-label="share page"
            title="Share"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onShare(page.id); }}
            className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted"
          >
            <Share2 className="h-4 w-4" />
          </button>
        ) : null}
        {onDelete ? (
          <button
            type="button"
            aria-label="delete page"
            title="Delete"
            onClick={(event) => { event.preventDefault(); event.stopPropagation(); onDelete(page.id); }}
            className="rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-danger-ink"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        ) : null}
      </div>
    </div>
  );
}
