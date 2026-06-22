import { Sparkles, X } from "lucide-react";
import { Button } from "./ui";
import { useUpdate } from "../contexts/UpdateContext";

export function UpdateNotificationBanner() {
  const { isBannerVisible, latestVersion, extraUpdatesCount, openModal, dismissBanner, isModalOpen, isTransitioningToModal } =
    useUpdate();

  if (!isBannerVisible || !latestVersion) return null;

  const isBannerTransitioning = isModalOpen && isTransitioningToModal;

  return (
    <div
      className={[
        "fixed bottom-[88px] left-1/2 z-40 w-[min(92vw,440px)] -translate-x-1/2 transform-gpu transition-opacity duration-150 ease-out",
        isBannerTransitioning ? "opacity-0 pointer-events-none" : "opacity-100",
      ].join(" ")}
    >
      <div
        role="button"
        tabIndex={0}
        className="w-full cursor-pointer text-left"
        onClick={openModal}
        onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") openModal(); }}
      >
        <div
          className="relative flex items-start gap-3 rounded-2xl border border-app-line bg-app-surface px-4 py-3 pr-14 shadow-app-bubble transition-[border-color,box-shadow] duration-200 hover:border-app-line-strong hover:shadow-app-bubble-hover"
        >
          <div className="flex-shrink-0">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-app-surface-muted dark:bg-app-line text-app-ink">
              <Sparkles className="h-4 w-4" />
            </div>
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-app-ink">
              New update · <span className="font-bold">{latestVersion.version}</span>
            </p>
            {extraUpdatesCount > 0 && (
              <p className="mt-0.5 text-xs font-bold text-app-ink-faint">
                + {extraUpdatesCount} more update{extraUpdatesCount === 1 ? "" : "s"}
              </p>
            )}
            {latestVersion.summary && (
              <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-app-ink-faint">
                {latestVersion.summary}
              </p>
            )}
          </div>
          <Button
            tone="ghost"
            className="absolute right-3 top-3 p-1.5 text-app-ink-faint hover:text-app-ink-muted"
            onClick={(e) => {
              e.stopPropagation();
              dismissBanner();
            }}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
