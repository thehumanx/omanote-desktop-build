import { useLayoutEffect, useRef, type RefObject } from "react";
import type { CanvasArtifactItem } from "../app/canvas-day-items";

/** One identity for an item from its optimistic row to its synced one. */
export function arrivalKey(item: CanvasArtifactItem): string {
  const data = item.data as { id: string; clientKey?: string };
  return `${item.kind}:${data.clientKey ?? data.id}`;
}

/**
 * Marks items that newly appear on a canvas day while it is on screen.
 *
 * A save closed the composer and the new item was appended at the bottom of
 * the day — often below the fold — with no entrance, so nothing said where it
 * went. Now each arrival fades up once, and one created on this device (still
 * its optimistic row) is scrolled into view if it isn't already.
 *
 * Done in a layout effect, on the DOM, rather than by rendering a class: the
 * effect runs once per commit (render can run twice in StrictMode, and would
 * see the arrival only the first time), and before paint, so there's no flash.
 */
export function useCanvasArrivals(
  rootRef: RefObject<HTMLElement | null>,
  items: CanvasArtifactItem[],
  dayKey: string,
  disabled: boolean,
) {
  const known = useRef<{ day: string; keys: Set<string> } | null>(null);

  useLayoutEffect(() => {
    const keys = new Set(items.map(arrivalKey));
    const previous = known.current;
    known.current = { day: dayKey, keys };
    // First render of a day: everything is already there, nothing "arrived".
    if (disabled || !previous || previous.day !== dayKey) return;

    const root = rootRef.current;
    if (!root) return;
    for (const item of items) {
      const key = arrivalKey(item);
      if (previous.keys.has(key)) continue;
      // Completing a recurring todo swaps its virtual occurrence for a stored
      // one: a new row, but not something that arrived.
      const occurrence = item.data as { id: string; recurringSourceId?: string };
      if (occurrence.recurringSourceId || occurrence.id.includes("::")) continue;
      const row = root.querySelector<HTMLElement>(`[data-arrival-key="${CSS.escape(key)}"]`);
      if (!row) continue;
      row.classList.add("omanote-arrive");
      row.addEventListener("animationend", () => row.classList.remove("omanote-arrive"), { once: true });
      const data = item.data as { id: string; clientKey?: string };
      const createdHere = Boolean(data.clientKey) && data.id === data.clientKey;
      if (createdHere && !isInViewport(row)) {
        const reduce = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        row.scrollIntoView?.({ block: "nearest", behavior: reduce ? "auto" : "smooth" });
      }
    }
  }, [rootRef, items, dayKey, disabled]);
}

function isInViewport(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  return rect.top >= 0 && rect.bottom <= window.innerHeight;
}
