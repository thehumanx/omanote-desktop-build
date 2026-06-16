import { useMemo, useState } from "react";
import { useQuery } from "convex/react";
import { Info, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { useApp } from "../app/AppProvider";
import { HashtagCombobox } from "../components/HashtagCombobox";
import { HashtagGraph } from "../components/HashtagGraph";
import { SearchResultsList } from "../components/SearchResultsList";
import { BaseModal } from "../components/BaseModal";
import { useTopChrome } from "../components/layout/useTopChrome";

function ExploreInfoModal({ onClose }: { onClose: () => void }) {
  return (
    <BaseModal
      onClose={onClose}
      onBackdropMouseDown={onClose}
      zIndex="z-app-modal"
      className="bg-app-canvas/30 p-6 backdrop-blur-sm"
    >
      <div
        className="relative w-full max-w-sm rounded-3xl bg-app-surface p-6 shadow-app-dialog"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-bold text-app-ink">Welcome to Explore</h2>
        <p className="mt-1 text-xs text-app-ink-faint">Your personal knowledge graph</p>

        <div className="mt-5 space-y-4 text-sm text-app-ink-muted">
          <div className="flex gap-3">
            <span className="text-base leading-none">#</span>
            <div>
              <p className="font-medium text-app-ink">Hashtag mind map</p>
              <p className="mt-0.5 leading-relaxed">
                Every <span className="font-mono text-app-ink-muted">#hashtag</span> you use across notes, todos,
                and events shows up as a node. Tags that appear together get connected so related ideas cluster.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="text-base leading-none">+</span>
            <div>
              <p className="font-medium text-app-ink">Click any tag</p>
              <p className="mt-0.5 leading-relaxed">
                Tap a hashtag to reveal the notes, todos, and events it lives in.
              </p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="text-base leading-none">/</span>
            <div>
              <p className="font-medium text-app-ink">Full-text search</p>
              <p className="mt-0.5 leading-relaxed">
                Start typing in the search bar at the bottom to switch from the mind map to search results.
              </p>
            </div>
          </div>

          <div className="rounded-2xl bg-app-surface-muted px-4 py-3 text-xs leading-relaxed text-app-ink-faint">
            <span className="font-medium text-app-ink-muted">Navigate: </span>
            Drag a tag to move it, drag the background to pan, and scroll to zoom.
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

export function ExploreScreen() {
  const { state } = useApp();
  const allHashtags = useQuery(api.hashtags.listAllUserHashtags, { limit: 300 });
  const [filterHashtags, setFilterHashtags] = useState<string[]>([]);
  const [infoOpen, setInfoOpen] = useState(false);
  const showSearch = state.ui.searchQuery.trim().length > 0;

  const topChrome = useMemo(
    () => (
      <div className="flex h-full w-full min-w-0 items-center gap-3">
        <div className="flex min-w-0 items-center gap-2">
          <h1 className="truncate text-lg font-bold text-app-ink">Explore</h1>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
            aria-label="About Explore"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>
        {!showSearch && (
          allHashtags === undefined
            ? <div className="h-7 w-24 animate-pulse rounded-full bg-app-surface-muted" />
            : allHashtags.length > 0
              ? <HashtagCombobox hashtags={allHashtags} selected={filterHashtags} onChange={setFilterHashtags} align="left" />
              : null
        )}
      </div>
    ),
    [allHashtags, filterHashtags, showSearch],
  );

  useTopChrome(topChrome);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {showSearch ? (
        <div className="mx-auto min-h-0 w-full max-w-[1200px] flex-1 overflow-y-auto px-4 py-4">
          <SearchResultsList emptyText="No matches found." />
        </div>
      ) : (
        <div className="min-h-0 flex-1">
          <HashtagGraph
            filterHashtags={filterHashtags}
            onFilterHashtagsChange={setFilterHashtags}
            showFilter={false}
          />
        </div>
      )}

      {infoOpen && <ExploreInfoModal onClose={() => setInfoOpen(false)} />}
    </div>
  );
}
