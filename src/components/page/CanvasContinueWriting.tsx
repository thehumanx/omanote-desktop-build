import { useMemo } from "react";
import { Link } from "react-router-dom";
import { formatRelativeEditedAt } from "@omanote/shared";
import type { PageItem } from "@omanote/shared";
import { CategoryIconView } from "../../lib/bookmark-category-icon";

export const CONTINUE_WRITING_LIMIT = 3;

/**
 * Canvases the user was last working on, so a document written last month is
 * still one tap away instead of being buried in History.
 *
 * Ordered by last edit rather than creation — "what was I in the middle of" is
 * the question this answers. Canvases created today are excluded because they
 * already appear as cards in "Your today" directly below; showing them twice
 * on one screen makes the day feed look duplicated.
 */
export function selectContinueWritingPages(pages: PageItem[], todayKey: string): PageItem[] {
  return pages
    .filter((page) => !page.deletedAt && page.createdDateKey !== todayKey)
    .sort((left, right) => right.updatedAt - left.updatedAt)
    .slice(0, CONTINUE_WRITING_LIMIT);
}

export function CanvasContinueWriting({ pages, todayKey }: { pages: PageItem[]; todayKey: string }) {
  const recent = useMemo(() => selectContinueWritingPages(pages, todayKey), [pages, todayKey]);

  if (recent.length === 0) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">Continue writing</p>
        <Link to="/history?only=pages" className="text-xs font-medium text-app-accent hover:underline">
          View all
        </Link>
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {recent.map((page) => (
          <Link
            key={page.id}
            to={`/p/${page.id}`}
            className="flex min-w-0 flex-col gap-1.5 rounded-lg border border-app-line bg-app-surface px-4 py-3 transition-colors duration-150 hover:bg-app-surface-hover active:scale-[0.99]"
          >
            <span className="flex min-w-0 items-center gap-1.5 truncate text-sm font-semibold text-app-ink">
              {page.icon ? (
                <span className="shrink-0 text-app-ink-faint">
                  <CategoryIconView icon={page.icon} />
                </span>
              ) : null}
              <span className="truncate">{page.title?.trim() || "Untitled page"}</span>
            </span>
            <span className="line-clamp-2 min-h-[2.5rem] text-sm text-app-ink-muted">
              {page.preview?.trim() || "Empty page"}
            </span>
            <span className="text-xs text-app-ink-faint">{formatRelativeEditedAt(page.updatedAt)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
