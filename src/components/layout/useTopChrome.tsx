import { useLayoutEffect, type ReactNode } from "react";
import { useOutletContext } from "react-router-dom";

type TopChromeContextValue = {
  setTopChrome: (node: ReactNode | null) => void;
};

export function useTopChrome(node: ReactNode | null) {
  const outletContext = useOutletContext<TopChromeContextValue | null>();
  const setTopChrome = outletContext?.setTopChrome;

  useLayoutEffect(() => {
    if (!setTopChrome) return;
    setTopChrome(node);
    return () => setTopChrome(null);
  }, [node, setTopChrome]);
}
