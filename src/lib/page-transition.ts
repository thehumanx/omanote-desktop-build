import { flushSync } from "react-dom";

/** Shared with ComposerSheet and PageScreen's sheet — see index.css. */
export const PAGE_TRANSITION_NAME = "canvas-expand";

type ViewTransitionDocument = Document & {
  startViewTransition?: (update: () => void) => { finished: Promise<void> };
};

/**
 * Opens or closes a page with a View Transition. `from` is the card that was
 * clicked: it shares the page sheet's transition name for the duration, so the
 * card grows into the page. `toCardOf` is the page being closed: once the
 * canvas has rendered, its card takes the name, so the page shrinks back into
 * it. With neither (or the card not on screen), the sheet scales in or out on
 * its own (index.css). Without the API — or under reduced motion, where the
 * CSS drops the animation — it is a plain navigation.
 *
 * flushSync makes React commit inside the callback; otherwise the browser
 * would snapshot "after" before the route had changed.
 */
export function runPageTransition(update: () => void, { from, toCardOf }: { from?: HTMLElement | null; toCardOf?: string } = {}) {
  const doc = document as ViewTransitionDocument;
  if (typeof doc.startViewTransition !== "function") {
    update();
    return;
  }
  const named: HTMLElement[] = [];
  const name = (element: HTMLElement | null | undefined) => {
    if (!element) return;
    element.style.viewTransitionName = PAGE_TRANSITION_NAME;
    named.push(element);
  };
  name(from);
  const transition = doc.startViewTransition(() => {
    flushSync(update);
    // Only one element may hold the name, so the first card for the page wins
    // (it can show twice: in Continue writing and in the day's list).
    if (toCardOf) name(document.querySelector<HTMLElement>(`[data-page-card-id="${CSS.escape(toCardOf)}"]`));
  });
  void transition.finished
    .catch(() => {})
    .finally(() => {
      for (const element of named) element.style.viewTransitionName = "";
    });
}
