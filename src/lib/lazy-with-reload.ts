import { lazy, type ComponentType } from "react";

/**
 * `React.lazy` that recovers from a chunk gone missing after a deploy.
 *
 * Route chunks are content-hashed, so every deploy renames them. A tab that was
 * loaded before a deploy holds the *old* module graph in memory and will ask for
 * the old filenames. Routes it already visited are in memory and keep working —
 * only the first navigation to a not-yet-loaded route fails, which is why the
 * crash looked intermittent and always happened "while navigating".
 *
 * Two things made it land as a full-screen error rather than a blip:
 *
 *   1. `vercel.json`'s SPA rewrite used to catch `/assets/*` too, so a missing
 *      chunk came back as `index.html` with a 200 — the browser got HTML where
 *      it asked for a module, and the import rejected with a MIME-type error
 *      instead of a clean 404. That rewrite now excludes `assets/`.
 *   2. Nothing retried, and the only error boundary was at the root.
 *
 * Reloading is the correct recovery: the tab is running a bundle whose assets
 * no longer exist, and a reload fetches the current `index.html` and with it the
 * current chunk names.
 *
 * The `sessionStorage` latch is what keeps that safe. Without it, a chunk that
 * is genuinely missing (a bad deploy, an offline cache miss) turns into an
 * infinite reload loop — strictly worse than the error screen, because the user
 * can't even read the message. One reload is attempted; if the very next import
 * fails too, the error propagates to the boundary as before.
 */
const RELOAD_LATCH_KEY = "omanote.chunk-reload";

function readLatch(): boolean {
  try {
    return window.sessionStorage.getItem(RELOAD_LATCH_KEY) === "1";
  } catch {
    // Private browsing or a blocked storage partition: treat as "already tried"
    // so a storage failure can never produce a reload loop.
    return true;
  }
}

function setLatch(value: boolean) {
  try {
    if (value) window.sessionStorage.setItem(RELOAD_LATCH_KEY, "1");
    else window.sessionStorage.removeItem(RELOAD_LATCH_KEY);
  } catch {
    // Nothing to do — readLatch() fails closed.
  }
}

// `any` mirrors React's own `lazy` signature — narrowing it to `never` or
// `unknown` makes the returned component reject every concrete props type.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function lazyWithReload<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
) {
  return lazy(async () => {
    try {
      const module = await factory();
      // Clear only after a success, so the latch survives the reload itself and
      // is lifted once the new bundle is demonstrably serving chunks.
      setLatch(false);
      return module;
    } catch (error) {
      if (readLatch()) throw error;
      setLatch(true);
      window.location.reload();
      // Never settles: the reload is already in flight and resolving here would
      // let React render against a module we don't have.
      return new Promise<never>(() => {});
    }
  });
}
