import { useEffect, useMemo, useState } from "react";
import { ConvexError } from "convex/values";
import DOMPurify from "dompurify";
import { Check, Rss } from "lucide-react";
import type { Id } from "../../../convex/_generated/dataModel";
import { RssFetchError } from "../../lib/rssFetcher";
import { cn } from "../../components/ui";
import { RemoteImage } from "../../components/RemoteImage";

DOMPurify.addHook("afterSanitizeAttributes", (node) => {
  if (node.tagName === "A") {
    node.setAttribute("target", "_blank");
    node.setAttribute("rel", "noopener noreferrer");
  }
});

/** A 1×1 or hidden image: almost always an open-tracking pixel, never content. */
function isTrackingPixel(img: HTMLImageElement): boolean {
  const tiny = (value: string | null) => value !== null && /^\s*[01](px)?\s*$/i.test(value);
  if (tiny(img.getAttribute("width")) || tiny(img.getAttribute("height"))) return true;
  const style = (img.getAttribute("style") ?? "").replace(/\s+/g, "").toLowerCase();
  return /(^|;)display:none/.test(style) || /(^|;)visibility:hidden/.test(style) || /(^|;)(width|height):[01]px/.test(style);
}

/**
 * Sanitises a feed article's HTML for display, and limits what showing it
 * reveals to other servers.
 *
 * Always: tracking pixels are dropped (newsletters embed them to learn when,
 * and from where, an issue was read), and every remaining image is fetched
 * lazily with no referrer. With `blockImages`, nothing remote is fetched at
 * all — images, `<picture>` sources, video posters and CSS backgrounds are
 * removed — and `hiddenImages` says how many, so the reader can offer to load
 * them.
 */
export function prepareArticleHtml(html: string, { blockImages = false }: { blockImages?: boolean } = {}): {
  html: string;
  hiddenImages: number;
} {
  const fragment = DOMPurify.sanitize(html, {
    USE_PROFILES: { html: true },
    FORBID_TAGS: ["style", "form", "input", "button"],
    RETURN_DOM_FRAGMENT: true,
  });
  let hiddenImages = 0;

  for (const img of Array.from(fragment.querySelectorAll("img"))) {
    if (isTrackingPixel(img)) {
      img.remove();
    } else if (blockImages) {
      img.remove();
      hiddenImages += 1;
    } else {
      img.setAttribute("referrerpolicy", "no-referrer");
      img.setAttribute("loading", "lazy");
      img.setAttribute("decoding", "async");
    }
  }

  if (blockImages) {
    // Other ways the same HTML would still reach out for media.
    for (const element of Array.from(fragment.querySelectorAll("picture, source, video, audio"))) {
      element.remove();
    }
    for (const element of Array.from(fragment.querySelectorAll("[srcset], [poster], [background], [style]"))) {
      element.removeAttribute("srcset");
      element.removeAttribute("poster");
      element.removeAttribute("background");
      if (/url\s*\(/i.test(element.getAttribute("style") ?? "")) element.removeAttribute("style");
    }
  }

  const container = document.createElement("div");
  container.appendChild(fragment);
  return { html: container.innerHTML, hiddenImages };
}

export function timeAgo(timestamp: number): string {
  const seconds = Math.floor((Date.now() - timestamp) / 1000);
  if (seconds < 60) return "now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d`;
  const date = new Date(timestamp);
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function normalizeBaseUrl(rawUrl?: string): string | null {
  if (!rawUrl?.trim()) return null;
  try {
    return new URL(rawUrl.trim()).origin;
  } catch {
    return null;
  }
}

function getFeedIconCandidates(faviconUrl?: string, siteUrl?: string, feedUrl?: string): string[] {
  const candidates = new Set<string>();
  const add = (value?: string) => {
    const trimmed = value?.trim();
    if (trimmed) candidates.add(trimmed);
  };

  add(faviconUrl);

  const origin = normalizeBaseUrl(siteUrl) ?? normalizeBaseUrl(feedUrl);
  if (origin) {
    add(`${origin}/favicon.ico`);
    add(`${origin}/apple-touch-icon.png`);
    add(`${origin}/apple-touch-icon-precomposed.png`);
    add(`${origin}/logo.png`);
    add(`${origin}/logo.svg`);
  }

  return [...candidates];
}

// Enriched item type — raw rssItem (client-only) + joined feed/read-state fields.
export type ReaderItem = {
  _id: string;
  feedId: Id<"rssFeeds">;
  guid: string;
  url?: string;
  title: string;
  author?: string;
  summary?: string;
  contentHtml?: string;
  thumbnailUrl?: string;
  publishedAt: number;
  feedTitle: string;
  faviconUrl?: string;
  readAt?: number;
  savedAt?: number;
};

// Server errors carry a code (ConvexError); everything else gets the fallback.
// Raw error text is never shown to the user.
const ERROR_COPY: Record<string, string> = {
  bad_url: "That doesn't look like a web address. Double-check it and try again.",
  unreachable: "We couldn't reach that site. Check the address and try again.",
  no_feed_found:
    "We couldn't find a feed on that site. If you know the feed link (it often ends in /feed or /rss), paste it directly.",
  unparseable: "We found a feed, but it seems to be broken and can't be read right now.",
  rss_feed_limit: "You've reached the feed limit for the free plan.",
};

const RSS_FETCH_ERROR_COPY: Record<string, string> = {
  network: "We couldn't reach the feed. Check your connection and try again.",
  parse: "We found a feed, but it seems to be broken and can't be read right now.",
  unknown: "Something went wrong while fetching the feed. Please try again.",
};

/**
 * Copy for the reader's own failure codes (feed discovery, subscribing,
 * fetching). Not the app-wide `friendlyErrorMessage` in src/lib/errors.ts —
 * that one surfaces a server message; this one maps known reader codes and
 * otherwise shows the fallback. Named apart so the two aren't mixed up.
 */
export function readerErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof ConvexError) {
    const data = err.data as { code?: string } | string | undefined;
    const code = typeof data === "string" ? data : data?.code;
    if (code && ERROR_COPY[code]) return ERROR_COPY[code];
  }
  if (err instanceof RssFetchError) {
    if (RSS_FETCH_ERROR_COPY[err.code]) return RSS_FETCH_ERROR_COPY[err.code];
  }
  return fallback;
}

