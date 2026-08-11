import { Sparkles } from "lucide-react";
import { Button } from "./ui";
import { useUpdate } from "../contexts/UpdateContext";

export function UpdateNotificationBanner() {
  const { isBannerVisible, latestVersion, extraUpdatesCount, dismissBanner, isModalOpen, isTransitioningToModal } =
    useUpdate();

  if (!isBannerVisible || !latestVersion) return null;

  const isBannerTransitioning = isModalOpen && isTransitioningToModal;

  return (
    <div
      className={[
        "fixed bottom-[88px] left-1/2 z-40 w-[min(92vw,352px)] -translate-x-1/2 transform-gpu transition-opacity duration-150 ease-out",
        isBannerTransitioning ? "opacity-0 pointer-events-none" : "opacity-100",
      ].join(" ")}
    >
      <div
        role="dialog"
        aria-label="omanote update available"
        className="w-full rounded-app-card border border-app-line bg-app-surface p-4 shadow-app-dialog"
      >
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
          <Button tone="default" className="flex-1 py-2 text-[13px]" onClick={() => window.location.reload()}>
            Refresh to update
          </Button>
          <Button tone="ghost" className="flex-1 py-2 text-[13px]" onClick={dismissBanner}>
            Dismiss
          </Button>
        </div>
      </div>
    </div>
  );
}
