import { useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { prefixedRandomId } from "@omanote/shared";
import { useApp } from "../app/AppProvider";
import { emptyPageDoc, isPageDocEmpty } from "./page-doc";
import { runPageTransition } from "./page-transition";

/**
 * Creates an empty canvas and opens it.
 *
 * The clientKey is generated here rather than inside the dispatch handler
 * because the caller has to navigate to the new canvas *immediately* — before
 * any server round-trip — and the clientKey is the only id that exists at that
 * moment. PageScreen resolves a route param against both id and clientKey, so
 * the URL stays valid when the real id lands (see AppProvider's
 * optimisticPages).
 */
export function useCreateCanvas() {
  const { state, dispatch } = useApp();
  const navigate = useNavigate();

  return useCallback(() => {
    // Reuse the existing blank page rather than piling up another one —
    // "Create new page" clicked twice in a row with nothing typed in between
    // should land on the same untitled page, not two of them.
    const existingEmpty = state.pages.find(
      (candidate) => !candidate.deletedAt && !candidate.icon && isPageDocEmpty(candidate.docJson, candidate.title),
    );
    if (existingEmpty) {
      const target = existingEmpty.id;
      runPageTransition(() => navigate(`/p/${target}`));
      return;
    }

    const clientKey = prefixedRandomId("page");
    const createAndNavigate = () => {
      dispatch({
        type: "page/create",
        clientKey,
        dateKey: state.ui.selectedDateKey,
        docJson: emptyPageDoc(),
        preview: "",
      });
      navigate(`/p/${clientKey}`);
    };

    // Morphs the composer sheet into the full canvas page instead of a hard
    // cut — ComposerSheet's section and PageScreen's root share a
    // view-transition-name (see index.css). flushSync forces the navigation's
    // DOM mutation to land inside the transition callback; without it React
    // would batch the update past the point the browser snapshots "after".
    runPageTransition(createAndNavigate);
  }, [dispatch, navigate, state.pages, state.ui.selectedDateKey]);
}
