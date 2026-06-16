import { useAction } from "convex/react";
import { Bookmark } from "lucide-react";
import { useEffect, useState } from "react";
import { api } from "../../convex/_generated/api";
import { extractFirstPreviewableUrl } from "../lib/attachment-link-preview";
import { cn } from "./ui";
import { db, isLinkPreviewFresh } from "../app/db";

type LinkPreview = {
  url: string;
  title: string;
  siteName?: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
};

const previewCache = new Map<string, LinkPreview | null>();
const inflightPreviewRequests = new Map<string, Promise<LinkPreview | null>>();

function normalizeText(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function normalizePreview(url: string, payload: unknown): LinkPreview | null {
  if (!payload || typeof payload !== "object") return null;
  const record = payload as Record<string, unknown>;
  const nextUrl = normalizeText(record.url) || url;
  const title = normalizeText(record.title);
  if (!title) return null;
  return {
    url: nextUrl,
    title,
    siteName: normalizeText(record.siteName) || undefined,
    description: normalizeText(record.description) || undefined,
    thumbnailUrl: normalizeText(record.thumbnailUrl) || undefined,
    faviconUrl: normalizeText(record.faviconUrl) || undefined,
  };
}

function domainFromUrl(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url.replace(/^https?:\/\//, "").replace(/^www\./, "");
  }
}

function fallbackPreview(url: string): LinkPreview {
  const domain = domainFromUrl(url);
  return {
    url,
    title: domain,
    siteName: domain,
  };
}

async function fetchPreviewWithCache(
  url: string,
  fetchLinkPreview: (args: { url: string }) => Promise<unknown>,
) {
  const cached = previewCache.get(url);
  if (cached !== undefined) return cached;

  const inflight = inflightPreviewRequests.get(url);
  if (inflight) return inflight;

  const nextRequest = (async () => {
    const stored = await db.linkPreviews.get(url).catch(() => undefined);
    if (stored && isLinkPreviewFresh(stored)) {
      const result = normalizePreview(url, stored);
      previewCache.set(url, result);
      inflightPreviewRequests.delete(url);
      return result;
    }

    return fetchLinkPreview({ url })
      .then((payload) => normalizePreview(url, payload))
      .catch(() => null)
      .then((result) => {
        previewCache.set(url, result);
        inflightPreviewRequests.delete(url);
        if (result) {
          db.linkPreviews.put({ ...result, fetchedAt: Date.now() }).catch(() => undefined);
        }
        return result;
      });
  })();

  inflightPreviewRequests.set(url, nextRequest);
  return nextRequest;
}

function useLinkPreview(linkUrl: string | undefined) {
  const fetchLinkPreview = useAction((api as any)["actions/linkPreview"].fetchLinkPreview);
  const [preview, setPreview] = useState<LinkPreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!linkUrl) {
      setPreview(null);
      setLoading(false);
      return;
    }

    const cached = previewCache.get(linkUrl);
    if (cached !== undefined) {
      setPreview(cached);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);
    setPreview(null);
    void fetchPreviewWithCache(linkUrl, fetchLinkPreview as (args: { url: string }) => Promise<unknown>).then((nextPreview) => {
      if (cancelled) return;
      setPreview(nextPreview);
      setLoading(false);
    });

    return () => {
      cancelled = true;
    };
  }, [fetchLinkPreview, linkUrl]);

  return { preview, loading };
}

export function UrlLinkPreview({ url, className }: { url: string; className?: string }) {
  const { preview, loading } = useLinkPreview(url);
  const resolvedPreview = preview ?? fallbackPreview(url);
  const siteLabel = resolvedPreview.siteName ?? domainFromUrl(resolvedPreview.url);
  const thumbnailUrl = resolvedPreview.thumbnailUrl;
  const faviconUrl = resolvedPreview.faviconUrl;

  return (
    <a
      href={resolvedPreview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className={cn(
        "group/attachment block w-full overflow-hidden rounded-xl border border-app-line bg-app-surface transition hover:border-app-line-strong",
        className,
      )}
    >
      <div className="flex items-stretch gap-3 p-2.5">
        <div className="relative flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-lg border border-app-line bg-app-surface-muted text-app-ink-faint">
          <Bookmark className="absolute h-6 w-6" />
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="relative z-10 h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="relative flex h-4 w-4 flex-none items-center justify-center overflow-hidden rounded-sm bg-app-surface-muted text-app-ink-faint">
              <Bookmark className="absolute h-3.5 w-3.5" />
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="relative z-10 h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <p className="min-w-0 truncate text-xs font-medium text-app-ink-faint">{siteLabel}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-app-ink">{resolvedPreview.title}</p>
          {loading ? (
            <p className="mt-1 text-xs text-app-ink-faint">Fetching preview...</p>
          ) : resolvedPreview.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-app-ink-muted">{resolvedPreview.description}</p>
          ) : null}
        </div>
      </div>
    </a>
  );
}

export function AttachmentLinkPreview({
  textValues,
  className,
}: {
  textValues: Array<string | undefined | null>;
  className?: string;
}) {
  const linkUrl = extractFirstPreviewableUrl(...textValues);
  const { preview, loading } = useLinkPreview(linkUrl);

  if (!linkUrl) return null;

  const resolvedPreview = preview ?? fallbackPreview(linkUrl);
  const siteLabel = resolvedPreview.siteName ?? domainFromUrl(resolvedPreview.url);
  const thumbnailUrl = resolvedPreview.thumbnailUrl;
  const faviconUrl = resolvedPreview.faviconUrl;

  return (
    <a
      href={resolvedPreview.url}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        event.stopPropagation();
      }}
      className={cn(
        "group/attachment block w-full max-w-[440px] overflow-hidden rounded-xl border border-app-line bg-app-surface transition hover:border-app-line-strong",
        className,
      )}
    >
      <div className="flex items-stretch gap-3 p-2.5">
        <div className="relative flex h-20 w-20 flex-none items-center justify-center overflow-hidden rounded-lg border border-app-line bg-app-surface-muted text-app-ink-faint">
          <Bookmark className="absolute h-6 w-6" />
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="relative z-10 h-full w-full object-cover"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          ) : null}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="relative flex h-4 w-4 flex-none items-center justify-center overflow-hidden rounded-sm bg-app-surface-muted text-app-ink-faint">
              <Bookmark className="absolute h-3.5 w-3.5" />
              {faviconUrl ? (
                <img
                  src={faviconUrl}
                  alt=""
                  referrerPolicy="no-referrer"
                  className="relative z-10 h-full w-full object-cover"
                  onError={(e) => {
                    (e.currentTarget as HTMLImageElement).style.display = "none";
                  }}
                />
              ) : null}
            </div>
            <p className="min-w-0 truncate text-xs font-medium text-app-ink-faint">{siteLabel}</p>
          </div>
          <p className="mt-1 line-clamp-2 text-sm font-bold leading-5 text-app-ink">{resolvedPreview.title}</p>
          {loading ? (
            <p className="mt-1 text-xs text-app-ink-faint">Fetching preview...</p>
          ) : resolvedPreview.description ? (
            <p className="mt-1 line-clamp-2 text-xs leading-4 text-app-ink-muted">{resolvedPreview.description}</p>
          ) : null}
        </div>
      </div>
    </a>
  );
}
