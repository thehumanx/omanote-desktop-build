import { useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent, type ReactNode, type TouchEvent as ReactTouchEvent } from "react";
import { Bookmark, BookmarkCheck, CalendarDays, CheckSquare, FileText, Plus, Rss, SquarePen, X } from "lucide-react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { SegmentedHighlight, SegmentedItemLabel, SegmentedShell, segmentedItemClass } from "../ui";
import { useMeasuredHighlight } from "../../hooks/useMeasuredHighlight";
import { getComposerModeForPathname, getNavRouteIndex, getWrappedNavRoutePath } from "./navRoutes";
import { useUserSettings } from "../../contexts/UserSettingsContext";

/** Exported so the landing page's preview chrome shows the same tabs, in the
 *  same order, without duplicating the list. */
export const writeTabs = [
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

export function BottomNav({
  hidden = false,
  forceHidden = false,
  trailing,
}: {
  hidden?: boolean;
  forceHidden?: boolean;
  /** After the tabs — the profile avatar, which AppShell owns. */
  trailing?: ReactNode;
}) {
  const location = useLocation();
  const isUpdatesRoute = location.pathname.startsWith("/updates");
  const isSettingsRoute = location.pathname.startsWith("/settings");
  const isInsightsRoute = location.pathname.startsWith("/insights");
  const isGuideRoute = location.pathname.startsWith("/guide");
  const isExploreRoute = location.pathname.startsWith("/explore");

  // History has no nav at all — it's a focused drill-down with its own X in
  // the top bar and its own floating date-jump button, and the tab pill would
  // just sit on top of the day content for no reason.
  if (location.pathname === "/history") return <NoBottomNav />;

  // Explore is the hashtag mind map alone: like Settings, its nav is just a way out.
  if (isUpdatesRoute || isSettingsRoute || isInsightsRoute || isGuideRoute || isExploreRoute) {
    const label = isExploreRoute
      ? "Close explore"
      : isSettingsRoute
      ? "Close settings"
      : isInsightsRoute
        ? "Close insights"
        : isGuideRoute
          ? "Close guide"
          : "Close updates";
    return <SimpleRouteCloseNav forceHidden={forceHidden} hidden={hidden} label={label} />;
  }

  return <FullBottomNav hidden={hidden} forceHidden={forceHidden} trailing={trailing} />;
}

/**
 * Renders nothing, but zeroes the height variable while it's mounted —
 * every screen sizes its bottom clearance off `--omanote-bottom-nav-height`,
 * so leaving the previous route's value behind would strand dead space at
 * the bottom of a page that has no nav.
 */
function NoBottomNav() {
  useEffect(() => {
    document.documentElement.style.setProperty("--omanote-bottom-nav-height", "0px");
  }, []);
  return null;
}

function SimpleRouteCloseNav({ hidden, forceHidden, label }: { hidden: boolean; forceHidden: boolean; label: string }) {
  const navRef = useRef<HTMLElement | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
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
    // location.key is "default" when this entry was reached by a hard/full
    // page navigation (e.g. a redirect back from an external OAuth flow like
    // Google Calendar connect) rather than in-app routing. window.history
    // still reports a non-trivial length in that case, but the entries
    // behind it belong to the external site, not this app — navigate(-1)
    // would send the user out to that redirect chain instead of back
    // through the app, so fall back to a known-good in-app route instead.
    if (location.key !== "default" && window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/canvas");
  };

  return (
    <nav
      ref={navRef}
      className={[
        "fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),1024px)] -translate-x-1/2 transform-gpu pointer-events-none",
        forceHidden ? "transition-none" : "transition-transform duration-app-slow ease-app-in-out",
        shouldHide ? "translate-y-[calc(100%+0.5rem)]" : "translate-y-0",
      ].join(" ")}
    >
      <div className="relative h-12">
        <div className="flex h-full items-center justify-end">
          <button
            className="app-frost pointer-events-auto relative flex h-12 w-12 items-center justify-center rounded-full border border-app-line bg-app-surface p-0 text-app-ink-muted shadow-soft transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
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

function FullBottomNav({ hidden = false, forceHidden = false, trailing }: { hidden?: boolean; forceHidden?: boolean; trailing?: ReactNode }) {
  const navRef = useRef<HTMLElement | null>(null);
  const mobileTabRowRef = useRef<HTMLDivElement | null>(null);
  const mobileTabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const pillRef = useRef<HTMLDivElement | null>(null);
  const tabRefs = useRef<Record<string, HTMLAnchorElement | null>>({});
  const pageSwipeStartRef = useRef<{ x: number; y: number } | null>(null);
  const pageSwipeAxisRef = useRef<"horizontal" | "vertical" | null>(null);
  const pageSwipeBlockUntilRef = useRef(0);
  const currentNavRouteIndexRef = useRef(-1);
  const location = useLocation();
  const navigate = useNavigate();
  const { dispatch } = useApp();
  const { settings } = useUserSettings();
  const navLabelStyle = settings.navLabelStyle;
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
  const composerModeForActiveTab = getComposerModeForPathname(location.pathname);
  const highlightStyle = useMeasuredHighlight({
    activeKey: activeTab,
    containerRef: pillRef,
    itemRefs: tabRefs,
    layoutKey: `${navLabelStyle}:${isReaderRoute ? "read" : "write"}`,
    observeResize: false,
  });
  const mobileHighlightStyle = useMeasuredHighlight({
    activeKey: activeTab,
    containerRef: mobileTabRowRef,
    itemRefs: mobileTabRefs,
    layoutKey: isReaderRoute ? "read" : "write",
    observeResize: false,
  });

  const shouldHide = forceHidden || hidden;

  currentNavRouteIndexRef.current = activeTabIndex;

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

  const handlePageSwipeTouchStart = (event: ReactTouchEvent<HTMLDivElement>) => {
    event.stopPropagation();
    if (currentNavRouteIndexRef.current === -1) return;
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

  return (
    <nav
      ref={navRef}
      style={keyboardOpen ? { display: "none" } : undefined}
      className={[
        // Capped to the same 1024px the page content uses (see AppShell)
        // so the pill never floats wider than the canvas/todos/notes/etc column.
        "fixed bottom-4 left-1/2 z-50 w-[min(calc(100vw-2rem),1024px)] -translate-x-1/2 transform-gpu",
        forceHidden ? "transition-none" : "transition-transform duration-app-slow ease-app-in-out",
        shouldHide ? "translate-y-[calc(100%+0.5rem)] pointer-events-none" : "translate-y-0",
      ].join(" ")}
    >
      {/* Single-height pill bar */}
      <div className="relative h-12">
        <div className="absolute inset-0">
          {/* One row: "+" compose, the tab pill (desktop or mobile variant), the avatar. */}
          <div data-testid="nav-row" className="flex h-full w-full items-center justify-center gap-2">
          {!isReaderRoute ? (
            <button
              type="button"
              aria-label="New artifact"
              onClick={() => dispatch({ type: "ui/open-composer", mode: composerModeForActiveTab })}
              className="app-frost flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-app-line bg-app-surface p-0 text-app-ink-muted shadow-soft transition-[transform,background-color,box-shadow] duration-150 ease-out hover:bg-app-surface-hover active:translate-y-px active:scale-[0.98]"
            >
              <Plus className="h-5 w-5" />
            </button>
          ) : null}
          <div data-testid="desktop-tab-row" className="hidden h-full min-w-0 items-center justify-center md:flex">
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
                className="app-frost min-w-0 gap-1 p-2 shadow-nav"
              >
                {highlightStyle ? <SegmentedHighlight style={highlightStyle} /> : null}
                {tabs.map(({ to, label, icon: Icon }) => {
                  // Keyed off `activeTab` rather than NavLink's own isActive
                  // so tab-less routes that belong to a tab (see
                  // navRouteAliases) light it up like the tab's own route.
                  const isActive = to === activeTab;
                  const showIcon = navLabelStyle !== "label-only";
                  const showLabel = navLabelStyle === "label-only" || navLabelStyle === "icon-label" || (navLabelStyle === "active-label" && isActive);
                  return (
                    <NavLink
                      key={to}
                      to={to}
                      end={to === "/reader"}
                      aria-label={label}
                      ref={(node) => {
                        tabRefs.current[to] = node;
                      }}
                      className={segmentedItemClass({
                        active: isActive,
                        className:
                          "relative flex flex-col items-center justify-center px-3 py-2 text-app-ink-muted transition-[transform,color,opacity] duration-150 ease-out active:translate-y-px active:scale-[0.98] md:flex-row md:px-4",
                      })}
                    >
                      <Icon className={`relative z-10 h-4 w-4 md:h-3.5 md:w-3.5${showIcon ? "" : " md:hidden"}`} />
                      <SegmentedItemLabel
                        visible={showLabel}
                        withLeadingGap={showIcon && showLabel}
                        className="relative z-10 font-medium text-[14px] leading-none"
                      >
                        {label}
                      </SegmentedItemLabel>
                    </NavLink>
                  );
                })}
              </SegmentedShell>
            </div>

          </div>

          {/* Mobile: icon-only tabs hugging their content */}
          <div data-testid="mobile-tab-row" className="flex h-full min-w-0 items-center justify-center md:hidden">
            <div className="relative">
              <SegmentedShell
                ref={mobileTabRowRef}
                data-omanote-page-swipe-zone="true"
                onTouchStart={handlePageSwipeTouchStart}
                onTouchMove={handlePageSwipeTouchMove}
                onTouchEnd={handlePageSwipeTouchEnd}
                onTouchCancel={handlePageSwipeTouchCancel}
                onClickCapture={handlePageSwipeClickCapture}
                style={{ touchAction: "none" }}
                className="app-frost gap-1 p-2 shadow-nav"
              >
                {mobileHighlightStyle ? <SegmentedHighlight style={mobileHighlightStyle} /> : null}
                {tabs.map(({ to, label, icon: Icon }) => (
                  <NavLink
                    key={to}
                    to={to}
                    end={to === "/reader"}
                    aria-label={label}
                    ref={(node) => {
                      mobileTabRefs.current[to] = node;
                    }}
                    className={segmentedItemClass({
                      active: to === activeTab,
                      className:
                        "relative flex items-center justify-center px-3 py-2 text-app-ink-muted transition-[transform,color,opacity] duration-150 ease-out active:translate-y-px active:scale-[0.98]",
                    })}
                  >
                    <Icon className="relative z-10 h-4 w-4" />
                  </NavLink>
                ))}
              </SegmentedShell>
            </div>
          </div>
          {trailing ? <div className="flex shrink-0 items-center">{trailing}</div> : null}
          </div>
        </div>

      </div>
    </nav>
  );
}
