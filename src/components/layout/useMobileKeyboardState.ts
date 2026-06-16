import { useEffect, useRef, useState } from "react";

const MOBILE_MEDIA_QUERY = "(max-width: 767px)";
const DEFAULT_KEYBOARD_THRESHOLD_PX = 100;

type MobileKeyboardState = {
  isMobileViewport: boolean;
  keyboardOpen: boolean;
  keyboardHeight: number;
  viewportHeight: number;
  focusedEditable: boolean;
  focusedNavSearchInput: boolean;
};

const nonTextInputTypes = new Set([
  "button",
  "checkbox",
  "color",
  "file",
  "hidden",
  "image",
  "radio",
  "range",
  "reset",
  "submit",
]);

function isEditableTarget(element: Element | null): element is HTMLElement {
  if (!(element instanceof HTMLElement)) return false;

  if (element instanceof HTMLTextAreaElement) {
    return !element.disabled && !element.readOnly;
  }

  if (element instanceof HTMLInputElement) {
    if (element.disabled || element.readOnly) return false;
    return !nonTextInputTypes.has(element.type.toLowerCase());
  }

  if (element.isContentEditable) return true;
  return element.getAttribute("role") === "textbox";
}

function matchesMobileViewport() {
  if (typeof window === "undefined") return false;
  return window.matchMedia(MOBILE_MEDIA_QUERY).matches;
}

function readViewportHeight() {
  if (typeof window === "undefined") return 0;
  return window.visualViewport?.height ?? window.innerHeight;
}

export function useMobileKeyboardState(thresholdPx = DEFAULT_KEYBOARD_THRESHOLD_PX): MobileKeyboardState {
  const frameRef = useRef<number | null>(null);
  const baselineViewportHeightRef = useRef(0);
  const [state, setState] = useState<MobileKeyboardState>(() => {
    const viewportHeight = readViewportHeight();
    return {
      isMobileViewport: matchesMobileViewport(),
      keyboardOpen: false,
      keyboardHeight: 0,
      viewportHeight,
      focusedEditable: false,
      focusedNavSearchInput: false,
    };
  });

  useEffect(() => {
    if (typeof window === "undefined") return;

    const viewport = window.visualViewport;
    const measure = () => {
      const isMobileViewport = matchesMobileViewport();
      const viewportHeight = readViewportHeight();
      const activeElement = document.activeElement;
      const focusedEditable = isEditableTarget(activeElement);
      const focusedNavSearchInput =
        activeElement instanceof HTMLElement && activeElement.dataset.omanoteNavSearchInput === "true";

      if (baselineViewportHeightRef.current === 0) {
        baselineViewportHeightRef.current = viewportHeight;
      }

      if (viewportHeight > baselineViewportHeightRef.current + 24) {
        baselineViewportHeightRef.current = viewportHeight;
      } else if (!focusedEditable && viewportHeight >= baselineViewportHeightRef.current - 48) {
        baselineViewportHeightRef.current = Math.max(baselineViewportHeightRef.current, viewportHeight);
      }

      const keyboardHeight = Math.max(0, baselineViewportHeightRef.current - viewportHeight);
      const keyboardOpen = isMobileViewport && focusedEditable && keyboardHeight >= thresholdPx;

      setState((current) => {
        if (
          current.isMobileViewport === isMobileViewport &&
          current.keyboardOpen === keyboardOpen &&
          current.keyboardHeight === keyboardHeight &&
          current.viewportHeight === viewportHeight &&
          current.focusedEditable === focusedEditable &&
          current.focusedNavSearchInput === focusedNavSearchInput
        ) {
          return current;
        }

        return {
          isMobileViewport,
          keyboardOpen,
          keyboardHeight,
          viewportHeight,
          focusedEditable,
          focusedNavSearchInput,
        };
      });
    };

    const scheduleMeasure = () => {
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = null;
        measure();
      });
    };

    const handleOrientationChange = () => {
      baselineViewportHeightRef.current = readViewportHeight();
      scheduleMeasure();
    };

    baselineViewportHeightRef.current = readViewportHeight();
    measure();

    window.addEventListener("focusin", scheduleMeasure, true);
    window.addEventListener("focusout", scheduleMeasure, true);
    window.addEventListener("resize", scheduleMeasure);
    window.addEventListener("orientationchange", handleOrientationChange);
    viewport?.addEventListener("resize", scheduleMeasure);
    viewport?.addEventListener("scroll", scheduleMeasure);

    return () => {
      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
        frameRef.current = null;
      }
      window.removeEventListener("focusin", scheduleMeasure, true);
      window.removeEventListener("focusout", scheduleMeasure, true);
      window.removeEventListener("resize", scheduleMeasure);
      window.removeEventListener("orientationchange", handleOrientationChange);
      viewport?.removeEventListener("resize", scheduleMeasure);
      viewport?.removeEventListener("scroll", scheduleMeasure);
    };
  }, [thresholdPx]);

  return state;
}
