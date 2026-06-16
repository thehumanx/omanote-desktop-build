import { useState } from "react";
import { Info, X } from "lucide-react";
import { useApp } from "../app/AppProvider";
import { SearchResultsList } from "./SearchResultsList";
import { HashtagGraph } from "./HashtagGraph";
import { BaseModal } from "./BaseModal";

// ---------------------------------------------------------------------------
// Info modal
// ---------------------------------------------------------------------------

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
        onMouseDown={(e) => e.stopPropagation()}
      >
        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full p-1.5 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>

        <h2 className="text-lg font-bold text-app-ink">Welcome to Explore ✨</h2>
        <p className="mt-1 text-xs text-app-ink-faint">Your personal knowledge graph</p>

        <div className="mt-5 space-y-4 text-sm text-app-ink-muted">
          <div className="flex gap-3">
            <span className="text-base leading-none">🔗</span>
            <div>
              <p className="font-medium text-app-ink">Hashtag mind map</p>
              <p className="mt-0.5 leading-relaxed">Every <span className="font-mono text-app-ink-muted">#hashtag</span> you've used across notes, todos, and events shows up as a node. Tags that appear together get connected — so you can spot which ideas naturally cluster.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="text-base leading-none">👆</span>
            <div>
              <p className="font-medium text-app-ink">Click any tag</p>
              <p className="mt-0.5 leading-relaxed">Tap a hashtag to reveal the notes, todos, and events it lives in. They fan out around the tag so you see all the context at once.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="text-base leading-none">🔍</span>
            <div>
              <p className="font-medium text-app-ink">Full-text search</p>
              <p className="mt-0.5 leading-relaxed">Start typing in the search bar at the bottom — Explore instantly switches to search results across everything. Hit ✕ to return to the graph.</p>
            </div>
          </div>

          <div className="flex gap-3">
            <span className="text-base leading-none">🎛️</span>
            <div>
              <p className="font-medium text-app-ink">Filter the graph</p>
              <p className="mt-0.5 leading-relaxed">Use "All hashtags" in the top-right to focus on specific tags. Great for deep-diving into a topic.</p>
            </div>
          </div>

          <div className="rounded-2xl bg-app-surface-muted px-4 py-3 text-xs text-app-ink-faint leading-relaxed">
            <span className="font-medium text-app-ink-muted">Navigate: </span>
            Drag a tag to move it · Drag the background to pan · Scroll to zoom
          </div>
        </div>
      </div>
    </BaseModal>
  );
}

// ---------------------------------------------------------------------------
// Main overlay
// ---------------------------------------------------------------------------

export function ExploreOverlay() {
  const { state } = useApp();
  const { searchOpen, searchQuery } = state.ui;
  const [infoOpen, setInfoOpen] = useState(false);

  const showSearch = searchOpen && searchQuery.trim().length > 0;
  const showGraph  = searchOpen && searchQuery.trim().length === 0;

  return (
    <>
      {/* Overlay panel */}
      <div
        className={[
          "fixed inset-x-0 top-0 z-app-bottom-nav flex flex-col bg-app-surface",
          "transition-[opacity,transform] duration-app-slow ease-app-in-out",
          searchOpen
            ? "pointer-events-auto translate-y-0 opacity-100"
            : "pointer-events-none translate-y-2 opacity-0",
        ].join(" ")}
        style={{ bottom: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)" }}
      >
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="flex h-[58px] shrink-0 items-center gap-2 border-b border-app-line px-4">
          <h1 className="text-[17px] font-bold text-app-ink">Explore</h1>
          <button
            type="button"
            onClick={() => setInfoOpen(true)}
            className="rounded-full p-1 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
            aria-label="About Explore"
          >
            <Info className="h-4 w-4" />
          </button>
        </div>

        {/* ── Content ──────────────────────────────────────────────────── */}
        <div className="relative min-h-0 flex-1">
          {/* Graph view */}
          <div
            className={[
              "absolute inset-0 transition-[opacity] duration-200",
              showGraph ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          >
            <HashtagGraph />
          </div>

          {/* Search results view */}
          <div
            className={[
              "absolute inset-0 overflow-y-auto px-4 py-4 transition-[opacity] duration-200",
              showSearch ? "opacity-100" : "pointer-events-none opacity-0",
            ].join(" ")}
          >
            <SearchResultsList emptyText="No matches found." />
          </div>
        </div>
      </div>

      {/* Dim backdrop */}
      <div
        className={[
          "fixed inset-0 z-app-top-bar transition-[opacity] duration-app-slow ease-app-in-out",
          searchOpen ? "pointer-events-none opacity-100" : "pointer-events-none opacity-0",
        ].join(" ")}
      >
        <div className="absolute inset-0 bg-app-canvas/20" />
      </div>

      {/* Info modal */}
      {infoOpen && <ExploreInfoModal onClose={() => setInfoOpen(false)} />}
    </>
  );
}
