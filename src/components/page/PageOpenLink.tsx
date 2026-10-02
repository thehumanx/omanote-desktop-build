import type { ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import { runPageTransition } from "../../lib/page-transition";

/**
 * The "open this page" link on a page card. A plain click grows the card into
 * the page (runPageTransition, from the nearest [data-page-card-id]); a
 * modified or middle click stays a normal link so new-tab still works.
 */
export function PageOpenLink({ to, className, children }: { to: string; className?: string; children: ReactNode }) {
  const navigate = useNavigate();
  return (
    <Link
      to={to}
      className={className}
      onClick={(event) => {
        if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        runPageTransition(() => navigate(to), { from: event.currentTarget.closest<HTMLElement>("[data-page-card-id]") });
      }}
    >
      {children}
    </Link>
  );
}
