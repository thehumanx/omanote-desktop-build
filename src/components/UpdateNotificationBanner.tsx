import { ArrowRight, Sparkles } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, cn } from "./ui";
import { useUpdate } from "../contexts/UpdateContext";

export function UpdateNotificationBanner({ inline = false }: { inline?: boolean } = {}) {
  const {
    isBannerVisible,
    latestVersion,
    extraUpdatesCount,
    dismissBanner,
    isModalOpen,
    isTransitioningToModal,
    isRunningLatest,
    openModal,
  } = useUpdate();
  const navigate = useNavigate();

  if (!isBannerVisible || !latestVersion) return null;

  if (inline) {
    return (
      <button
        type="button"
        aria-label="omanote update available"
        onClick={openModal}
        className="group flex w-full items-start justify-between gap-3 px-4 py-3 text-left transition-colors duration-150 hover:bg-app-surface-hover"
      >
        <div className="flex min-w-0 flex-col gap-1.5">
          <span className="flex items-center gap-1.5 text-sm text-app-ink-faint">
            <span aria-hidden="true" className="h-1.5 w-1.5 shrink-0 rounded-full bg-success-solid" />
            Update available · {latestVersion.version}
            {extraUpdatesCount > 0 ? ` (+${extraUpdatesCount} more)` : ""}
          </span>
          <span className="text-sm text-app-ink-muted">
            {latestVersion.summary || "A new version of omanote is ready — take a look at what's new."}
          </span>
        </div>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-app-ink-faint opacity-0 transition-opacity duration-150 group-hover:opacity-100" />
      </button>
    );
  }

  const isBannerTransitioning = isModalOpen && isTransitioningToModal;

  return (
    <div
      className={cn(
        "fixed bottom-[88px] left-1/2 z-40 w-[min(92vw,352px)] -translate-x-1/2 transform-gpu",
        "transition-opacity duration-150 ease-out",
        isBannerTransitioning ? "opacity-0 pointer-events-none" : "opacity-100",
      )}
    >
      <div role="dialog" aria-label="omanote update available" className="w-full rounded-app-card border border-app-line bg-app-surface p-4 shadow-app-dialog">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-surface-muted dark:bg-app-line text-app-ink">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">
              Update available
            </p>
            <p className="mt-1.5 text-sm font-bold leading-snug text-app-ink">
              New update · {latestVersion.version}
            </p>
            {extraUpdatesCount > 0 && (
              <p className="mt-0.5 text-xs font-bold text-app-ink-faint">
                + {extraUpdatesCount} more update{extraUpdatesCount === 1 ? "" : "s"}
              </p>
            )}
            {latestVersion.summary && (
              <p className="mt-1 line-clamp-2 text-[13px] leading-relaxed text-app-ink-muted">
                {latestVersion.summary}
              </p>
            )}
          </div>
        </div>
        <div className="mt-3.5 flex gap-2">
          <Button
            tone="default"
            className="flex-1 py-2 text-[13px]"
            onClick={isRunningLatest ? () => navigate("/updates") : () => window.location.reload()}
          >
            {isRunningLatest ? "View all changelogs" : "Refresh to update"}
          </Button>
          <Button tone="ghost" className="flex-1 py-2 text-[13px]" onClick={dismissBanner}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
