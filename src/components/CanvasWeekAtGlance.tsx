import { ArrowRight } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useWeekAtGlance, type WeekAtGlance } from "../app/insights-local";

/**
 * The presentation half, split out so the landing page's canvas preview can
 * render the real card from fixed numbers. `useWeekAtGlance` reads Dexie,
 * which is empty (or worse, stale from a previous session) for a signed-out
 * visitor, so the preview supplies `glance` directly instead.
 */
export function CanvasWeekAtGlanceView({
  glance,
  onOpen,
}: {
  glance: WeekAtGlance | undefined;
  onOpen: () => void;
}) {
  return (
    <button
      type="button"
      aria-label="View insights"
      onClick={onOpen}
      className="group flex items-start justify-between gap-3 rounded-app-card border border-app-line bg-app-surface px-4 py-3 text-left transition-colors duration-150 hover:bg-app-surface-hover active:scale-[0.99]"
    >
      <div className="flex min-w-0 flex-col gap-1.5">
        <span className="text-sm text-app-ink-faint">Your week at glance</span>
        {glance === undefined ? (
          <div className="h-4 w-64 animate-pulse rounded-full bg-app-line" />
        ) : (
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm text-app-ink-muted">
            <span>🔥 {glance.streakDays} {glance.streakDays === 1 ? "day" : "days"}</span>
            <span className="text-app-line-strong">·</span>
            {glance.todosCount + glance.notesCount + glance.bookmarksCount + glance.eventsCount === 0 ? (
              <span>Save your first thought, todo, or link</span>
            ) : (
              <>
                <span>✅ {glance.todosCount} {glance.todosCount === 1 ? "todo" : "todos"}</span>
                <span className="text-app-line-strong">·</span>
                <span>📝 {glance.notesCount} {glance.notesCount === 1 ? "note" : "notes"}</span>
                <span className="text-app-line-strong">·</span>
                <span>🔖 {glance.bookmarksCount} {glance.bookmarksCount === 1 ? "bookmark" : "bookmarks"}</span>
                <span className="text-app-line-strong">·</span>
                <span>📅 {glance.eventsCount} {glance.eventsCount === 1 ? "event" : "events"}</span>
              </>
            )}
          </div>
        )}
      </div>
      <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-app-ink-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
    </button>
  );
}

export function CanvasWeekAtGlance() {
  const glance = useWeekAtGlance();
  const navigate = useNavigate();

  return <CanvasWeekAtGlanceView glance={glance} onOpen={() => navigate("/insights")} />;
}
