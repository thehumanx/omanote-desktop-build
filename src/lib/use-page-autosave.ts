import { useCallback, useEffect, useRef } from "react";

export const PAGE_AUTOSAVE_DEBOUNCE_MS = 800;

/**
 * Debounced autosave with guaranteed flush points.
 *
 * The debounce alone is not enough: a user who types and immediately closes
 * the tab, navigates away, or switches apps on mobile would lose whatever
 * landed in the last debounce window. So every path out of the editor forces
 * a flush — route change (the cleanup), tab hide (`visibilitychange`, the only
 * one mobile browsers reliably fire before killing a backgrounded page), and
 * `pagehide`/`beforeunload`.
 *
 * `save` is held in a ref so those listeners are registered once rather than
 * being torn down and rebuilt on every keystroke.
 */
export function usePageAutosave(save: (reason: AutosaveReason) => void) {
  const saveRef = useRef(save);
  saveRef.current = save;
  const timerRef = useRef<number | null>(null);
  const dirtyRef = useRef(false);

  const flush = useCallback((reason: AutosaveReason) => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (!dirtyRef.current) return;
    dirtyRef.current = false;
    saveRef.current(reason);
  }, []);

  const schedule = useCallback(() => {
    dirtyRef.current = true;
    if (timerRef.current !== null) window.clearTimeout(timerRef.current);
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      if (!dirtyRef.current) return;
      dirtyRef.current = false;
      saveRef.current("debounce");
    }, PAGE_AUTOSAVE_DEBOUNCE_MS);
  }, []);

  useEffect(() => {
    const onVisibilityChange = () => {
      if (document.visibilityState === "hidden") flush("hidden");
    };
    const onPageHide = () => flush("unload");

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("beforeunload", onPageHide);
    return () => {
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("beforeunload", onPageHide);
      // Unmount is a route change — the last edits have to go out now, since
      // nothing will be left to fire the pending timer.
      flush("unmount");
    };
  }, [flush]);

  return { schedule, flush };
}

export type AutosaveReason = "debounce" | "hidden" | "unload" | "unmount" | "manual";
