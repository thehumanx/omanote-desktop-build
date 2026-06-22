import { useEffect, type RefObject } from "react";

export function useOutsideClick<T extends HTMLElement>(
  ref: RefObject<T | null>,
  enabled: boolean,
  onOutsideClick: () => void,
) {
  useEffect(() => {
    if (!enabled) return;

    const handlePointerDown = (event: PointerEvent) => {
      const target = event.target;
      const root = ref.current;
      if (!(target instanceof Node) || !root || root.contains(target)) return;
      if (target instanceof Element && target.closest("[data-omanote-ignore-outside-click='true']")) return;
      onOutsideClick();
    };

    document.addEventListener("pointerdown", handlePointerDown, true);
    return () => document.removeEventListener("pointerdown", handlePointerDown, true);
  }, [enabled, onOutsideClick, ref]);
}
