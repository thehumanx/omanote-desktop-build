import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { useParams, Link } from "react-router-dom";
import { api } from "../../convex/_generated/api";
import { getShareViewerToken } from "../lib/share-viewer-token";
import { cn, TodoCheckmark } from "../components/ui";
import { formatCompletedLabel, formatDueChip } from "@omanote/shared";
import { Bookmark, CircleCheckBig, ExternalLink } from "lucide-react";

type PublicBookmark = {
  id: string;
  url: string;
  title: string;
  description?: string;
  thumbnailUrl?: string;
  faviconUrl?: string;
  siteName?: string;
};

type PublicTodoFolder = {
  shareCode: string;
  folderName: string;
  folderIcon: string | null;
  todos: {
    id: string;
    title: string;
    status: "open" | "done";
    dueDateKey?: string;
    dueTime?: string;
    createdAt: number;
    completedAt?: number;
  }[];
  ownerName: string;
  ownerImageUrl?: string;
  viewCount: number;
  createdAt: number;
  snapshotUpdatedAt: number | null;
  isOwner: boolean;
};

type PublicBookmarkFolder = {
  shareCode: string;
  categoryName: string;
  categoryIcon: string | null;
  bookmarks: {
    id: string;
    url: string;
    title: string;
    siteName?: string;
    description?: string;
    thumbnailUrl?: string;
    faviconUrl?: string;
  }[];
  ownerName: string;
  ownerImageUrl?: string;
  viewCount: number;
  createdAt: number;
  snapshotUpdatedAt: number | null;
  isOwner: boolean;
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

function sortTodos(todos: PublicTodoFolder["todos"]) {
  return [...todos].sort((a, b) => {
    const aHasDate = a.dueDateKey != null;
    const bHasDate = b.dueDateKey != null;

    if (aHasDate && bHasDate) {
      if (a.dueDateKey! < b.dueDateKey!) return -1;
      if (a.dueDateKey! > b.dueDateKey!) return 1;
      if (a.dueTime && b.dueTime) {
        if (a.dueTime < b.dueTime) return -1;
        if (a.dueTime > b.dueTime) return 1;
      }
      if (a.dueTime) return -1;
      if (b.dueTime) return 1;
      return a.title.localeCompare(b.title);
    }

    if (aHasDate) return -1;
    if (bHasDate) return 1;

    return a.title.localeCompare(b.title);
  });
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

  const todoData = useQuery(api.sharedTodoFolders.getPublicShare, { shareCode: shareCode ?? "" });
  const bookmarkData = useQuery(api.sharedFolders.getPublicShare, { shareCode: shareCode ?? "" });
  const recordTodoView = useMutation(api.sharedTodoFolders.recordShareView);
  const recordBookmarkView = useMutation(api.sharedFolders.recordShareView);
  const unshare = useMutation(api.sharedFolders.unshareFromPublicPage);

  const isTodo = todoData !== undefined && todoData !== null;
  const data = todoData ?? bookmarkData;
  const recordView = isTodo ? recordTodoView : recordBookmarkView;

  useEffect(() => {
    if (!shareCode || data === undefined || data === null) return;
    void recordView({ shareCode, viewerToken: getShareViewerToken() });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shareCode, data !== null && data !== undefined]);

  useEffect(() => {
    if (!data) return;
    const firstName = data.ownerName.split(" ")[0];
    const label = isTodo ? (todoData as NonNullable<typeof todoData>).folderName : (bookmarkData as NonNullable<typeof bookmarkData>).categoryName;
    document.title = `omanote | ${label} by ${firstName}`;
    return () => {
      document.title = "omanote";
    };
  }, [data, isTodo, todoData, bookmarkData]);

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

  if (isTodo) {
    const td = data as unknown as PublicTodoFolder;
    return (
      <div className="public-page min-h-screen bg-app-canvas">
        <header className="sticky top-0 z-10 border-b border-app-line bg-app-surface/80 backdrop-blur-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link to="/" className="flex items-center transition hover:opacity-70">
              <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
            </Link>
            {td.isOwner && (
              <button
                type="button"
                onClick={async () => {
                  await unshare({ shareCode: td.shareCode });
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
            <h1 className="text-2xl font-bold text-app-ink">
              {td.folderIcon && <span className="mr-2">{td.folderIcon}</span>}
              {td.folderName}
            </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                {td.ownerImageUrl ? (
                  <div className="relative h-6 w-6 overflow-hidden rounded-full bg-app-line">
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase text-app-ink-muted">
                      {td.ownerName.charAt(0)}
                    </div>
                    <img
                      src={td.ownerImageUrl}
                      alt={td.ownerName}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full rounded-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-app-line text-[10px] font-bold uppercase text-app-ink-muted">
                    {td.ownerName.charAt(0)}
                  </div>
                )}
                <span className="text-sm text-app-ink-muted">{td.ownerName}</span>
              </div>
              <span className="text-app-ink-faint">·</span>
              <span className="text-sm text-app-ink-faint">Updated {formatSharedDate(td.snapshotUpdatedAt ?? td.createdAt)}</span>
              <span className="text-app-ink-faint">·</span>
              <span className="text-sm text-app-ink-faint">
                {td.todos.length === 1 ? "1 todo" : `${td.todos.length} todos`}
              </span>
              <span className="text-app-ink-faint">·</span>
              <span className="text-sm text-app-ink-faint">
                {td.viewCount === 0
                  ? "No views yet"
                  : td.viewCount === 1
                    ? "1 view"
                    : `${td.viewCount} views`}
              </span>
            </div>
          </div>

          {td.todos.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-app-line bg-app-surface py-16 text-center">
              <p className="text-sm font-medium text-app-ink-muted">No todos in this folder yet.</p>
            </div>
          ) : (
            <div className="flex flex-col">
              {sortTodos(td.todos).map((todo) => {
                const dueChip = formatDueChip(todo.dueDateKey, todo.dueTime);
                const completedLabel = todo.status === "done" ? formatCompletedLabel(todo.completedAt ?? todo.createdAt) : "";
                return (
                  <div
                    key={todo.id}
                    className="flex items-start gap-3 py-2"
                  >
                    <TodoCheckmark
                      as="span"
                      checked={todo.status === "done"}
                      align="text"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <span className={cn("text-base leading-6", todo.status === "done" ? "text-app-ink-muted line-through" : "text-app-ink")}>
                          {todo.title}
                        </span>
                        {dueChip ? (
                          <span className="rounded-md bg-app-surface-muted px-2 py-0.5 text-[11px] text-app-ink-faint whitespace-nowrap">
                            {dueChip}
                          </span>
                        ) : null}
                        {completedLabel ? (
                          <span className="inline-flex items-center gap-1 text-xs text-app-ink-faint whitespace-nowrap">
                            <CircleCheckBig className="h-3 w-3" />
                            {completedLabel}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </main>
      </div>
    );
  }

  const bd = data as unknown as PublicBookmarkFolder;
  return (
    <div className="public-page min-h-screen bg-app-canvas">
      <header className="sticky top-0 z-10 border-b border-app-line bg-app-surface/80 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link to="/" className="flex items-center transition hover:opacity-70">
            <img src="/logo.svg" alt="Omanote" className="h-7 w-auto" />
          </Link>
          {bd.isOwner && (
            <button
              type="button"
              onClick={async () => {
                  await unshare({ shareCode: bd.shareCode });
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
          <h1 className="text-2xl font-bold text-app-ink">
            {bd.categoryIcon && <span className="mr-2">{bd.categoryIcon}</span>}
            {bd.categoryName}
          </h1>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                {bd.ownerImageUrl ? (
                  <div className="relative h-6 w-6 overflow-hidden rounded-full bg-app-line">
                    <div className="flex h-full w-full items-center justify-center text-[10px] font-bold uppercase text-app-ink-muted">
                      {bd.ownerName.charAt(0)}
                    </div>
                    <img
                      src={bd.ownerImageUrl}
                      alt={bd.ownerName}
                      referrerPolicy="no-referrer"
                      className="absolute inset-0 h-full w-full rounded-full object-cover"
                      onError={(e) => {
                        (e.currentTarget as HTMLImageElement).style.display = "none";
                      }}
                    />
                  </div>
                ) : (
                  <div className="flex h-6 w-6 items-center justify-center rounded-full bg-app-line text-[10px] font-bold uppercase text-app-ink-muted">
                    {bd.ownerName.charAt(0)}
                  </div>
                )}
                <span className="text-sm text-app-ink-muted">{bd.ownerName}</span>
              </div>
              <span className="text-app-ink-faint">·</span>
              <span className="text-sm text-app-ink-faint">Updated {formatSharedDate(bd.snapshotUpdatedAt ?? bd.createdAt)}</span>
              <span className="text-app-ink-faint">·</span>
              <span className="text-sm text-app-ink-faint">
                {bd.bookmarks.length === 1 ? "1 link" : `${bd.bookmarks.length} links`}
              </span>
              <span className="text-app-ink-faint">·</span>
              <span className="text-sm text-app-ink-faint">
                {bd.viewCount === 0
                  ? "No views yet"
                  : bd.viewCount === 1
                    ? "1 view"
                    : `${bd.viewCount} views`}
              </span>
            </div>
          </div>

          {bd.bookmarks.length === 0 ? (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-app-line bg-app-surface py-16 text-center">
              <p className="text-sm font-medium text-app-ink-muted">No bookmarks in this folder yet.</p>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {bd.bookmarks.map((bookmark) => (
              <PublicBookmarkCard key={bookmark.id} bookmark={bookmark} />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
