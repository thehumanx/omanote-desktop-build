import { useMemo } from "react";
import { useApp } from "../app/AppProvider";
import { SearchResultsList } from "../components/SearchResultsList";
import { useTopChrome } from "../components/layout/useTopChrome";
import { Input } from "../components/ui";

export function SearchScreen() {
  const { state, dispatch } = useApp();

  const topChrome = useMemo(
    () => (
      <div className="flex h-full w-full items-center">
        <Input
          value={state.ui.searchQuery}
          onChange={(event) => dispatch({ type: "ui/set-search-query", query: event.target.value })}
          placeholder="Search canvas, todos, notes, bookmarks, and events"
          autoFocus
        />
      </div>
    ),
    [dispatch, state.ui.searchQuery],
  );
  useTopChrome(topChrome);

  return (
    <div className="flex flex-1 flex-col">
      <SearchResultsList emptyText="No matches found." />
    </div>
  );
}
