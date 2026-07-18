import { Suspense, useEffect, useRef, useState, type ReactNode } from "react";
import { Outlet, useLocation } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { ErrorBoundary } from "../ErrorBoundary";
import { BottomNav } from "./BottomNav";
import { ModeSwitch } from "./ModeSwitch";
import { ToastHost } from "../ToastHost";
import { ReminderMonitor } from "../ReminderMonitor";
import { PushSubscriptionSync } from "../PushSubscriptionSync";
import { NotificationPermissionBanner } from "../NotificationPermissionBanner";
import { FaviconBadgeSync } from "../FaviconBadgeSync";
import { UpdateNotificationBanner } from "../UpdateNotificationBanner";
import { UpdateModal } from "../UpdateModal";
import { RecurringDeleteModal } from "../RecurringDeleteModal";
import { FounderNoteModal } from "../FounderNoteModal";
import { OfflineStatusBanner } from "../OfflineStatusBanner";
import { CookieNotice } from "../CookieNotice";
import { useMobileKeyboardState } from "./useMobileKeyboardState";
import { useUserSettings } from "../../contexts/UserSettingsContext";
import { isTauri, desktopPlatform } from "../../lib/desktop";
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
  const usesViewportShell = isWorkspaceRoute || isExploreRoute || isSettingsRoute || isInsightsRoute;
  const topChromeRef = useRef<HTMLDivElement | null>(null);
  const bottomHideTimeoutRef = useRef<number | null>(null);
  const bottomHideSuppressTimeoutRef = useRef<number | null>(null);
  const lastScrollYRef = useRef(0);
  const [topChromeHidden, setTopChromeHidden] = useState(false);
  const [bottomChromeHidden, setBottomChromeHidden] = useState(false);
  const [topChromeContent, setTopChromeContent] = useState<ReactNode | null>(null);
  const [founderNoteOpen, setFounderNoteOpen] = useState(false);
  const founderNoteAutoOpenRef = useRef(false);
  const bottomHideSuppressedRef = useRef(false);
  const mobileKeyboard = useMobileKeyboardState();
  const hideBottomNavForKeyboard = mobileKeyboard.isMobileViewport && mobileKeyboard.keyboardOpen;
  const workspaceHeight =
    mobileKeyboard.isMobileViewport && mobileKeyboard.keyboardOpen && mobileKeyboard.viewportHeight > 0
      ? `calc(${mobileKeyboard.viewportHeight}px)`
      : "calc(100dvh)";

  // Desktop shell: the top bar doubles as the window title bar (drag region).
  // When the Write/Read pill row is absent, the 58px row is the first thing
  // under the native controls, so inset it: left for macOS traffic lights,
  // right for the custom Windows controls. The inset shrinks away once the
  // window is wide enough that the centered 1152px column clears them.
  const desktopShellPlatform = desktopPlatform();
  const titleBarInsetStyle =
    settings.rssReaderEnabled || !desktopShellPlatform
      ? undefined
      : desktopShellPlatform === "macos"
        ? { paddingLeft: "max(1rem, calc(88px - max(0px, (100vw - 1184px) / 2)))" }
        : desktopShellPlatform === "windows"
          ? { paddingRight: "max(1rem, calc(148px - max(0px, (100vw - 1184px) / 2)))" }
          : undefined;

  useEffect(() => {
    const updateTopChromeHeight = () => {
      const height = topChromeRef.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty("--omanote-top-chrome-height", `${height}px`);
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
    const triggerBottomChromeHide = () => {
      if (!bottomHideSuppressedRef.current) {
        setBottomChromeHidden(true);
      }
      if (bottomHideTimeoutRef.current !== null) {
        window.clearTimeout(bottomHideTimeoutRef.current);
      }
      bottomHideTimeoutRef.current = window.setTimeout(() => {
        setBottomChromeHidden(false);
        bottomHideTimeoutRef.current = null;
      }, 180);
    };

    if (isWorkspaceRoute) {
      setTopChromeHidden(false);
      const handleNotesScroll = () => {
        triggerBottomChromeHide();
      };

      window.addEventListener("omanote:notes-scroll", handleNotesScroll);
      return () => {
        window.removeEventListener("omanote:notes-scroll", handleNotesScroll);
        if (bottomHideTimeoutRef.current !== null) {
          window.clearTimeout(bottomHideTimeoutRef.current);
        }
        if (bottomHideSuppressTimeoutRef.current !== null) {
          window.clearTimeout(bottomHideSuppressTimeoutRef.current);
        }
      };
    }

    const handleScroll = () => {
      const currentScrollY = window.scrollY;
      const isScrollingUp = currentScrollY < lastScrollYRef.current;
      const isScrollingDown = currentScrollY > lastScrollYRef.current;

      if (isScrollingDown) {
        // In the desktop app the top bar stays fixed instead of hiding.
        if (!isTauri()) {
          setTopChromeHidden(true);
        }
      } else if (isScrollingUp) {
        setTopChromeHidden(false);
      }

      triggerBottomChromeHide();
      lastScrollYRef.current = currentScrollY;
    };

    lastScrollYRef.current = window.scrollY;
    window.addEventListener("scroll", handleScroll, { passive: true });

    return () => {
      window.removeEventListener("scroll", handleScroll);
      if (bottomHideTimeoutRef.current !== null) {
        window.clearTimeout(bottomHideTimeoutRef.current);
      }
      if (bottomHideSuppressTimeoutRef.current !== null) {
        window.clearTimeout(bottomHideSuppressTimeoutRef.current);
      }
    };
  }, [isWorkspaceRoute]);

  useEffect(() => {
    bottomHideSuppressedRef.current = true;
    setBottomChromeHidden(false);

    if (bottomHideSuppressTimeoutRef.current !== null) {
      window.clearTimeout(bottomHideSuppressTimeoutRef.current);
    }

    bottomHideSuppressTimeoutRef.current = window.setTimeout(() => {
      bottomHideSuppressedRef.current = false;
      bottomHideSuppressTimeoutRef.current = null;
    }, 250);
  }, [location.pathname]);

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

  return (
    <div className={["flex min-h-screen flex-col bg-app-canvas text-app-ink", isCanvasRoute && settings.canvasDotGrid ? "omanote-canvas-grid" : ""].join(" ")}>
      <div>
        <div
          ref={topChromeRef}
          data-tauri-drag-region
          className={[
            "fixed inset-x-0 top-0 z-40 border-b border-app-line bg-app-surface transform-gpu transition-[transform,opacity] duration-app-base ease-app-in-out will-change-transform",
            topChromeHidden ? "-translate-y-2 opacity-0 pointer-events-none" : "translate-y-0 opacity-100",
          ].join(" ")}
        >
          {desktopShellPlatform === "windows" ? (
            <div className="absolute right-0 top-0 z-10">
              <WindowControls />
            </div>
          ) : null}
          {settings.rssReaderEnabled ? (
            <div data-tauri-drag-region className="mx-auto flex w-full max-w-[1152px] justify-center px-4 pt-2">
              <ModeSwitch />
            </div>
          ) : null}
          <div
            data-tauri-drag-region
            className="mx-auto flex h-[58px] w-full max-w-[1152px] items-center px-4"
            style={titleBarInsetStyle}
          >
            {topChromeContent}
          </div>
        </div>
        <ReminderMonitor />
        <PushSubscriptionSync />
        <FaviconBadgeSync />
        <NotificationPermissionBanner />
        <UpdateNotificationBanner />
        <UpdateModal />
        <OfflineStatusBanner />
        <main
          className={[
            "box-border mx-auto flex min-h-0 w-full flex-1 flex-col transform-gpu",
            isExploreRoute ? "max-w-none px-0" : "max-w-[1152px] px-4",
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
                <Outlet context={{ setTopChrome: setTopChromeContent }} />
              </div>
            </ErrorBoundary>
          </Suspense>
        </main>
        <ToastHost />
        <RecurringDeleteModal />
      </div>
      <BottomNav
        hidden={bottomChromeHidden || hideBottomNavForKeyboard || notesDrawerOpen}
        forceHidden={hideBottomNavForKeyboard}
        onOpenAbout={openFounderNote}
      />
      <FounderNoteModal open={founderNoteOpen} onClose={closeFounderNote} />
      <CookieNotice />
    </div>
  );
}
