/**
 * Loads the screens a signed-in user is likely to open next, once the browser
 * is idle after the app has painted.
 *
 * Every screen is its own lazy chunk, so the first visit to a tab used to
 * blank the page — the old screen unmounts, the header clears, an empty
 * Suspense fallback shows — until the chunk arrived. The canvas folder tabs
 * did nothing at all on a first tap (their fallback is null), and opening a
 * canvas page lost its morph. Each `import()` here is the same specifier the
 * route uses, so the browser fetches the chunk once and the route then finds
 * it ready.
 */
const LIKELY_NEXT_SCREENS: Array<() => Promise<unknown>> = [
  () => import("../screens/TodosScreen"),
  () => import("../screens/NotesScreen"),
  () => import("../screens/BookmarksScreen"),
  () => import("../screens/EventScreen"),
  () => import("../screens/PageScreen"),
];

type IdleWindow = Window & {
  requestIdleCallback?: (callback: () => void, options?: { timeout: number }) => number;
  cancelIdleCallback?: (handle: number) => void;
};

/** Returns a cancel function. */
export function prefetchLikelyRoutes(loaders = LIKELY_NEXT_SCREENS): () => void {
  const w = window as IdleWindow;
  const run = () => {
    for (const load of loaders) {
      // A failed prefetch only means the route loads on demand, as before.
      load().catch(() => {});
    }
  };
  if (w.requestIdleCallback) {
    const handle = w.requestIdleCallback(run, { timeout: 4000 });
    return () => w.cancelIdleCallback?.(handle);
  }
  const timer = setTimeout(run, 1500);
  return () => clearTimeout(timer);
}
