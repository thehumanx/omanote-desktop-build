import { useLayoutEffect, type ReactNode } from "react";
import { useOutletContext } from "react-router-dom";

type TopChromeContextValue = {
  setTopChrome: (node: ReactNode | null) => void;
};

/**
 * `enabled: false` leaves the bar alone entirely — for a screen mounted as an
 * overlay on another route (a folder sheet over the canvas), which must not
 * replace or clear that route's bar.
 */
export function useTopChrome(node: ReactNode | null, enabled = true) {
  const outletContext = useOutletContext<TopChromeContextValue | null>();
  const setTopChrome = enabled ? outletContext?.setTopChrome : undefined;

  useLayoutEffect(() => {
    if (!setTopChrome) return;
    setTopChrome(node);
    return () => setTopChrome(null);
  }, [node, setTopChrome]);
}
