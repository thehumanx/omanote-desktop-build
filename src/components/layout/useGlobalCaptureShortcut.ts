import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import { useApp } from "../../app/AppProvider";
import { getComposerModeForPathname } from "./navRoutes";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || target.isContentEditable;
}

/** Press "/" anywhere in the app to jump straight into the quick-capture composer, mode-matched to the current tab. */
export function useGlobalCaptureShortcut() {
  const { state, dispatch } = useApp();
  const location = useLocation();
  const composerOpen = state.ui.composerOpen;

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "/") return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (composerOpen) return;
      if (isEditableTarget(event.target)) return;

      event.preventDefault();
      dispatch({ type: "ui/open-composer", mode: getComposerModeForPathname(location.pathname) });
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [composerOpen, dispatch, location.pathname]);
}
