import { useEffect, type RefObject } from "react";

const FADE_SIZE = "56px";
const TOP_CHROME = "var(--omanote-top-chrome-height, 0px)";

/**
 * useScrollEdgeFade for pages that scroll the window rather than an inner
 * panel (Canvas, a page). A mask on a tall element is sized to the element,
 * so this one is sized to the viewport and moved down the element as the
 * window scrolls — the fade stays on the screen's edges. The top edge starts
 * under the top bar and fades only once scrolled; the bottom fades while
 * there is more page below. Styles are written straight to the node: no
 * re-render per scroll frame.
 */
export function useWindowScrollEdgeFade(
  ref: RefObject<HTMLElement | null>,
  { enabled = true, bottomSize = FADE_SIZE }: { enabled?: boolean; bottomSize?: string } = {},
) {
  useEffect(() => {
    const node = ref.current;
    if (!node || !enabled) return;
    let frame = 0;
    let lastMask = "";
    const update = () => {
      frame = 0;
      const rect = node.getBoundingClientRect();
      const viewport = window.innerHeight;
      const offset = Math.max(0, -rect.top);
      const top = offset > 0;
      const bottom = offset + viewport < rect.height - 1;
      const mask = `linear-gradient(to bottom, ${
        top ? `transparent ${TOP_CHROME}, black calc(${TOP_CHROME} + ${FADE_SIZE})` : "black 0px"
      }, ${bottom ? `black calc(100% - ${bottomSize}), transparent` : "black"})`;
      if (mask !== lastMask) {
        lastMask = mask;
        node.style.maskImage = mask;
        node.style.setProperty("-webkit-mask-image", mask);
      }
      const size = `100% ${viewport}px`;
      const position = `0px ${offset}px`;
      node.style.maskSize = size;
      node.style.maskPosition = position;
      node.style.maskRepeat = "no-repeat";
      node.style.setProperty("-webkit-mask-size", size);
      node.style.setProperty("-webkit-mask-position", position);
      node.style.setProperty("-webkit-mask-repeat", "no-repeat");
    };
    // Tests (and the first paint) want the value now; scrolling batches to a frame.
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", update, { passive: true });
    window.addEventListener("resize", schedule);
    const observer = new ResizeObserver(schedule);
    observer.observe(node);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      window.removeEventListener("scroll", update);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
      for (const prop of ["mask-image", "mask-size", "mask-position", "mask-repeat", "-webkit-mask-image", "-webkit-mask-size", "-webkit-mask-position", "-webkit-mask-repeat"]) {
        node.style.removeProperty(prop);
      }
    };
  }, [ref, enabled, bottomSize]);
}
