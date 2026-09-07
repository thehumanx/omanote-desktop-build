import { useCallback, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "convex/react";
import { Check, Copy, ExternalLink, EyeOff, FileText, Share2, Star, Trash2 } from "lucide-react";
import { formatRelativeEditedAt } from "@omanote/shared";
import type { PageItem } from "@omanote/shared";
import { CategoryIconView } from "../../lib/bookmark-category-icon";
import { pageDocStats } from "../../lib/page-doc";
import { api } from "../../../convex/_generated/api";
import type { Id } from "../../../convex/_generated/dataModel";

const SHARE_DOMAIN = "omanote.com";

function buildShareUrl(codeOrSlug: string) {
  return `https://${SHARE_DOMAIN}/s/${codeOrSlug}`;
}

/** Hover/focus-only visibility — used for the row-1 actions that aren't the star. */
const HOVER_ONLY = "opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100";

/**
 * A canvas as it appears in a feed — modelled on BookmarkCard's
 * `surface="canvas"` row so a canvas sits alongside the other artifacts
 * without looking like a different species.
 *
 * Row 1 (icon left, actions right) is deliberately its own row *outside* the
 * `Link` rather than an absolutely-positioned overlay on top of it — with an
 * overlay, a click that missed a button by a pixel fell through to the Link
 * underneath and opened the canvas. Structuring it as a sibling instead of a
 * layered overlay makes that impossible: the actions simply aren't inside the
 * link element that navigates.
 */
export function PageCard({
  page,
  onDelete,
  onShare,
  onToggleStar,
  onToggleHidden,
}: {
  page: PageItem;
  onDelete?: (pageId: string) => void;
  onShare?: (pageId: string) => void;
  onToggleStar?: (pageId: string, starred: boolean) => void;
  onToggleHidden?: (pageId: string, hidden: boolean) => void;
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

  const copyLink = useCallback(() => {
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
  }, [shareUrl]);

  const title = page.title?.trim() || "Untitled page";
  const stats = useMemo(() => pageDocStats(page.docJson), [page.docJson]);
  const metaItems = [
    formatRelativeEditedAt(page.updatedAt),
    `${stats.words} ${stats.words === 1 ? "word" : "words"}`,
    stats.todos ? `${stats.todos} ${stats.todos === 1 ? "todo" : "todos"}` : null,
    stats.links ? `${stats.links} ${stats.links === 1 ? "link" : "links"}` : null,
    stats.images ? `${stats.images} ${stats.images === 1 ? "image" : "images"}` : null,
  ].filter((item): item is string => item !== null);

  return (
    <div className="group flex min-w-0 flex-col gap-1.5 rounded-2xl border border-app-line bg-app-surface p-3 transition hover:bg-app-surface-hover">
      {/* Row 1: page icon, then the action cluster — spaced apart. */}
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-app-surface-muted text-app-ink-faint">
          {page.icon ? <CategoryIconView icon={page.icon} /> : <FileText className="h-4 w-4" />}
        </span>
        <div className="flex items-center gap-1">
          {onToggleHidden && serverPageId ? (
            <button
              type="button"
              aria-label={page.hidden ? "unhide from continue writing" : "hide from continue writing"}
              title={page.hidden ? "Unhide from Continue writing" : "Hide from Continue writing"}
              onClick={() => onToggleHidden(page.id, !page.hidden)}
              className={`rounded-full p-1 transition hover:bg-app-surface-hover ${HOVER_ONLY} ${page.hidden ? "text-app-ink" : "text-app-line-strong hover:text-app-ink-muted"}`}
            >
              <EyeOff className="h-4 w-4" />
            </button>
          ) : null}
          <a
            href={href}
            target="_blank"
            rel="noreferrer"
            aria-label="open page in a new tab"
            title="Open in new tab"
            className={`rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted ${HOVER_ONLY}`}
          >
            <ExternalLink className="h-4 w-4" />
          </a>
          {/* Hover-only here regardless of starred — unlike the Continue
              writing card, a card in "Your today" doesn't need a persistent
              star badge, since starring only matters for whether it later
              shows up in Continue writing, not for today's own feed. */}
          {onToggleStar && serverPageId ? (
            <button
              type="button"
              aria-label={page.starred ? "unstar page" : "star page"}
              title={page.starred ? "Unstar" : "Star"}
              onClick={() => onToggleStar(page.id, !page.starred)}
              className={`rounded-full p-1 transition hover:bg-app-surface-hover ${HOVER_ONLY} ${page.starred ? "text-app-ink" : "text-app-line-strong hover:text-app-ink-muted"}`}
            >
              <Star className={`h-4 w-4 ${page.starred ? "fill-current" : ""}`} />
            </button>
          ) : null}
          {/* Only shows up once there's an actual public link to hand out. */}
          {isShared ? (
            <button
              type="button"
              aria-label={copied ? "share link copied" : "copy share link"}
              title={copied ? "Copied" : "Copy share link"}
              onClick={copyLink}
              className={`rounded-full p-1 text-app-line-strong transition duration-200 ease-out hover:bg-app-surface-hover hover:text-app-ink-muted active:scale-95 ${HOVER_ONLY}`}
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
              onClick={() => onShare(page.id)}
              className={`rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-app-ink-muted ${HOVER_ONLY}`}
            >
              <Share2 className="h-4 w-4" />
            </button>
          ) : null}
          {onDelete ? (
            <button
              type="button"
              aria-label="delete page"
              title="Delete"
              onClick={() => onDelete(page.id)}
              className={`rounded-full p-1 text-app-line-strong transition hover:bg-app-surface-hover hover:text-danger-ink ${HOVER_ONLY}`}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Rows 2 & 3: title and metadata — the actual "open this canvas" target. */}
      <Link to={href} className="flex min-w-0 flex-col gap-1">
        <span className="app-title-font truncate text-sm font-semibold text-app-ink">{title}</span>
        <span className="truncate text-sm text-app-ink-muted">{metaItems.join(" · ")}</span>
      </Link>
    </div>
  );
}