export type DiscoverResult = {
  feedUrl: string;
  title: string;
  description?: string;
  siteUrl?: string;
  faviconUrl?: string;
  itemCount: number;
  latestItemTitle?: string;
};

export function FeedIcon({
  faviconUrl,
  siteUrl,
  feedUrl,
  className,
}: {
  faviconUrl?: string;
  siteUrl?: string;
  feedUrl?: string;
  className?: string;
}) {
  const candidates = useMemo(() => getFeedIconCandidates(faviconUrl, siteUrl, feedUrl), [faviconUrl, siteUrl, feedUrl]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    setIndex(0);
  }, [faviconUrl, siteUrl, feedUrl]);

  if (!candidates.length) {
    return <Rss className={cn("shrink-0 text-app-ink-faint", className)} />;
  }

  const src = candidates[Math.min(index, candidates.length - 1)];
  const showPlaceholder = index >= candidates.length;

  if (showPlaceholder) {
    return <Rss className={cn("shrink-0 text-app-ink-faint", className)} />;
  }

  return (
    <RemoteImage
      src={src}
      alt=""
      className={cn("shrink-0 rounded-sm", className)}
      onError={() => setIndex((current) => Math.min(current + 1, candidates.length))}
    />
  );
}

export type Subscription = {
  _id: Id<"rssSubscriptions">;
  feedId: Id<"rssFeeds">;
  categoryId?: Id<"rssCategories">;
  customTitle?: string;
  title: string;
  feedUrl: string;
  siteUrl?: string;
  faviconUrl?: string;
  description?: string;
  lastFetchedAt: number;
  lastFetchStatus?: string;
  lastMarkAllReadAt?: number;
  createdAt: number;
};

export type ReaderCategory = { _id: Id<"rssCategories">; name: string; icon?: string };


// Per-feed actions offered by FeedNavRow's menu.
export type FeedMenuActions = {
  subscriptionId: Id<"rssSubscriptions">;
  feedId: Id<"rssFeeds">;
  categoryId?: Id<"rssCategories">;
  categories: ReaderCategory[];
  scheduleSync: () => void;
};


// Computes a menu position that stays within the viewport.
// Right-aligns to the anchor when the naive left position would overflow.
export function menuPosition(rect: DOMRect, estimatedWidth = 190): { top: number; left: number } {
  const margin = 12;
  // Right-align menu with the button, then clamp so it never overflows either edge
  const left = Math.max(margin, Math.min(rect.right - estimatedWidth, window.innerWidth - estimatedWidth - margin));
  return { top: rect.bottom + 4, left };
}
