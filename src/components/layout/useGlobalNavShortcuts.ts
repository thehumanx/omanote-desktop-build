import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { navRoutePaths } from "./navRoutes";
import { FOCUS_SEARCH_EVENT } from "../ExpandableSearch";
import { isEditableTarget } from "../../lib/editable-target";

/**
 * Cmd/Ctrl+1..5 jumps straight to Canvas/Todos/Notes/Bookmarks/Events.
 * Cmd/Ctrl+/ focuses the current page's in-page search bar (the top-left
 * search icon on Todos/Notes/Bookmarks/Events) — a no-op on Canvas and any
 * other page that doesn't have one, since nothing is listening there.
 */
export function useGlobalNavShortcuts() {
  const navigate = useNavigate();

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey) || event.altKey) return;
      if (isEditableTarget(event.target)) return;

      const digitIndex = ["1", "2", "3", "4", "5"].indexOf(event.key);
      if (digitIndex !== -1) {
        event.preventDefault();
        navigate(navRoutePaths[digitIndex]!);
        return;
      }

      if (event.key === "/") {
        event.preventDefault();
        window.dispatchEvent(new Event(FOCUS_SEARCH_EVENT));
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [navigate]);
}
