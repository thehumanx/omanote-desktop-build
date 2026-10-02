import { useMemo, useState, type ReactNode } from "react";
import { Outlet } from "react-router-dom";

/**
 * Stands in for AppShell's top bar in screen tests: renders whatever the
 * screen hands to useTopChrome inside `data-testid="top-bar"`. Use as a
 * layout route: <Route element={<TopChromeHost />}><Route path=… /></Route>.
 */
export function TopChromeHost() {
  const [node, setNode] = useState<ReactNode | null>(null);
  const context = useMemo(() => ({ setTopChrome: setNode }), []);
  return (
    <>
      <div data-testid="top-bar">{node}</div>
      <Outlet context={context} />
    </>
  );
}
