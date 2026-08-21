import { useCallback, useRef, useState } from "react";

const CLOSE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.4;

/**
 * Drag-to-dismiss for a full-screen panel, tracked from a slim edge-zone
 * element (see EDGE_ZONE_PX usage at the call site) rather than gating on
 * clientX here, so the rest of the panel keeps native vertical scrolling.
 */
export function useEdgeSwipeBack(onClose: () => void) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef(0);
  const startTimeRef = useRef(0);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "mouse") return;
    startXRef.current = event.clientX;
    startTimeRef.current = Date.now();
    setIsDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isDragging) return;
      const delta = Math.max(0, event.clientX - startXRef.current);
      setDragOffset(delta);
    },
    [isDragging],
  );

  const endDrag = useCallback(
    (event: React.PointerEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      const delta = Math.max(0, event.clientX - startXRef.current);
      const elapsed = Date.now() - startTimeRef.current;
      const velocity = delta / Math.max(elapsed, 1);

      if (delta >= CLOSE_THRESHOLD || velocity >= VELOCITY_THRESHOLD) {
        setDragOffset(0);
        onClose();
      } else {
        setDragOffset(0);
      }
    },
    [isDragging, onClose],
  );

  const edgeSwipeProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp: endDrag,
    onPointerCancel: endDrag,
    style: { touchAction: "none" as const },
  };

  return { dragOffset, isDragging, edgeSwipeProps };
}
