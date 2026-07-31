import { useEffect, useRef, type RefObject } from "react";

const AXIS_LOCK_THRESHOLD = 6;
const SWIPE_DISTANCE_THRESHOLD = 56;

/** Either an element ref, or `window` to cover the whole screen. */
export type SwipeTarget = RefObject<HTMLElement | null> | Window;

/**
 * Horizontal swipe navigation on a touch surface.
 *
 * The axis is locked as soon as the finger has moved a few pixels, and
 * horizontal moves call preventDefault so the surface never scrolls (or shifts
 * the AppShell top chrome) while a swipe is in flight. Vertical moves are left
 * alone so normal scrolling still works.
 */
export function useHorizontalSwipe(
  target: SwipeTarget,
  onSwipe: (direction: "prev" | "next") => void,
  enabled = true,
) {
  const startRef = useRef<{ x: number; y: number } | null>(null);
  const axisRef = useRef<"horizontal" | "vertical" | null>(null);
  const onSwipeRef = useRef(onSwipe);
  onSwipeRef.current = onSwipe;

  useEffect(() => {
    // Duck-typed rather than `instanceof Window`: the window object is not
    // always an instance of the realm's own Window (jsdom, iframes).
    const surface: EventTarget | null = "current" in target ? target.current : target;
    if (!enabled || !surface) return;

    const handleTouchStart = (event: TouchEvent) => {
      const activeEl = document.activeElement as HTMLElement | null;
      if (activeEl && (activeEl.tagName === "INPUT" || activeEl.tagName === "TEXTAREA" || activeEl.isContentEditable)) return;
      const touch = event.touches[0];
      if (!touch) return;
      startRef.current = { x: touch.clientX, y: touch.clientY };
      axisRef.current = null;
    };

    const handleTouchMove = (event: TouchEvent) => {
      if (!startRef.current) return;
      if (axisRef.current === "horizontal") {
        event.preventDefault();
        return;
      }
      if (axisRef.current === "vertical") return;
      const touch = event.touches[0];
      if (!touch) return;
      const dx = touch.clientX - startRef.current.x;
      const dy = touch.clientY - startRef.current.y;
      if (Math.abs(dx) < AXIS_LOCK_THRESHOLD && Math.abs(dy) < AXIS_LOCK_THRESHOLD) return;
      axisRef.current = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
      if (axisRef.current === "horizontal") event.preventDefault();
    };

    const handleTouchEnd = (event: TouchEvent) => {
      const start = startRef.current;
      startRef.current = null;
      axisRef.current = null;
      if (!start) return;
      const touch = event.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - start.x;
      const deltaY = touch.clientY - start.y;
      if (Math.abs(deltaX) < SWIPE_DISTANCE_THRESHOLD || Math.abs(deltaX) <= Math.abs(deltaY)) return;
      onSwipeRef.current(deltaX < 0 ? "next" : "prev");
    };

    const onStart = handleTouchStart as EventListener;
    const onMove = handleTouchMove as EventListener;
    const onEnd = handleTouchEnd as EventListener;
    surface.addEventListener("touchstart", onStart, { passive: true });
    surface.addEventListener("touchmove", onMove, { passive: false });
    surface.addEventListener("touchend", onEnd, { passive: true });
    return () => {
      surface.removeEventListener("touchstart", onStart);
      surface.removeEventListener("touchmove", onMove);
      surface.removeEventListener("touchend", onEnd);
    };
  }, [enabled, target]);
}
