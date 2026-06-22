import { useCallback, useEffect, useLayoutEffect, useRef, useState, type MutableRefObject, type RefObject } from "react";

export type HighlightStyle = {
  transform: string;
  width: number;
  height: number;
  opacity: number;
};

export type HighlightItemRefs<T extends HTMLElement = HTMLElement> = Record<string, T | null>;

type UseMeasuredHighlightOptions<T extends HTMLElement = HTMLElement> = {
  activeKey: string | null;
  containerRef: RefObject<HTMLElement>;
  itemRefs: MutableRefObject<HighlightItemRefs<T>>;
  layoutKey?: string | number;
  scrollActiveIntoView?: boolean;
  observeResize?: boolean;
  getTargetSize?: (activeElement: T) => Partial<Pick<HighlightStyle, "width" | "height">> | undefined;
};

function sameHighlightStyle(left: HighlightStyle | null, right: HighlightStyle | null) {
  if (left === right) return true;
  if (!left || !right) return false;
  return left.transform === right.transform && left.width === right.width && left.height === right.height && left.opacity === right.opacity;
}

export function useMeasuredHighlight<T extends HTMLElement = HTMLElement>({
  activeKey,
  containerRef,
  itemRefs,
  layoutKey,
  scrollActiveIntoView = false,
  observeResize = true,
  getTargetSize,
}: UseMeasuredHighlightOptions<T>) {
  const [highlightStyle, setHighlightStyle] = useState<HighlightStyle | null>(null);
  const frameRef = useRef<number | null>(null);

  const measure = useCallback(
    (shouldScrollActiveIntoView = false) => {
      const container = containerRef.current;
      const activeElement = activeKey ? itemRefs.current[activeKey] : null;

      if (!container || !activeElement) {
        setHighlightStyle((current) => (current === null ? current : null));
        return;
      }

      const targetSize = getTargetSize?.(activeElement);
      const nextStyle: HighlightStyle = {
        transform: `translate3d(${activeElement.offsetLeft}px, ${activeElement.offsetTop}px, 0)`,
        width: targetSize?.width ?? activeElement.offsetWidth,
        height: targetSize?.height ?? activeElement.offsetHeight,
        opacity: 1,
      };

      setHighlightStyle((current) => (sameHighlightStyle(current, nextStyle) ? current : nextStyle));

      if (shouldScrollActiveIntoView) {
        activeElement.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "nearest" });
      }
    },
    [activeKey, containerRef, getTargetSize, itemRefs],
  );

  const scheduleMeasure = useCallback(() => {
    if (frameRef.current !== null) {
      window.cancelAnimationFrame(frameRef.current);
    }
    frameRef.current = window.requestAnimationFrame(() => {
      frameRef.current = null;
      measure(false);
    });
  }, [measure]);

  useLayoutEffect(() => {
    measure(scrollActiveIntoView);
  }, [layoutKey, measure, scrollActiveIntoView]);

  useEffect(() => {
    if (!observeResize) {
      window.addEventListener("resize", scheduleMeasure);

      return () => {
        window.removeEventListener("resize", scheduleMeasure);
        if (frameRef.current !== null) {
          window.cancelAnimationFrame(frameRef.current);
          frameRef.current = null;
        }
      };
    }

    const container = containerRef.current;
    if (!container) return;

    const observer = new ResizeObserver(scheduleMeasure);
    observer.observe(container);

    for (const item of Object.values(itemRefs.current)) {
      if (item) observer.observe(item);
    }

    window.addEventListener("resize", scheduleMeasure);

    return () => {
      observer.disconnect();
      window.removeEventListener("resize", scheduleMeasure);
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
    };
  }, [activeKey, containerRef, itemRefs, layoutKey, observeResize, scheduleMeasure]);

  return highlightStyle;
}
