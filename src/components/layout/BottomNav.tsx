import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from "react";
import { Bookmark, BookmarkCheck, BookOpen, Check, CheckSquare, Compass, Download, FileText, GripHorizontal, Info, LogOut, CalendarDays, MessageSquare, Monitor, Moon, Rss, Settings, Puzzle, Sparkles, SquarePen, Sun, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { useAuth } from "../../app/auth/AuthContext";
import { storageKeys } from "../../app/storage";
import { Button, cn, Input, MenuItem, SegmentedHighlight, SegmentedItem, SegmentedItemLabel, SegmentedShell, segmentedItemClass } from "../ui";
import { useUpdate } from "../../contexts/UpdateContext";
import { maskEmail } from "../../lib/update-checker";
import { useDrawerDrag } from "../../lib/useDrawerDrag";
import { useMeasuredHighlight } from "../../hooks/useMeasuredHighlight";
import { useOutsideClick } from "../../lib/useOutsideClick";
import { getNavRouteIndex, getWrappedNavRoutePath } from "./navRoutes";
import { isMobileViewport } from "../../lib/mobile";
import { getExtensionStoreUrl } from "../../lib/device-info";
import { isTauri } from "../../lib/desktop";
import { FeedbackModal } from "../FeedbackModal";
import { ModalPortal } from "../ModalPortal";
import { useTheme } from "../../contexts/ThemeContext";
import { useUserSettings } from "../../contexts/UserSettingsContext";

const writeTabs = [
  { to: "/canvas", label: "Canvas", icon: SquarePen },
  { to: "/todos", label: "Todos", icon: CheckSquare },
  { to: "/notes", label: "Notes", icon: FileText },
  { to: "/bookmarks", label: "Bookmarks", icon: Bookmark },
  { to: "/event", label: "Events", icon: CalendarDays },
];

// Tabs shown while in read mode (the /reader side of the app).
const readerTabs = [
  { to: "/reader", label: "Feeds", icon: Rss },
  { to: "/reader/saved", label: "Saved", icon: BookmarkCheck },
];

const defaultAvatarSrc =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(`
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40" fill="none">
      <rect width="40" height="40" rx="20" fill="rgb(var(--color-line))"/>
      <circle cx="20" cy="15" r="6" fill="rgb(var(--color-ink-faint))"/>
      <path d="M8 32c2.8-5.2 7-7.8 12-7.8S29.2 26.8 32 32" fill="rgb(var(--color-ink-faint))"/>
    </svg>
  `);
const accountProfileUrl = "https://accounts.omanote.com/user";
const desktopAppReleaseUrl = "https://github.com/thehumanx/omanote-releases/releases/latest";

export function BottomNav({ hidden = false, forceHidden = false, onOpenAbout = () => {} }: { hidden?: boolean; forceHidden?: boolean; onOpenAbout?: () => void }) {
  const location = useLocation();
  const isUpdatesRoute = location.pathname.startsWith("/updates");
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isInsightsRoute = location.pathname.startsWith("/insights");
  const isGuideRoute = location.pathname.startsWith("/guide");

  if (isUpdatesRoute || isSettingsRoute || isInsightsRoute || isGuideRoute) {
    const label = isSettingsRoute
      ? "Close settings"
      : isInsightsRoute
        ? "Close insights"
        : isGuideRoute
          ? "Close guide"
          : "Close updates";
    return <SimpleRouteCloseNav forceHidden={forceHidden} hidden={hidden} label={label} />;
  }

  return <FullBottomNav hidden={hidden} forceHidden={forceHidden} onOpenAbout={onOpenAbout} />;
}

function SimpleRouteCloseNav({ hidden, forceHidden, label }: { hidden: boolean; forceHidden: boolean; label: string }) {
  const navRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const shouldHide = forceHidden || hidden;

  useEffect(() => {
    if (!navRef.current) return;

    const updateHeight = () => {
      const height = navRef.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty("--omanote-bottom-nav-height", `${height}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(navRef.current);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  const handleClose = () => {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/canvas");
  };

  return (
    <nav
      ref={navRef}
      className={[
        "fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),1200px)] -translate-x-1/2 transform-gpu pointer-events-none",
        forceHidden ? "transition-none" : "transition-transform duration-app-slow ease-app-in-out",
        shouldHide ? "translate-y-[calc(100%+0.5rem)]" : "translate-y-0",
      ].join(" ")}
    >
      <div className="relative h-12">
        <div className="flex h-full items-center justify-end">
          <button
            className="pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border border-app-line bg-app-surface p-0 text-app-ink-muted shadow-soft transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
            onClick={handleClose}
            aria-label={label}
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </nav>
  );
}

const THEME_OPTIONS = [
  { mode: "system" as const, label: "System", ariaLabel: "Use system theme", Icon: Monitor },
  { mode: "light" as const, label: "Light", ariaLabel: "Use light theme", Icon: Sun },
  { mode: "dark" as const, label: "Dark", ariaLabel: "Use dark theme", Icon: Moon },
];

function ThemeToggle({ themeMode, setThemeMode }: { themeMode: "system" | "light" | "dark"; setThemeMode: (mode: "system" | "light" | "dark") => void }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<Record<string, HTMLButtonElement | null>>({ system: null, light: null, dark: null });
  const highlightStyle = useMeasuredHighlight({ activeKey: themeMode, containerRef, itemRefs });

  return (
    <SegmentedShell
      ref={containerRef}
      className="w-full p-1.5"
    >
      {highlightStyle && (
        <SegmentedHighlight style={highlightStyle} />
      )}
      {THEME_OPTIONS.map(({ mode, label, ariaLabel, Icon }) => (
        <SegmentedItem
          key={mode}
          ref={(node) => { itemRefs.current[mode] = node; }}
          aria-label={ariaLabel}
          active={themeMode === mode}
          onClick={() => setThemeMode(mode)}
          className="relative z-10 flex flex-1 items-center justify-center gap-1.5 px-2 py-2 text-xs font-medium text-app-ink-faint transition-colors duration-150 md:py-1.5"
        >
          <Icon className="h-3.5 w-3.5 flex-shrink-0" />
          {label}
        </SegmentedItem>
      ))}
    </SegmentedShell>
  );
}

function FullBottomNav({ hidden = false, forceHidden = false, onOpenAbout }: { hidden?: boolean; forceHidden?: boolean; onOpenAbout: () => void }) {
  const navRef = useRef<HTMLElement | null>(null);
  const pillRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const searchInputRef = useRef<HTMLInputElement | null>(null);
  const profileMenuRef = useRef<HTMLDivElement | null>(null);
  const pageSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const pageSwipeAxisRef = useRef<"horizontal" | "vertical" | null>(null);
  const pageSwipeBlockUntilRef = useRef(0);
  const currentNavRouteIndexRef = useRef(-1);
  const location = useLocation();
  const navigate = useNavigate();
  const { state, dispatch } = useApp();
  const { user, signOut } = useAuth();
  const { hasUpdate, openModal } = useUpdate();
  const { themeMode, setThemeMode } = useTheme();
  const { settings } = useUserSettings();
  const runningInDesktopApp = isTauri();
  const navLabelStyle = settings.navLabelStyle;
  const [menuOpen, setMenuOpen] = useState(false);
  const [profileDrawerOpen, setProfileDrawerOpen] = useState(false);
  const [feedbackModalOpen, setFeedbackModalOpen] = useState(false);
  const [keyboardOpen, setKeyboardOpen] = useState(false);

  useEffect(() => {
    const vv = window.visualViewport;
    if (!vv) return;
    const handler = () => {
      setKeyboardOpen(vv.height / window.innerHeight < 0.75);
    };
    vv.addEventListener("resize", handler);
    return () => vv.removeEventListener("resize", handler);
  }, []);

  const isReaderRoute = location.pathname === "/reader" || location.pathname.startsWith("/reader/");
  const tabs = isReaderRoute ? readerTabs : writeTabs;
  const activeTabIndex = useMemo(() => getNavRouteIndex(location.pathname), [location.pathname]);
  const activeTab = useMemo(() => {
    if (isReaderRoute) {
      return location.pathname.startsWith("/reader/saved") ? "/reader/saved" : "/reader";
    }
    return writeTabs[activeTabIndex]?.to ?? null;
  }, [activeTabIndex, isReaderRoute, location.pathname]);
  const highlightStyle = useMeasuredHighlight({
    activeKey: activeTab,
    containerRef: pillRef,
    itemRefs: tabRefs,
    layoutKey: `${navLabelStyle}:${isReaderRoute ? "read" : "write"}`,
    observeResize: false,
  });

  const isExploreRoute = location.pathname.startsWith("/explore");
  const searchQuery = state.ui.searchQuery;
  const shouldHide = isExploreRoute ? forceHidden : forceHidden || hidden;

  currentNavRouteIndexRef.current = activeTabIndex;

  useOutsideClick(profileMenuRef, menuOpen, () => setMenuOpen(false));

  const openExplore = () => {
    navigate("/explore");
    setMenuOpen(false);
    setProfileDrawerOpen(false);
  };

  const closeExplore = () => {
    dispatch({ type: "ui/set-search-query", query: "" });
    setMenuOpen(false);
    setProfileDrawerOpen(false);
    if (window.history.length > 1) {
      navigate(-1);
    } else {
      navigate("/canvas");
    }
  };

  // Publish nav height as a CSS variable
  useEffect(() => {
    if (!navRef.current) return;

    const updateHeight = () => {
      const height = navRef.current?.getBoundingClientRect().height ?? 0;
      document.documentElement.style.setProperty("--omanote-bottom-nav-height", `${height}px`);
    };

    updateHeight();
    const observer = new ResizeObserver(updateHeight);
    observer.observe(navRef.current);
    window.addEventListener("resize", updateHeight);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", updateHeight);
    };
  }, []);

  // Focus search input when explore mode opens
  useEffect(() => {
    if (!isExploreRoute) return;

    setMenuOpen(false);
    if (isMobileViewport()) return;

    const focusTimer = window.setTimeout(() => searchInputRef.current?.focus(), 320);
    return () => {
      window.clearTimeout(focusTimer);
    };
  }, [isExploreRoute]);

  useEffect(() => {
    if (!forceHidden) return;
    setMenuOpen(false);
    setProfileDrawerOpen(false);
  }, [forceHidden]);

  useEffect(() => {
    setMenuOpen(false);
    setProfileDrawerOpen(false);
  }, [location.pathname]);

  const handlePageSwipeTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (isExploreRoute || currentNavRouteIndexRef.current === -1) return;
    if (event.touches.length !== 1) return;
    const touch = event.touches[0];
    if (!touch) return;
    pageSwipeStartRef.current = { x: touch.clientX, y: touch.clientY };
    pageSwipeAxisRef.current = null;
  };

  const handlePageSwipeTouchMove = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = pageSwipeStartRef.current;
    if (!start) return;
    event.stopPropagation();
    if (event.touches.length !== 1) return;

    if (pageSwipeAxisRef.current === "horizontal") {
      event.preventDefault();
      return;
    }
    if (pageSwipeAxisRef.current === "vertical") return;

    const touch = event.touches[0];
    if (!touch) return;

    const dx = touch.clientX - start.x;
    const dy = touch.clientY - start.y;
    if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return;

    pageSwipeAxisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    if (pageSwipeAxisRef.current === "horizontal") {
      event.preventDefault();
    }
  };

  const finishPageSwipe = () => {
    pageSwipeStartRef.current = null;
    pageSwipeAxisRef.current = null;
  };

  const handlePageSwipeTouchEnd = (event: ReactTouchEvent<HTMLDivElement>) => {
    const start = pageSwipeStartRef.current;
    if (!start) return;
    event.stopPropagation();

    const touch = event.changedTouches[0];
    finishPageSwipe();
    if (!touch) return;

    const deltaX = touch.clientX - start.x;
    const deltaY = touch.clientY - start.y;
    if (Math.abs(deltaX) < 56 || Math.abs(deltaX) <= Math.abs(deltaY)) return;

    const currentIndex = currentNavRouteIndexRef.current;
    if (currentIndex < 0) return;

    pageSwipeBlockUntilRef.current = Date.now() + 400;
    navigate(getWrappedNavRoutePath(currentIndex + (deltaX < 0 ? 1 : -1)));
  };

  const handlePageSwipeTouchCancel = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    finishPageSwipe();
  };

  const handlePageSwipeClickCapture = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (Date.now() < pageSwipeBlockUntilRef.current) {
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  };

  const closeProfileOptions = () => {
    setMenuOpen(false);
    setProfileDrawerOpen(false);
  };

  const handleProfileClick = () => {
    if (isMobileViewport()) {
      setMenuOpen(false);
      setProfileDrawerOpen((open) => !open);
      return;
    }
    setProfileDrawerOpen(false);
    setMenuOpen((open) => !open);
  };

  const renderThemeActions = () => (
    <div className="px-2 py-1">
      <ThemeToggle themeMode={themeMode} setThemeMode={setThemeMode} />
    </div>
  );

  const renderProfileActions = ({
    includeExtension,
    includeDownloadApp,
  }: {
    includeExtension: boolean;
    includeDownloadApp: boolean;
  }) => (
    <>
      <MenuItem
        onClick={() => {
          navigate("/settings");
          closeProfileOptions();
        }}
      >
        <Settings className="h-4 w-4" />
        Settings
      </MenuItem>
      <MenuItem
        onClick={() => {
          navigate("/guide");
          closeProfileOptions();
        }}
      >
        <BookOpen className="h-4 w-4" />
        Guide
      </MenuItem>
      <MenuItem
        onClick={() => {
          onOpenAbout();
          closeProfileOptions();
        }}
      >
        <Info className="h-4 w-4" />
        About
      </MenuItem>
      <MenuItem
        onClick={() => {
          openModal();
          closeProfileOptions();
        }}
      >
        <Sparkles className="h-4 w-4" />
        What&apos;s new
        {hasUpdate && <span className="ml-auto h-2 w-2 flex-shrink-0 rounded-full bg-app-ink" />}
      </MenuItem>
      {includeExtension ? (
        <MenuItem
          onClick={() => {
            closeProfileOptions();
            window.open(getExtensionStoreUrl(), "_blank", "noopener,noreferrer");
          }}
        >
          <Puzzle className="h-4 w-4" />
          Download extension
        </MenuItem>
      ) : null}
      {includeDownloadApp ? (
        <MenuItem
          onClick={() => {
            closeProfileOptions();
            window.open(desktopAppReleaseUrl, "_blank", "noopener,noreferrer");
          }}
        >
          <Download className="h-4 w-4" />
          Download app
        </MenuItem>
      ) : null}
      <MenuItem
        onClick={() => {
          closeProfileOptions();
          setFeedbackModalOpen(true);
        }}
      >
        <MessageSquare className="h-4 w-4" />
        Share feedback
      </MenuItem>
      <div className="my-2 h-px bg-app-line" />
      {renderThemeActions()}
      <div className="my-2 h-px bg-app-line" />
      <MenuItem
        onClick={() => {
          window.localStorage.removeItem(storageKeys.uiState);
          signOut();
          window.location.assign("/");
          closeProfileOptions();
        }}
      >
        <LogOut className="h-4 w-4" />
        Log out
      </MenuItem>
    </>
  );

  return (
    <>
    <nav
      ref={navRef}
      style={keyboardOpen ? { display: "none" } : undefined}
      className={[
        "fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),1200px)] -translate-x-1/2 transform-gpu",
        forceHidden ? "transition-none" : "transition-transform duration-app-slow ease-app-in-out",
        shouldHide ? "translate-y-[calc(100%+0.5rem)] pointer-events-none" : "translate-y-0",
        profileDrawerOpen ? "pointer-events-none" : "",
      ].join(" ")}
    >
      {/* Single-height pill bar */}
        <div className="relative h-12">
          {/* ── Layer 1: Normal nav (tabs + profile) ─────────────────────── */}
          <div className={[
            "absolute inset-0 transition-[transform,opacity] duration-app-slow ease-app-in-out",
            isExploreRoute ? "pointer-events-none translate-y-2 opacity-0" : "translate-y-0 opacity-100",
          ].join(" ")}>
              <div className="grid h-full grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3">
                {/* Compass — hidden in reader view */}
                {!isReaderRoute ? (
                  <button
                    className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-line bg-app-surface p-0 text-app-ink-muted shadow-soft transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
                    aria-label="Open explore"
                    onClick={openExplore}
                  >
                    <Compass className="h-4 w-4" />
                  </button>
                ) : (
                  <div className="h-12 w-12 shrink-0" />
                )}

            {/* Tab pills */}
            <div className="relative flex min-w-0 items-center justify-center">
              <SegmentedShell
                ref={pillRef}
                data-omanote-page-swipe-zone="true"
                onTouchStart={handlePageSwipeTouchStart}
                onTouchMove={handlePageSwipeTouchMove}
                onTouchEnd={handlePageSwipeTouchEnd}
                onTouchCancel={handlePageSwipeTouchCancel}
                onClickCapture={handlePageSwipeClickCapture}
                style={{ touchAction: "none" }}
                className="min-w-0 gap-1 p-2 shadow-nav"
              >
                {highlightStyle ? (
                  <SegmentedHighlight style={highlightStyle} />
                ) : null}
                {tabs.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/reader"}
                    aria-label={label}
                    ref={(node) => {
                      tabRefs.current[to] = node;
                    }}
                    className={({ isActive }) =>
                      segmentedItemClass({
                        active: isActive,
                        className:
                          "relative flex flex-col items-center justify-center px-3 py-2 text-app-ink-muted transition-[transform,color,opacity] duration-150 ease-out active:translate-y-px active:scale-[0.98] md:flex-row md:px-4",
                      })
                    }
                  >
                    {({ isActive }) => {
                      const showIcon = navLabelStyle !== "label-only";
                      const showLabel = navLabelStyle === "label-only" || navLabelStyle === "icon-label" || (navLabelStyle === "active-label" && isActive);
                      return (
                        <>
                          <Icon className={`relative z-10 h-4 w-4 md:h-3.5 md:w-3.5${showIcon ? "" : " md:hidden"}`} />
                          <SegmentedItemLabel
                            visible={showLabel}
                            withLeadingGap={showIcon && showLabel}
                            className="relative z-10 font-medium text-[14px] leading-none"
                          >
                            {label}
                          </SegmentedItemLabel>
                        </>
                      );
                    }}
                  </NavLink>
                ))}
              </SegmentedShell>
            </div>

            {/* Profile */}
            <div ref={profileMenuRef} className="relative justify-self-end shrink-0">
              <button
                className="relative flex h-12 w-12 overflow-hidden rounded-full border border-app-line bg-app-surface p-0 shadow-soft transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
                onClick={handleProfileClick}
                aria-label="Profile menu"
              >
                <img
                  src={user?.imageUrl ?? defaultAvatarSrc}
                  alt={user?.name ? `${user.name} profile` : "Profile avatar"}
                  className="absolute inset-0 h-full w-full object-cover"
                />
              </button>
              {hasUpdate && (
                <span className="pointer-events-none absolute right-0 top-0 h-3 w-3 rounded-full border-2 border-app-surface bg-app-ink" />
              )}
              {menuOpen ? (
                <div className="absolute bottom-full right-0 z-50 mb-2 w-64 rounded-2xl border border-app-line bg-app-surface-raised p-3 shadow-menu">
                  <div className="px-1 py-1">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <p className="truncate text-sm font-bold text-app-ink">{user?.name ?? "Guest"}</p>
                        <p className="truncate text-xs text-app-ink-faint">{user?.email ? maskEmail(user.email) : ""}</p>
                      </div>
                      <a
                        href={accountProfileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="shrink-0 text-xs font-medium text-app-accent hover:underline"
                      >
                        Edit
                      </a>
                    </div>
                  </div>
                  <div className="my-2 h-px bg-app-line" />
                  {renderProfileActions({
                    includeExtension: !runningInDesktopApp,
                    includeDownloadApp: !runningInDesktopApp && !isMobileViewport(),
                  })}
                </div>
              ) : null}
            </div>
          </div>
            </div>

          {/* ── Layer 2: Explore mode (X + search bar) ───────────────────── */}
          <div className={[
            "absolute inset-0 transition-[transform,opacity] duration-app-slow ease-app-in-out",
            isExploreRoute ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-2 opacity-0",
          ].join(" ")}>
              <div className="flex h-full items-center gap-2">
                {/* X / close button */}
                <Button
                  tone="ghost"
                  className="h-12 w-12 shrink-0 rounded-full border border-app-line bg-app-surface/80 p-0 text-app-ink shadow-none hover:bg-app-surface"
                  aria-label="Close explore"
                  onClick={closeExplore}
                >
                  <X className="h-4 w-4" />
                </Button>

            {/* Search input with inline clear */}
            <div className="relative flex-1">
              <Input
                ref={searchInputRef}
                data-omanote-nav-search-input="true"
                aria-label="Search your omanote"
                placeholder="Search notes, todos, bookmarks…"
                value={searchQuery}
                onChange={(event) => dispatch({ type: "ui/set-search-query", query: event.target.value })}
                onKeyDown={(event) => {
                  if (event.key === "Escape") closeExplore();
                }}
                className="h-12 w-full rounded-app-chip border border-app-line bg-app-surface/70 px-4 pr-10 text-sm shadow-app-nav-active-inset dark:shadow-none backdrop-blur-md placeholder:text-app-ink-faint focus:border-app-line-strong"
              />
              {searchQuery.length > 0 && (
                <button
                  type="button"
                  aria-label="Clear search"
                  onClick={() => {
                    dispatch({ type: "ui/set-search-query", query: "" });
                    searchInputRef.current?.focus();
                  }}
                  className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-ink-faint hover:bg-app-surface-hover hover:text-app-ink"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>
            </div>
      </div>
    </nav>
    <ProfileOptionsDrawer
      open={profileDrawerOpen}
      userName={user?.name ?? "Guest"}
      userEmail={user?.email ? maskEmail(user.email) : ""}
      userImageUrl={user?.imageUrl ?? defaultAvatarSrc}
      onClose={closeProfileOptions}
    >
      {renderProfileActions({ includeExtension: false, includeDownloadApp: false })}
    </ProfileOptionsDrawer>
    {feedbackModalOpen && <FeedbackModal onClose={() => setFeedbackModalOpen(false)} />}
</>
  );
}

function ProfileOptionsDrawer({
  open,
  userName,
  userEmail,
  userImageUrl,
  onClose,
  children,
}: {
  open: boolean;
  userName: string;
  userEmail: string;
  userImageUrl: string;
  onClose: () => void;
  children: React.ReactNode;
}) {
  const { dragOffset, isDragging, dragHandleProps } = useDrawerDrag(onClose);
  const [isEntered, setIsEntered] = useState(false);

  useEffect(() => {
    if (!open) {
      setIsEntered(false);
      return;
    }

    let secondFrame: number | null = null;
    const firstFrame = window.requestAnimationFrame(() => {
      secondFrame = window.requestAnimationFrame(() => {
        setIsEntered(true);
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrame);
      if (secondFrame !== null) {
        window.cancelAnimationFrame(secondFrame);
      }
    };
  }, [open]);

  if (!open) return null;

  return (
    <ModalPortal>
      <div
        data-testid="profile-options-backdrop"
        aria-hidden="true"
        className="fixed inset-0 z-app-overlay bg-black/65 opacity-100 transition-opacity duration-app-drawer ease-app-drawer md:hidden"
        onPointerDown={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onPointerUp={(event) => {
          event.preventDefault();
          event.stopPropagation();
        }}
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          onClose();
        }}
      />
      <section
        role="dialog"
        aria-label="Profile options"
        className={[
          "fixed inset-x-0 bottom-0 z-app-drawer flex max-h-[92dvh] min-h-0 flex-col rounded-t-2xl bg-app-surface-raised shadow-drawer transform-gpu md:hidden",
          isDragging ? "" : "transition-transform duration-app-drawer ease-app-drawer",
          isEntered ? "translate-y-0" : "translate-y-full",
        ].join(" ")}
        style={isDragging || dragOffset > 0 ? { transform: `translateY(${dragOffset}px)` } : undefined}
      >
        <div className="shrink-0 px-4 pt-3 pb-2" {...dragHandleProps} onClick={onClose}>
          <GripHorizontal className="mx-auto h-5 w-5 text-app-line-strong" />
        </div>
        <div
          data-testid="profile-options-header"
          className="shrink-0 border-b border-app-line px-5 py-4"
          onClick={onClose}
          {...dragHandleProps}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex flex-1 items-center gap-3">
              <img
                src={userImageUrl}
                alt={userName ? `${userName} profile` : "Profile avatar"}
                className="h-10 w-10 shrink-0 rounded-full border border-app-line object-cover"
              />
              <div className="min-w-0 flex-1">
                <p className="w-full truncate text-base font-bold text-app-ink">{userName}</p>
                <p className="mt-1 w-full truncate text-sm text-app-ink-faint">{userEmail}</p>
              </div>
            </div>
            <a
              href={accountProfileUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 text-sm font-medium text-app-accent hover:underline"
              onClick={(event) => event.stopPropagation()}
            >
              Edit
            </a>
          </div>
        </div>
        <div className="space-y-1 px-3 py-3 pb-[calc(env(safe-area-inset-bottom)+1rem)]">
          {children}
        </div>
      </section>
    </ModalPortal>
  );
}
