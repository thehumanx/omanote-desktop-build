import { useEffect, useMemo, useState, type TouchEvent as ReactTouchEvent, type WheelEvent as ReactWheelEvent } from "react";
import { ExternalLink, RefreshCw, Sparkles, FileText, X } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Button, SegmentedPill } from "./ui";
import { CHANGELOG_TABS, type ChangelogProduct } from "./ChangelogProductTabs";
import { BaseModal } from "./BaseModal";
import { useUpdate } from "../contexts/UpdateContext";
import { parseVersions, type VersionInfo } from "../lib/update-checker";
import { getExtensionStoreUrl } from "../lib/device-info";
const MODAL_SCROLL_AREA_SELECTOR = "[data-omanote-update-modal-scroll]";
const UPDATE_MODAL_TAB_ITEMS = CHANGELOG_TABS.map((tab) => ({ key: tab.id, label: tab.label }));

function isInsideModalScrollArea(target: EventTarget | null) {
  return target instanceof Element && Boolean(target.closest(MODAL_SCROLL_AREA_SELECTOR));
}

export function UpdateModal() {
  const { isModalOpen, closeModal, latestVersion, modalVersions, isTransitioningToModal, changelogMarkdown } = useUpdate();
  const navigate = useNavigate();
  const [isEntered, setIsEntered] = useState(false);
  const [activeTab, setActiveTab] = useState<ChangelogProduct>("webapp");
  const extensionVersions = useMemo<VersionInfo[]>(() => parseVersions(changelogMarkdown, "Extension Versions"), []);
  const desktopVersions = useMemo<VersionInfo[]>(() => parseVersions(changelogMarkdown, "Desktop Versions"), []);
  const latestExtensionVersions = useMemo(() => extensionVersions.slice(0, 1), [extensionVersions]);
  const latestDesktopVersions = useMemo(() => desktopVersions.slice(0, 1), [desktopVersions]);
  const displayedVersions = activeTab === "extension" ? latestExtensionVersions : activeTab === "desktop" ? latestDesktopVersions : modalVersions;
  const shouldRenderModal = isModalOpen && Boolean(latestVersion) && modalVersions.length > 0;
  const prefersReducedMotion =
    typeof window !== "undefined" && typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  useEffect(() => {
    if (isModalOpen) setActiveTab("webapp");
  }, [isModalOpen]);

  useEffect(() => {
    if (!shouldRenderModal) {
      setIsEntered(false);
      return;
    }

    const prevBodyOverflow = document.body.style.overflow;
    const prevHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";

    if (prefersReducedMotion) {
      setIsEntered(true);
      return () => {
        document.body.style.overflow = prevBodyOverflow;
        document.documentElement.style.overflow = prevHtmlOverflow;
      };
    }

    const frame = window.requestAnimationFrame(() => {
      setIsEntered(true);
    });

    return () => {
      window.cancelAnimationFrame(frame);
      document.body.style.overflow = prevBodyOverflow;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [prefersReducedMotion, shouldRenderModal]);

  if (!shouldRenderModal) return null;

  const newestVisibleUpdate = displayedVersions[0];
  const moreUpdatesCount = Math.max(displayedVersions.length - 1, 0);
  const isExtensionTab = activeTab === "extension";

  const handlePrimaryAction = () => {
    if (isExtensionTab) {
      window.open(getExtensionStoreUrl(), "_blank", "noopener,noreferrer");
      return;
    }

    window.location.reload();
  };

  const stopBackgroundGesture = (event: ReactTouchEvent<HTMLDivElement> | ReactWheelEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (!isInsideModalScrollArea(event.target)) {
      event.preventDefault();
    }
  };

  const stopBackgroundTouch = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
  };

  return (
    <BaseModal
      onClose={closeModal}
      zIndex="z-app-modal"
      className={[
        "touch-none transition-[background-color,opacity] duration-app-slow ease-app-in-out",
        isEntered ? "bg-black/30 opacity-100" : "bg-black/0 opacity-0",
      ].join(" ")}
      backdropProps={{
        onClick: closeModal,
        onTouchStart: stopBackgroundTouch,
        onTouchMove: stopBackgroundGesture,
        onTouchEnd: stopBackgroundTouch,
        onWheel: stopBackgroundGesture,
      }}
    >
        <div
          className={[
            "w-full max-w-md transform-gpu rounded-2xl border border-app-line bg-app-surface shadow-app-dialog transition-[transform,opacity,box-shadow,border-color] duration-app-slow ease-app-in-out",
            isEntered ? "translate-y-0 scale-100 opacity-100" : "translate-y-4 scale-[0.96] opacity-0",
            isTransitioningToModal ? "will-change-transform" : "",
          ].join(" ")}
          onClick={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onTouchMove={(e) => e.stopPropagation()}
          onTouchEnd={(e) => e.stopPropagation()}
          onWheel={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="relative flex items-start p-5 pb-4">
            <div className="flex items-start gap-3">
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-app-surface-muted dark:bg-app-line text-app-ink">
                <Sparkles className="h-[18px] w-[18px]" />
              </div>
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-app-ink-faint">
                  Latest updates
                </p>
                <h2 className="text-base font-bold leading-tight text-app-ink">{newestVisibleUpdate?.version ?? "Extension"}</h2>
                {newestVisibleUpdate?.date && <p className="text-xs text-app-ink-faint">{newestVisibleUpdate.date}</p>}
                {moreUpdatesCount > 0 && (
                  <p className="mt-1 text-[11px] font-bold text-app-ink-faint">
                    + {moreUpdatesCount} more update{moreUpdatesCount === 1 ? "" : "s"}
                  </p>
                )}
              </div>
            </div>
            <button
              type="button"
              className="absolute right-4 top-4 rounded-lg p-1.5 text-app-ink-faint transition hover:bg-app-surface-hover hover:text-app-ink-muted"
              onClick={closeModal}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Changelog items */}
          <div className="px-5 pb-3">
            <SegmentedPill
              activeKey={activeTab}
              ariaLabel="Update changelog product"
              items={UPDATE_MODAL_TAB_ITEMS}
              onChange={(key) => setActiveTab(key as ChangelogProduct)}
            />
          </div>
          <div data-omanote-update-modal-scroll className="h-[40vh] sm:h-[50vh] space-y-3 overflow-y-auto px-5 pb-4">
            {displayedVersions.map((versionInfo) => (
              <article key={`${versionInfo.version}-${versionInfo.date}`} className="rounded-xl border border-app-line bg-app-surface-muted/60 px-4 py-3">
                <div className="flex items-start justify-between gap-3">
                  <h3 className="text-sm font-bold text-app-ink">{versionInfo.version}</h3>
                  <p className="text-[11px] text-app-ink-faint">{versionInfo.date}</p>
                </div>
                {versionInfo.summary && (
                  <p className="mt-2 text-sm leading-relaxed text-app-ink-muted">{versionInfo.summary}</p>
                )}
                {versionInfo.items.length > 0 && (
                  <ul className="mt-2.5 space-y-2">
                    {versionInfo.items.map((item, i) => (
                      <li key={`${versionInfo.version}-item-${i}`} className="flex items-start gap-2.5 text-sm text-app-ink-muted">
                        <span className="mt-[7px] h-1.5 w-1.5 flex-shrink-0 rounded-full bg-app-line-strong" />
                        <span>{item}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </article>
            ))}
          </div>

          {/* Footer actions */}
          <div className="border-t border-app-line p-5">
            <p className="mb-3 text-xs text-app-ink-faint">
              {isExtensionTab
                ? "Open the store listing to make sure your browser has the latest extension."
                : "Hard refresh the page to make sure you're running the latest version."}
            </p>
            <div className="flex items-center gap-2">
              <Button
                tone="default"
                className="flex flex-1 items-center justify-center gap-2 py-2 text-sm"
                onClick={handlePrimaryAction}
              >
                {isExtensionTab ? <ExternalLink className="h-3.5 w-3.5" /> : <RefreshCw className="h-3.5 w-3.5" />}
                {isExtensionTab ? "Update your extension" : "Refresh to update"}
              </Button>
              <Button
                tone="ghost"
                className="flex flex-1 items-center justify-center gap-2 py-2 text-sm"
                onClick={() => {
                  closeModal();
                  navigate("/updates");
                }}
              >
                <FileText className="h-3.5 w-3.5" />
                View all changelogs
              </Button>
            </div>
          </div>
        </div>
    </BaseModal>
  );
}
