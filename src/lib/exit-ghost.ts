import { useLayoutEffect, type RefObject } from "react";

/**
 * Lets an overlay animate out even though its caller unmounts it outright.
 *
 * Modals and drawers here are rendered as `{open && <Modal />}` — twenty-odd
 * call sites — so the element is gone the frame `open` turns false: they
 * animated in and vanished. Rather than rework every caller to keep its modal
 * mounted, the overlay leaves an inert copy of itself behind on unmount, which
 * plays the exit animation (`className`) and removes itself.
 */
export function spawnExitGhost(
  node: HTMLElement,
  className: string,
  durationMs: number,
  container: HTMLElement = document.body,
): HTMLElement {
  const ghost = node.cloneNode(true) as HTMLElement;
  ghost.setAttribute("aria-hidden", "true");
  ghost.setAttribute("inert", "");
  ghost.removeAttribute("role");
  ghost.removeAttribute("id");
  for (const withId of ghost.querySelectorAll("[id]")) withId.removeAttribute("id");
  ghost.style.pointerEvents = "none";
  ghost.classList.add(className);
  container.appendChild(ghost);
  const remove = () => ghost.remove();
  ghost.addEventListener("animationend", (event) => {
    if (event.target === ghost) remove();
  });
  window.setTimeout(remove, durationMs + 100);
  return ghost;
}

// React's StrictMode mounts, unmounts and remounts in development; a ghost for
// that instant "unmount" would flash an exit animation on every open.
const MIN_LIFETIME_MS = 80;

function prefersReducedMotion() {
  return typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * `present` is for an overlay that stays mounted and returns null when closed
 * (pass its `open`); one that is unmounted to close can leave it at true.
 */
export function useExitGhost(ref: RefObject<HTMLElement | null>, className: string, durationMs: number, present = true) {
  useLayoutEffect(() => {
    // Captured now: by the time the cleanup runs React may have detached the ref.
    const node = ref.current;
    if (!present || !node) return;
    const mountedAt = performance.now();
    // Decided now, while the overlay is on screen: when its owner stays
    // mounted (a menu closed with `present`), the cleanup runs after React has
    // detached the node, which then measures 0×0 at the top-left corner. A
    // fixed overlay's copy goes to <body>; any other (an absolutely placed
    // dropdown) back into its own parent, so its classes place it as before.
    const container = getComputedStyle(node).position === "fixed" ? document.body : node.parentElement;
    return () => {
      // Tests assert that closed overlays are gone; a copy lingering for its
      // animation would read as still open. spawnExitGhost is tested directly.
      if (import.meta.env.MODE === "test") return;
      if (performance.now() - mountedAt < MIN_LIFETIME_MS || prefersReducedMotion()) return;
      if (!container?.isConnected) return;
      spawnExitGhost(node, className, durationMs, container);
    };
  }, [ref, className, durationMs, present]);
}
