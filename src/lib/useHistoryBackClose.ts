import { useEffect, useRef } from "react";

/**
 * Makes a mobile full-screen overlay participate in the browser's native
 * back stack: opening it pushes a history entry, so an edge-swipe-back
 * gesture (or the Android back button) fires `popstate` and closes the
 * overlay instead of falling through to whatever route was loaded before
 * it — that gesture is intercepted by the browser before any in-page
 * pointer handler (like useEdgeSwipeBack) ever sees it.
 *
 * Closing the overlay through any other affordance (scrim tap, close
 * button) consumes the same pushed entry via history.back() so the
 * browser's history stays in sync and a later real back-navigation isn't
 * swallowed by a stale entry.
 */
export function useHistoryBackClose(isOpen: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const pushedRef = useRef(false);

  useEffect(() => {
    if (!isOpen) return;

    window.history.pushState({ omanoteOverlay: true }, "");
    pushedRef.current = true;
    const urlAtPush = window.location.href;

    const handlePopState = () => {
      pushedRef.current = false;
      onCloseRef.current();
    };
    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
      if (!pushedRef.current) return;
      pushedRef.current = false;
      // Only reclaim the pushed entry while it's still the current one. When
      // the overlay goes away because the user navigated elsewhere (a nav
      // tab, a link), the router has already pushed its own entry on top —
      // going back here would land on our stale entry and yank them right
      // back to the page they just left.
      if (window.location.href !== urlAtPush) return;
      window.history.back();
    };
  }, [isOpen]);
}
