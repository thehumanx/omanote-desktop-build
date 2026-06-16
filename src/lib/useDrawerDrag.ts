import { useCallback, useRef, useState } from "react";

const CLOSE_THRESHOLD = 80;
const VELOCITY_THRESHOLD = 0.4;

export function useDrawerDrag(onClose: () => void) {
  const [dragOffset, setDragOffset] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const startYRef = useRef(0);
  const startTimeRef = useRef(0);
  const lastYRef = useRef(0);

  const onPointerDown = useCallback((event: React.PointerEvent) => {
    if (event.pointerType === "mouse") return;
    startYRef.current = event.clientY;
    lastYRef.current = event.clientY;
    startTimeRef.current = Date.now();
    setIsDragging(true);
    (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
  }, []);

  const onPointerMove = useCallback(
    (event: React.PointerEvent) => {
      if (!isDragging) return;
      const delta = Math.max(0, event.clientY - startYRef.current);
      lastYRef.current = event.clientY;
      setDragOffset(delta);
    },
    [isDragging],
  );

  const onPointerUp = useCallback(
    (event: React.PointerEvent) => {
      if (!isDragging) return;
      setIsDragging(false);
      const delta = Math.max(0, event.clientY - startYRef.current);
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

  const dragHandleProps = {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    style: { touchAction: "none" as const, cursor: "grab" as const },
  };

  return { dragOffset, isDragging, dragHandleProps };
}
