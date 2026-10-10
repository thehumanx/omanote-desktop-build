import { useEffect, useRef, useState, type CSSProperties, type RefObject } from "react";

const FADE_SIZE = 56;

/**
 * Soft top/bottom edges for a scroll container, so content slides under a
 * fade instead of hard-clipping mid-line. Each edge fades only while there is
 * content past it: unscrolled content at the top stays fully visible, and the
 * last row stays sharp once the end is reached.
 */
export function useScrollEdgeFade(
  ref: RefObject<HTMLElement | null>,
  {
    size = `${FADE_SIZE}px`,
    bottomSize = size,
    axis = "y",
  }: { size?: string; bottomSize?: string; /** "x" fades the left and right edges of a sideways scroller. */ axis?: "x" | "y" } = {},
): CSSProperties {
  const [edges, setEdges] = useState({ top: false, bottom: true });

  // The container can mount after the hook (a panel opened later), so the
  // binding is checked after every render and moves when the node changes.
  const bound = useRef<{ node: HTMLElement; detach: () => void } | null>(null);
  useEffect(() => {
    const node = ref.current;
    if (bound.current?.node === node) return;
    bound.current?.detach();
    bound.current = null;
    if (!node) return;
    const update = () => {
      const [offset, visible, total] =
        axis === "x" ? [node.scrollLeft, node.clientWidth, node.scrollWidth] : [node.scrollTop, node.clientHeight, node.scrollHeight];
      const top = offset > 0;
      const bottom = offset + visible < total - 1;
      setEdges((current) => (current.top === top && current.bottom === bottom ? current : { top, bottom }));
    };
    update();
    node.addEventListener("scroll", update, { passive: true });
    const observer = new ResizeObserver(update);
    observer.observe(node);
    for (const child of Array.from(node.children)) observer.observe(child);
    bound.current = {
      node,
      detach: () => {
        node.removeEventListener("scroll", update);
        observer.disconnect();
      },
    };
  });
  // Forget the binding too: StrictMode unmounts and remounts in development,
  // and a binding left in place after detaching made the remount skip
  // re-attaching, so the fade never followed the scroll.
  useEffect(
    () => () => {
      bound.current?.detach();
      bound.current = null;
    },
    [],
  );

  const mask = `linear-gradient(${axis === "x" ? "to right" : "to bottom"}, ${edges.top ? "transparent" : "black"}, black ${size}, black calc(100% - ${bottomSize}), ${edges.bottom ? "transparent" : "black"})`;
  return { maskImage: mask, WebkitMaskImage: mask };
}
