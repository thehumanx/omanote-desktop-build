import { useMemo } from "react";
import { Link } from "react-router-dom";
import { ExternalLink, EyeOff, FilePlus2, FileText, Star } from "lucide-react";
import { formatRelativeEditedAt } from "@omanote/shared";
import type { AppAction } from "../../app/types";
import type { PageItem } from "@omanote/shared";
import { CategoryIconView } from "../../lib/bookmark-category-icon";
import { pageDocStats } from "../../lib/page-doc";
import { useCreateCanvas } from "../../lib/use-create-canvas";

/** Hover/focus-only visibility — same idiom as PageCard's row-1 actions. */
const HOVER_ONLY = "opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100";

export const CONTINUE_WRITING_LIMIT = 3;

/**
 * Canvases the user was last working on, so a document written last month is
 * still one tap away instead of being buried in History.
 *
 * Two things earn a spot here, and either is enough on its own: being
 * starred (any number of those, regardless of when they were last touched —
 * starring is how a canvas gets pinned here for good), or being one of the 3
 * most recently edited *non-starred* canvases. The recency slice is computed
 * over non-starred pages specifically, not the combined pool — otherwise 3+
 * starred pages that also happen to be the most recently edited ones would
 * fill all 3 "recent" slots themselves, and a genuinely recently-edited
 * page that isn't starred would never appear even though it's exactly the
 * kind of "what was I just working on" page this section exists for. Star
 * count and recency count are independent budgets, not one shared one. A
 * canvas that's both just shows up once. Hidden canvases never show up here,
 * starred or not.
 *
 * Canvases created today are normally excluded because they already appear
 * as cards in "Your today" directly below — showing them twice on one screen
 * makes the day feed look duplicated. Starring overrides that: it's an
 * explicit "pin this here" signal, so a starred page created today shows up
 * in both places rather than being suppressed from one of them.
 */
export function selectContinueWritingPages(pages: PageItem[], todayKey: string): PageItem[] {
  const eligible = pages
    .filter((page) => !page.deletedAt && !page.hidden && (page.starred || page.createdDateKey !== todayKey))
    .sort((left, right) => right.updatedAt - left.updatedAt);

  const merged = new Map<string, PageItem>();
  for (const page of eligible) {
    if (page.starred) merged.set(page.id, page);
  }
  for (const page of eligible.filter((p) => !p.starred).slice(0, CONTINUE_WRITING_LIMIT)) {
    merged.set(page.id, page);
  }

  return Array.from(merged.values()).sort((left, right) => right.updatedAt - left.updatedAt);
}

/** Word/artifact counts in place of a content snippet — a hidden/starred page
 * still needs *something* useful on its card, and a raw text excerpt reads
 * oddly out of context on a "what was I working on" shelf. */
function PageCardMeta({ page }: { page: PageItem }) {
  const stats = useMemo(() => pageDocStats(page.docJson), [page.docJson]);
  const items = [
    formatRelativeEditedAt(page.updatedAt),
    `${stats.words} ${stats.words === 1 ? "word" : "words"}`,
    stats.todos ? `${stats.todos} ${stats.todos === 1 ? "todo" : "todos"}` : null,
    stats.links ? `${stats.links} ${stats.links === 1 ? "link" : "links"}` : null,
    stats.images ? `${stats.images} ${stats.images === 1 ? "image" : "images"}` : null,
  ].filter((item): item is string => item !== null);

  return <span className="line-clamp-2 min-h-[2.5rem] text-sm text-app-ink-muted">{items.join(" · ")}</span>;
}

function AddPageCard({ onCreate }: { onCreate: () => void }) {
  return (
    <button
      type="button"
      onClick={onCreate}
      className="flex min-h-[6.5rem] min-w-0 flex-col items-center justify-center gap-1.5 rounded-app-card border border-dashed border-app-line px-4 py-3 text-app-ink-faint transition-colors duration-150 hover:bg-app-surface-hover hover:text-app-ink active:scale-[0.99]"
    >
      <FilePlus2 className="h-5 w-5" />
      <span className="text-sm font-medium">New page</span>
    </button>
  );
}

/**
 * Row 1 (icon left, actions right) lives outside the `Link` entirely, same
 * reasoning as PageCard: an overlay sitting on top of the link risked a click
 * falling through and opening the canvas instead of hitting the button.
 */
