import { BookmarkCheck, Rss } from "lucide-react";
import { cn } from "../../components/ui";
import { FeedIcon, ReaderItem, timeAgo } from "./reader-shared";

export function ArticleRow({ item, onOpen }: { item: ReaderItem; onOpen: () => void }) {
  return (
    <button
      onClick={onOpen}
      className="flex w-full items-start gap-4 px-4 py-3.5 text-left transition-colors hover:bg-app-surface-hover"
    >
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-xs text-app-ink-faint">
          {!item.readAt ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-app-ink" aria-label="Unread" /> : null}
          <span className="truncate">{item.feedTitle}</span>
          <span className="shrink-0">· {timeAgo(item.publishedAt)}</span>
          {item.savedAt ? <BookmarkCheck className="h-3 w-3 shrink-0" aria-label="Saved" /> : null}
        </p>
        <p className={cn("mt-1 text-[15px] leading-snug", item.readAt ? "text-app-ink-muted" : "font-medium text-app-ink")}>
          {item.title}
        </p>
        {item.summary ? (
          <p className="mt-1 line-clamp-2 text-[13px] leading-5 text-app-ink-faint">{item.summary}</p>
        ) : null}
      </div>
      {item.thumbnailUrl ? (
        <img
          src={item.thumbnailUrl}
          alt=""
          loading="lazy"
          className="mt-1 h-16 w-24 shrink-0 rounded-lg border border-app-line object-cover"
          onError={(e) => (e.currentTarget.style.display = "none")}
        />
      ) : null}
    </button>
  );
}

// Compact card for the saved view — matches the horizontal BookmarkCard layout.
export function SavedArticleCard({ item, onOpen }: { item: ReaderItem; onOpen: () => void }) {
  return (
    <button
      type="button"
      onClick={onOpen}
      className="group h-[260px] w-full overflow-hidden rounded-2xl border border-app-line bg-app-surface text-left transition duration-200 ease-out hover:shadow-soft"
    >
      <div className="relative flex h-full flex-col gap-3 p-3">
        {/* Thumbnail */}
        <div className="aspect-[1.91/1] overflow-hidden rounded-md bg-app-surface-muted">
          {item.thumbnailUrl ? (
            <img
              src={item.thumbnailUrl}
              alt=""
              loading="lazy"
              className="h-full w-full object-cover"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-app-ink-faint">
              <Rss className="h-8 w-8" />
            </div>
          )}
        </div>
        {/* Title + description */}
        <div className="min-h-[68px] flex-1 space-y-1 overflow-hidden">
          <p className="line-clamp-2 text-sm font-bold leading-5 text-app-ink">{item.title}</p>
          {item.summary ? (
            <p className="line-clamp-2 text-sm leading-5 text-app-ink-faint">{item.summary}</p>
          ) : null}
        </div>
        {/* Feed name + time */}
          <div className="flex items-center gap-2">
          <FeedIcon faviconUrl={item.faviconUrl} className="h-4 w-4" />
          <p className="min-w-0 flex-1 truncate text-xs font-medium text-app-ink-faint">{item.feedTitle}</p>
          <span className="shrink-0 text-xs text-app-ink-faint">{timeAgo(item.publishedAt)}</span>
        </div>
      </div>
    </button>
  );
}
