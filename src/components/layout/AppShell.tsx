import { Suspense, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { ErrorBoundary } from "../ErrorBoundary";
import { BottomNav } from "./BottomNav";
import { ComposerSheet } from "../ComposerSheet";
import { ModeSwitch } from "./ModeSwitch";
import { ToastHost } from "../ToastHost";
import { ReminderMonitor } from "../ReminderMonitor";
import { PushSubscriptionSync } from "../PushSubscriptionSync";
import { NotificationPermissionBanner } from "../NotificationPermissionBanner";
import { FaviconBadgeSync } from "../FaviconBadgeSync";
import { RecurringDeleteModal } from "../RecurringDeleteModal";
import { FounderNoteModal } from "../FounderNoteModal";
import { OfflineStatusBanner } from "../OfflineStatusBanner";
import { CookieNotice } from "../CookieNotice";
import { useMobileKeyboardState } from "./useMobileKeyboardState";
import { useGlobalCaptureShortcut } from "./useGlobalCaptureShortcut";
import { ProfileMenuButton } from "./ProfileMenuButton";
import { useContentZoom } from "../../app/useContentZoom";
import { ZoomIndicator } from "../ZoomIndicator";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { desktopPlatform } from "../../lib/desktop";
import { WindowControls } from "../desktop/WindowControls";

export function AppShell() {
  const location = useLocation();
  const {
    state: {
      ui: { notesDrawerOpen },
    },
  } = useApp();
  const { settings, loading, updateSettings } = useUserSettings();
  const isCanvasRoute = location.pathname === "/canvas";
  const isWorkspaceRoute =
    location.pathname.startsWith("/notes") ||
    location.pathname.startsWith("/bookmarks") ||
    location.pathname === "/todos" ||
    location.pathname.startsWith("/reader") ||
    location.pathname.startsWith("/guide");
  const isExploreRoute = location.pathname.startsWith("/explore");
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isInsightsRoute = location.pathname.startsWith("/insights");
  const isEventRoute = location.pathname.startsWith("/event");
  const usesViewportShell = isWorkspaceRoute || isExploreRoute || isSettingsRoute || isInsightsRoute || isEventRoute;
  const topChromeRef = useRef<HTMLDivElement | null>(null);
  const [topChromeContent, setTopChromeContent] = useState<ReactNode | null>(null);
  // Stable identity so consuming useOutletContext() doesn't re-render every
  // route on every AppShell render — setTopChromeContent itself is already
  // stable, this just stops the wrapping object from being a new reference
  // each time.
  const outletContext = useMemo(() => ({ setTopChrome: setTopChromeContent }), []);
  const [founderNoteOpen, setFounderNoteOpen] = useState(false);
  const founderNoteAutoOpenRef = useRef(false);
  const mobileKeyboard = useMobileKeyboardState();
  useGlobalCaptureShortcut();
  const { zoomPercent, indicatorVisible } = useContentZoom();
  const hideBottomNavForKeyboard = mobileKeyboard.isMobileViewport && mobileKeyboard.keyboardOpen;
  const workspaceHeight =
    mobileKeyboard.isMobileViewport && mobileKeyboard.keyboardOpen && mobileKeyboard.viewportHeight > 0
      ? `calc(${mobileKeyboard.viewportHeight}px)`
      : "calc(100dvh)";

  // Desktop shell: the top bar doubles as the window title bar (drag region).
  // When the Write/Read pill row is absent, the 58px row is the first thing
  // under the native controls, so inset it: left for macOS traffic lights,
  // right for the custom Windows controls. The inset shrinks away once the
  // window is wide enough that the centered 1024px column clears them.
  const desktopShellPlatform = desktopPlatform();
  const titleBarInsetStyle =
    !desktopShellPlatform
      ? undefined
      : desktopShellPlatform === "macos"
        ? { paddingLeft: "max(1rem, calc(88px - max(0px, (100vw - 1056px) / 2)))" }
        : desktopShellPlatform === "windows"
          ? { paddingRight: "max(1rem, calc(148px - max(0px, (100vw - 1056px) / 2)))" }
          : undefined;

  useEffect(() => {
    const updateTopChromeHeight = () => {
      const height = topChromeRef.current?.getBoundingClientRect().height ?? 0;
      // Combined with the mobile-only top bar (Explore/Profile) so every
      // screen that reads --omanote-top-chrome-height gets the full offset
      // without needing to know about the extra bar. calc() re-evaluates
      // live as --omanote-mobile-top-bar-height changes, so this stays
      // correct even if that bar's height updates after this ran.
      document.documentElement.style.setProperty(
        "--omanote-top-chrome-height",
        `calc(${height}px + var(--omanote-mobile-top-bar-height, 0px))`,
      );
    };

    updateTopChromeHeight();
    const observer = new ResizeObserver(updateTopChromeHeight);
    if (topChromeRef.current) {
      observer.observe(topChromeRef.current);
    }
    window.addEventListener("resize", updateTopChromeHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateTopChromeHeight);
    };
  }, []);

  useEffect(() => {
    if (loading) return;
    if (settings.founderNoteSeen) return;
    if (founderNoteOpen || founderNoteAutoOpenRef.current) return;

    founderNoteAutoOpenRef.current = true;
    setFounderNoteOpen(true);
  }, [founderNoteOpen, loading, settings.founderNoteSeen]);

  function openFounderNote() {
    founderNoteAutoOpenRef.current = true;
    setFounderNoteOpen(true);
  }

  function closeFounderNote() {
    setFounderNoteOpen(false);
    if (settings.founderNoteSeen) return;
    void updateSettings({ founderNoteSeen: true }).catch(() => {});
  }

  useEffect(() => {
    if (!isWorkspaceRoute) return;

    const previousHtmlOverflow = document.documentElement.style.overflow;
    const previousBodyOverflow = document.body.style.overflow;
    document.documentElement.style.overflow = "hidden";
    document.body.style.overflow = "hidden";

    return () => {
      document.documentElement.style.overflow = previousHtmlOverflow;
      document.body.style.overflow = previousBodyOverflow;
    };
  }, [isWorkspaceRoute]);

  // The pop-out composer window (see composer-popout.ts) is its own tiny
  // window — no nav, no header, no second ComposerSheet — but still needs
  // to be nested here for the provider stack above AppShell (auth,
  // encryption, user settings) that CanvasDraftBlock depends on.
  if (location.pathname === "/compose-popout") {
    return (
      <Suspense fallback={null}>
        <ErrorBoundary>
          <Outlet context={outletContext} />
        </ErrorBoundary>
      </Suspense>
    );
  }

  return (
    <div className={["flex min-h-screen flex-col bg-app-canvas text-app-ink", isCanvasRoute && settings.canvasDotGrid ? "omanote-canvas-grid" : ""].join(" ")}>
      <div>
        {/* The one header bar for every route — fixed, always visible (no
            more scroll-driven hide/show), with each page injecting its own
            left content via useTopChrome and the profile menu always on
            the right. Width matches whatever <main> uses for that route so
            nothing here floats wider than the page content below it. */}
        <div
          ref={topChromeRef}
          data-tauri-drag-region
          className="fixed inset-x-0 z-40 border-b border-app-line bg-app-surface"
        >
          {desktopShellPlatform === "windows" ? (
            <div className="absolute right-0 top-0 z-10">
              <WindowControls />
            </div>
          ) : null}
          <div
            data-tauri-drag-region
            className="relative mx-auto flex h-[58px] w-full max-w-[1024px] items-center justify-between gap-3 px-4"
            style={titleBarInsetStyle}
          >
            {settings.rssReaderEnabled ? (
              <div className="shrink-0 md:hidden">
                <ModeSwitch variant="compact" />
              </div>
            ) : null}
            <div className="min-w-0 flex-1">{topChromeContent}</div>
            <ProfileMenuButton onOpenAbout={openFounderNote} />
          </div>
        </div>
        <ReminderMonitor />
        <PushSubscriptionSync />
        <FaviconBadgeSync />
        <NotificationPermissionBanner />
        <OfflineStatusBanner />
        <main
          className={[
            "box-border mx-auto flex min-h-0 w-full flex-1 flex-col transform-gpu",
            // Every route shares one 1024px content column (Explore opts out
            // — it manages its own width) — the header bar, bottom nav pill,
            // and composer drawer are all capped to the same value so
            // nothing floats wider than the page content.
            isExploreRoute ? "max-w-none px-0" : "max-w-[1024px] px-4",
            mobileKeyboard.isMobileViewport && mobileKeyboard.keyboardOpen
              ? "transition-none"
              : "transition-opacity duration-[180ms] ease-out",
            usesViewportShell ? "overflow-hidden pb-0" : "overflow-x-hidden pb-28",
          ].join(" ")}
          style={
            isWorkspaceRoute
              ? {
                  height: workspaceHeight,
                  paddingTop: "0px",
                }
              : isEventRoute
                ? {
                    height: "100dvh",
                    paddingTop: "calc(var(--omanote-top-chrome-height, 0px) + 1rem)",
                    paddingBottom: "calc(var(--omanote-bottom-nav-height, 64px) + 1rem)",
                  }
              : isExploreRoute || isSettingsRoute
                ? {
                    height: "100dvh",
                    paddingTop: "var(--omanote-top-chrome-height, 0px)",
                    paddingBottom: "calc(var(--omanote-bottom-nav-height, 64px) + 1.5rem)",
                  }
              : isInsightsRoute
                ? {
                    height: "100dvh",
                    paddingTop: "var(--omanote-top-chrome-height, 0px)",
                    paddingBottom: "env(safe-area-inset-bottom, 0px)",
                  }
              : {
                  paddingTop: "calc(var(--omanote-top-chrome-height, 0px) + 1.5rem)",
                }
          }>
          <Suspense fallback={<div className="min-h-0 flex h-full flex-1 flex-col" aria-hidden="true" />}>
            <ErrorBoundary key={location.pathname}>
              <div
                key={location.pathname}
                className="min-h-0 flex h-full flex-1 flex-col transform-gpu"
                style={{
                  animation: "omanote-page-fade 180ms ease-out both",
                  willChange: "opacity",
                }}
              >
                <Outlet context={outletContext} />
              </div>
            </ErrorBoundary>
          </Suspense>
        </main>
        <ToastHost />
        <RecurringDeleteModal />
      </div>
      <BottomNav hidden={hideBottomNavForKeyboard || notesDrawerOpen} forceHidden={hideBottomNavForKeyboard} />
      <FounderNoteModal open={founderNoteOpen} onClose={closeFounderNote} />
      <ComposerSheet />
      <CookieNotice />
      <ZoomIndicator percent={zoomPercent} visible={indicatorVisible} />
      {settings.rssReaderEnabled ? (
        <div className="pointer-events-none fixed inset-y-0 left-0 z-app-top-bar hidden items-center pl-[max(1rem,env(safe-area-inset-left))] md:flex">
          <div className="pointer-events-auto">
            <ModeSwitch />
          </div>
        </div>
      ) : null}
    </div>
  );
}