function ContinueWritingCard({
  page,
  dispatch,
  staticPreview = false,
}: {
  page: PageItem;
  dispatch: (action: AppAction) => void;
  /** See PageCard: show the full card for a fixture page with no server row. */
  staticPreview?: boolean;
}) {
  const href = `/p/${page.id}`;
  // Optimistic (clientKey-only) pages have no server id to patch yet.
  const serverPageId = staticPreview ? page.id : page.id !== page.clientKey ? page.id : null;

  return (
    <div className="group flex min-w-0 flex-col gap-1.5 rounded-app-card border border-app-line bg-app-surface px-4 py-3 transition-colors duration-150 hover:bg-app-surface-hover">
      <div className="flex items-center justify-between gap-2">
        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-app-surface-muted text-app-ink-faint">
          {page.icon ? <CategoryIconView icon={page.icon} /> : <FileText className="h-3.5 w-3.5" />}
        </span>
        <div className="flex items-center gap-1">
          {serverPageId ? (
            <button
              type="button"
              aria-label={page.hidden ? "unhide from continue writing" : "hide from continue writing"}
              title={page.hidden ? "Unhide from Continue writing" : "Hide from Continue writing"}
              onClick={() => dispatch({ type: "page/set-flags", pageId: serverPageId, hidden: !page.hidden })}
              className={`rounded-full p-1 transition hover:bg-app-surface-hover ${HOVER_ONLY} ${page.hidden ? "text-app-ink" : "text-app-line-strong hover:text-app-ink-muted"}`}
            >
              <EyeOff className="h-3.5 w-3.5" />
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
            <ExternalLink className="h-3.5 w-3.5" />
          </a>
          {/* Starred stays visible so it reads as a standing state; unstarred
              follows the same hover-only rule as the rest of the row. */}
          {serverPageId ? (
            <button
              type="button"
              aria-label={page.starred ? "unstar page" : "star page"}
              title={page.starred ? "Unstar" : "Star"}
              onClick={() => dispatch({ type: "page/set-flags", pageId: serverPageId, starred: !page.starred })}
              className={`rounded-full p-1 transition hover:bg-app-surface-hover ${page.starred ? "text-app-ink" : `text-app-line-strong hover:text-app-ink-muted ${HOVER_ONLY}`}`}
            >
              <Star className={`h-3.5 w-3.5 ${page.starred ? "fill-current" : ""}`} />
            </button>
          ) : null}
        </div>
      </div>
      <Link to={href} className="flex min-w-0 flex-col gap-1">
        <span className="app-title-font truncate text-sm font-semibold text-app-ink">{page.title?.trim() || "Untitled page"}</span>
        <PageCardMeta page={page} />
      </Link>
    </div>
  );
}

/**
 * The presentation half. Takes `onCreatePage` as a prop rather than calling
 * `useCreateCanvas` internally, so the landing page's canvas preview can
 * render this without an `AppProvider` — that hook reads `state.pages` and
 * `state.ui.selectedDateKey`, and faking the whole `AppState` to satisfy it
 * would recreate the mockup-drift problem one layer down.
 *
 * This also matches how the component already takes `dispatch`: every other
 * effect it fires is supplied by the caller.
 */
export function CanvasContinueWritingView({
  pages,
  todayKey,
  dispatch,
  onCreatePage,
  staticPreview = false,
}: {
  pages: PageItem[];
  todayKey: string;
  dispatch: (action: AppAction) => void;
  onCreatePage: () => void;
  /** See PageCard: show the full card for fixture pages with no server row. */
  staticPreview?: boolean;
}) {
  const recent = useMemo(() => selectContinueWritingPages(pages, todayKey), [pages, todayKey]);
  const isEmpty = recent.length === 0;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-3">
        <p className="shrink-0 text-[11px] font-extrabold uppercase tracking-[0.16em] text-app-ink-faint">
          {isEmpty ? "Add page" : "Continue"}
        </p>
        <div aria-hidden="true" className="h-px min-w-4 flex-1 bg-app-line" />
        {isEmpty ? null : (
          <Link to="/history?only=pages" className="shrink-0 text-xs font-medium text-app-accent hover:underline">
            View all
          </Link>
        )}
      </div>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {isEmpty ? (
          <AddPageCard onCreate={onCreatePage} />
        ) : (
          recent.map((page) => (
            <ContinueWritingCard key={page.id} page={page} dispatch={dispatch} staticPreview={staticPreview} />
          ))
        )}
      </div>
    </div>
  );
}

export function CanvasContinueWriting(props: { pages: PageItem[]; todayKey: string; dispatch: (action: AppAction) => void }) {
  const createCanvas = useCreateCanvas();
  return <CanvasContinueWritingView {...props} onCreatePage={createCanvas} />;
}
