import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { DateKey, TabKey } from "@omanote/shared";
import { searchArtifacts } from "@omanote/shared";
import { useApp } from "../app/AppProvider";

type SearchKind = "todo" | "note" | "bookmark" | "event" | "page";

const kindOrder: SearchKind[] = ["todo", "note", "bookmark", "event", "page"];

// Canvases are not a tab — they have their own route — so this is only ever
// called for the four artifact kinds. See the "page" branch in the result
// click handler below.
function targetTab(kind: Exclude<SearchKind, "page">): TabKey {
  return kind === "todo" ? "todos" : kind === "note" ? "notes" : kind === "bookmark" ? "bookmarks" : "event";
}

function kindLabel(kind: SearchKind) {
  return kind === "todo" ? "Todos"
    : kind === "note" ? "Notes"
    : kind === "bookmark" ? "Bookmarks"
    : kind === "page" ? "Canvases"
    : "Event";
}

export function SearchResultsList({
  maxPerGroup,
  emptyText = "No matches found.",
}: {
  maxPerGroup?: number;
  emptyText?: string;
}) {
  const navigate = useNavigate();
  const { state, dispatch } = useApp();

  const results = useMemo(
    () =>
      searchArtifacts({
        query: state.ui.searchQuery,
        todos: state.todos,
        notes: state.notes,
        bookmarks: state.bookmarks,
        events: state.events,
        pages: state.pages,
      }),
    [state.bookmarks, state.notes, state.events, state.todos, state.pages, state.ui.searchQuery],
  );

  const groupedResults = useMemo(
    () =>
      kindOrder
        .map((kind) => ({
          kind,
          items: results.filter((result) => result.kind === kind).slice(0, maxPerGroup),
        }))
        .filter((group) => group.items.length > 0),
    [maxPerGroup, results],
  );

  if (!state.ui.searchQuery.trim()) {
    return (
      <p className="px-1 py-6 text-sm text-app-ink-muted">
        Start typing to search across your todos, notes, bookmarks, events, and canvases.
      </p>
    );
  }

  if (!groupedResults.length) {
    return <p className="px-1 py-6 text-sm text-app-ink-faint">{emptyText}</p>;
  }

  return (
    <div className="space-y-5">
      {groupedResults.map((group) => (
        <section key={group.kind} className="space-y-2">
          <div className="flex items-center justify-between">
            <h2 className="text-xs font-bold uppercase tracking-[0.18em] text-app-ink-faint">{kindLabel(group.kind)}</h2>
            <span className="text-xs text-app-ink-faint">{group.items.length}</span>
          </div>
          <div>
            {group.items.map((result, index) => (
              <button
                key={`${result.kind}-${result.id}`}
                type="button"
                className={[
                  "flex w-full items-start justify-between gap-3 py-3 text-left transition hover:text-app-ink",
                  index > 0 ? "border-t border-app-line" : "",
                ].join(" ")}
                onClick={() => {
                  if (result.kind === "page") {
                    dispatch({ type: "ui/set-search-open", open: false });
                    navigate(`/p/${result.id}`);
                    return;
                  }
                  const tab = targetTab(result.kind);
                  dispatch({ type: "ui/set-tab", tab });
                  if (result.dateKey) dispatch({ type: "ui/set-selected-date", dateKey: result.dateKey as DateKey });
                  dispatch({ type: "ui/set-search-open", open: false });
                  const focusState =
                    result.kind === "note" ? { focusNoteId: result.id } :
                    result.kind === "todo" ? { focusTodoId: result.id } :
                    result.kind === "bookmark" ? { focusBookmarkId: result.id } :
                    result.kind === "event" ? { focusEventId: result.id } : null;
                  navigate(`/${tab}`, { state: focusState });
                }}
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-bold text-app-ink">{result.title}</p>
                  <p className="mt-0.5 line-clamp-2 text-sm text-app-ink-muted">{result.subtitle}</p>
                </div>
                <span className="shrink-0 text-[11px] uppercase tracking-wide text-app-ink-faint">{result.kind === "page" ? "canvas" : result.kind}</span>
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
