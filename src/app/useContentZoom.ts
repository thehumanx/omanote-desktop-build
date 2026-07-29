import { useCallback, useEffect, useRef, useState } from "react";

const STORAGE_KEY = "omanote.content-zoom";
const DEFAULT_ZOOM = 100;
const ZOOM_STEP = 10;
const MIN_ZOOM = 70;
const MAX_ZOOM = 150;
const INDICATOR_HIDE_DELAY_MS = 1200;

function clampZoom(value: number) {
  return Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, value));
}

function readStoredZoom() {
  if (typeof window === "undefined") return DEFAULT_ZOOM;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? Number(raw) : NaN;
    return Number.isFinite(parsed) ? clampZoom(parsed) : DEFAULT_ZOOM;
  } catch {
    return DEFAULT_ZOOM;
  }
}

// App-wide content zoom, toggled with Cmd/Ctrl +/-/0. Scales the root
// font-size (see `--omanote-content-zoom` in index.css), which cascades
// through the app's rem-based Tailwind classes.
export function useContentZoom() {
  const [zoomPercent, setZoomPercent] = useState(readStoredZoom);
  const [indicatorVisible, setIndicatorVisible] = useState(false);
  const hideTimerRef = useRef<number | null>(null);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty("--omanote-content-zoom", String(zoomPercent / 100));
    try {
      window.localStorage.setItem(STORAGE_KEY, String(zoomPercent));
    } catch {
      // Ignore storage failures (private browsing, quota, etc).
    }
    // The root font-size change resizes rem-sized content (nav pills, tab
    // highlights, etc.) without touching the viewport, so it never fires a
    // native "resize" event -- several JS-measured highlight/pill
    // components (e.g. BottomNav's tab highlight, which opts out of
    // ResizeObserver-based remeasuring for perf) only re-sync on window
    // resize. Dispatch one after the browser applies the new font-size so
    // those pills don't end up stuck at their pre-zoom pixel dimensions.
    const frame = window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event("resize"));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [zoomPercent]);

  const flashIndicator = useCallback(() => {
    setIndicatorVisible(true);
    if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    hideTimerRef.current = window.setTimeout(() => {
      setIndicatorVisible(false);
      hideTimerRef.current = null;
    }, INDICATOR_HIDE_DELAY_MS);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (event.key === "=" || event.key === "+") {
        event.preventDefault();
        setZoomPercent((prev) => clampZoom(prev + ZOOM_STEP));
        flashIndicator();
      } else if (event.key === "-" || event.key === "_") {
        event.preventDefault();
        setZoomPercent((prev) => clampZoom(prev - ZOOM_STEP));
        flashIndicator();
      } else if (event.key === "0") {
        event.preventDefault();
        setZoomPercent(DEFAULT_ZOOM);
        flashIndicator();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [flashIndicator]);

  useEffect(() => {
    return () => {
      if (hideTimerRef.current !== null) window.clearTimeout(hideTimerRef.current);
    };
  }, []);

  return { zoomPercent, indicatorVisible };
}
