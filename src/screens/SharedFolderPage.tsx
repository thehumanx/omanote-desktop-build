import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { getShareViewerToken } from "../lib/share-viewer-token";
import { Bookmark, ExternalLink } from "lucide-react";

type PublicBookmark = {
  id: string;
  url: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  siteName?: string;
};

function PublicBookmarkCard({ bookmark }: { bookmark: PublicBookmark }) {
  let domain = bookmark.url;
  try {
    domain = new URL(bookmark.url).hostname.replace(/^www\./, "");
  } catch {
    domain = bookmark.url;
  }

  const siteLabel = bookmark.siteName?.trim() || domain;
  const logoUrl = bookmark.faviconUrl?.trim() || undefined;
  const thumbnailUrl = bookmark.thumbnailUrl?.trim() || undefined;
  const displayTitle = bookmark.title?.trim() || domain;
  const displayDescription = bookmark.description?.trim() || undefined;

  return (
    <a
      href={bookmark.url}
      target="_blank"
      rel="noopener noreferrer"
      className="group flex flex-col overflow-hidden rounded-2xl border border-app-line bg-app-surface transition hover:border-app-line hover:shadow-sm"
    >
      {thumbnailUrl && (
        <div className="aspect-[2/1] w-full overflow-hidden bg-app-surface-muted">
          <div className="relative h-full w-full">
            <div className="absolute inset-0 flex items-center justify-center text-app-ink-faint">
              <Bookmark className="h-8 w-8" />
            </div>
            <img
              src={thumbnailUrl}
              alt=""
              referrerPolicy="no-referrer"
              className="relative z-10 h-full w-full object-cover transition group-hover:scale-[1.02]"
              onError={(e) => {
                (e.currentTarget as HTMLImageElement).style.display = "none";
              }}
            />
          </div>
        </div>
      )}
      <div className="flex flex-col gap-1.5 p-4">
        <p className="line-clamp-2 text-[15px] font-bold leading-snug text-app-ink">
          {displayTitle}
        </p>
        {displayDescription && (
          <p className="line-clamp-2 text-sm leading-relaxed text-app-ink-muted">
            {displayDescription}
          </p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          {logoUrl && (
            <div className="relative h-4 w-4 flex-shrink-0 overflow-hidden rounded-sm bg-app-surface-muted text-app-ink-faint">
              <Bookmark className="absolute inset-0 h-3.5 w-3.5" />
              <img
                src={logoUrl}
                alt=""
                referrerPolicy="no-referrer"
                className="absolute inset-0 h-full w-full object-contain"
                onError={(e) => {
                  (e.currentTarget as HTMLImageElement).style.display = "none";
                }}
              />
            </div>
          )}
          <span className="truncate text-xs text-app-ink-faint">{siteLabel}</span>
          <ExternalLink className="ml-auto h-3 w-3 flex-shrink-0 text-app-ink-faint opacity-0 transition group-hover:opacity-100" />
        </div>
      </div>
    </a>
  );
}

function formatSharedDate(ts: number) {
  return new Date(ts).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export function SharedFolderPage() {
  const { shareCode } = useParams<{ shareCode: string }>();
  const data = useQuery(api.sharedFolders.getPublicShare, {
    shareCode: shareCode ?? "",
  });
  const recordView = useMutation(api.sharedFolders.recordShareView);
  const unshare = useMutation(api.sharedFolders.unshareFromPublicPage);

  useEffect(() => {
    if (!shareCode || data === undefined || data === null) return;
    void recordView({ shareCode, viewerToken: getShareViewerToken() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, data !== null && data !== undefined]);

  useEffect(() => {
    if (!data) return;
    const firstName = data.ownerName.split(" ")[0];
    document.title = `omanote | ${data.categoryName} by ${firstName}`;
    return () => {
      document.title = "omanote";
    };
  }, [data]);

  if (data === undefined) {
    return (
      <div className="public-page flex min-h-screen items-center justify-center bg-app-canvas">
        <div className="h-8 w-8 animate-pulse rounded-full bg-app-line" />
      </div>
    );
  }

  if (data === null) {
    return (
      <div className="public-page flex min-h-screen flex-col items-center justify-center gap-4 bg-app-canvas px-4">
        <Link to="/" className="flex items-center gap-2 text-app-ink">
          <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
        </Link>
        <p className="text-sm text-app-ink-muted">This link is no longer available.</p>
      </div>
    );
  }

  return (
    <div className="public-page min-h-screen bg-app-canvas">
      <header className="sticky top-0 z-10 border-b border-app-line bg-app-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center transition hover:opacity-70">
            <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
          </Link>
          {data.isOwner && (
            <button
              type="button"
              onClick={async () => {
                await unshare({ shareCode: data.shareCode });
              }}
              className="rounded-lg border border-danger-line bg-danger-surface px-3 py-1.5 text-xs font-medium text-danger-ink transition hover:bg-danger-surface"
            >
              Unshare
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-app-ink">{data.categoryName}</h1>
          <div className="mt-3 flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-2">
              {data.ownerImageUrl ? (
                <div className="relative h-6 w-6 overflow-hidden rounded-full bg-app-line">
                  <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase text-app-ink-muted">
                    {data.ownerName.charAt(0)}
                  </div>
                  <img
                    src={data.ownerImageUrl}
                    alt={data.ownerName}
                    referrerPolicy="no-referrer"
                    className="absolute inset-0 h-full w-full rounded-full object-cover"
                    onError={(e) => {
                      (e.currentTarget as HTMLImageElement).style.display = "none";
                    }}
                  />
                </div>
              ) : (
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-app-line text-[10px] font-bold uppercase text-app-ink-muted">
                  {data.ownerName.charAt(0)}
                </div>
              )}
              <span className="text-sm text-app-ink-muted">{data.ownerName}</span>
            </div>
            <span className="text-app-ink-faint">·</span>
            <span className="text-sm text-app-ink-faint">Updated {formatSharedDate(data.snapshotUpdatedAt ?? data.createdAt)}</span>
            <span className="text-app-ink-faint">·</span>
            <span className="text-sm text-app-ink-faint">
              {data.bookmarks.length === 1 ? "1 link" : `${data.bookmarks.length} links`}
            </span>
            <span className="text-app-ink-faint">·</span>
            <span className="text-sm text-app-ink-faint">
              {data.viewCount === 0
                ? "No views yet"
                : data.viewCount === 1
                  ? "1 view"
                  : `${data.viewCount} views`}
            </span>
          </div>
        </div>

        {data.bookmarks.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-app-line bg-app-surface py-16 text-center">
            <p className="text-sm font-medium text-app-ink-muted">No bookmarks in this folder yet.</p>
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {data.bookmarks.map((bookmark) => (
              <PublicBookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
