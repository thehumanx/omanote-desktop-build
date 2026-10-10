import { useCallback, useEffect, useRef } from "react";
import { useConvex, useQuery } from "convex/react";
import type { FunctionArgs, FunctionReference } from "convex/server";
import { api } from "../../convex/_generated/api";
import { SYNC_ON_VISIBLE_AFTER_MS, SYNC_POLL_TICK_MS, shouldPollSync } from "./app-provider-logic";
import { runIncrementalSync, tablesBehind, type SyncQueryFn, type SyncTableName } from "./sync";

/**
 * Keeps the local Dexie mirror in step with Convex.
 *
 * Syncs once after unlock; on a background poll (5 min while active, 15 min
 * while idle or hidden, at once when the tab comes back); for the tables whose
 * newest row moved past this device's cursor (`latestRemoteSyncTimestamps`);
 * and on demand through the
 * returned `scheduleSync`, which a mutation calls to pull its own result in.
 *
 * Moved out of AppProvider as-is.
 */
export function useSyncLoop({
  isAuthenticated,
  isLocked,
  includeRss,
}: {
  isAuthenticated: boolean;
  isLocked: boolean;
  includeRss: boolean;
}): { scheduleSync: (tables?: readonly SyncTableName[]) => void } {
  const convexClient = useConvex();
  // Incremental sync — runs once after unlock then every 5 minutes.
  // The queryFn wraps ConvexReactClient.watchQuery() in a one-shot Promise so
  // the sync worker can call Convex queries outside React without a new client.
  const syncQueryFnRef = useRef<SyncQueryFn | null>(null);
  useEffect(() => {
    syncQueryFnRef.current = <Q extends FunctionReference<"query">>(fn: Q, args: FunctionArgs<Q>) =>
      new Promise((resolve, reject) => {
        const watch = convexClient.watchQuery(fn as FunctionReference<"query">, args);
        const unsubscribe = watch.onUpdate(() => {
          try {
            const result = watch.localQueryResult();
            if (result !== undefined) {
              unsubscribe();
              resolve(result as Awaited<Q["_returnType"]>);
            }
          } catch (e) {
            unsubscribe();
            reject(e);
          }
        });
      });
  }, [convexClient]);

  const syncRunningRef = useRef(false);
  const syncTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sawFirstTimestampsRef = useRef(false);
  const latestRemoteSyncTimestamps = useQuery(
    api.canvas.latestRemoteSyncTimestamps,
    isAuthenticated && !isLocked ? {} : "skip",
  );

  // A sync asked for while one is running: run it once that one finishes. It
  // used to be dropped, so a write landing mid-sync waited for the next poll.
  const rerunRef = useRef<Set<SyncTableName> | "all" | null>(null);
  const doSync = useCallback(async (tables?: readonly SyncTableName[]): Promise<void> => {
    if (syncRunningRef.current) {
      if (tables === undefined || rerunRef.current === "all") rerunRef.current = "all";
      else rerunRef.current = new Set([...(rerunRef.current ?? []), ...tables]);
      return;
    }
    if (!syncQueryFnRef.current) return;
    const fn = syncQueryFnRef.current;
    syncRunningRef.current = true;
    try {
      if ("locks" in navigator) {
        await navigator.locks.request("omanote-sync", { ifAvailable: true }, async (lock) => {
          if (!lock) return; // another tab is syncing
          await runIncrementalSync(fn, { includeRss: includeRss, tables });
        });
      } else {
        await runIncrementalSync(fn, { includeRss: includeRss, tables });
      }
    } finally {
      syncRunningRef.current = false;
    }
    const rerun = rerunRef.current;
    rerunRef.current = null;
    if (rerun) await doSync(rerun === "all" ? undefined : [...rerun]);
  }, [includeRss]);

  // Call after a mutation to pull its result into Dexie within ~300ms. Pass
  // the table(s) that mutation touched to skip re-querying the other tables;
  // omit it (e.g. for the interval poller or a cross-tab/device staleness
  // signal, which can't tell what changed) to sync everything. Calls within
  // the same debounce window accumulate their table sets rather than the
  // last caller winning, so two different mutations scheduled back-to-back
  // both get synced.
  const pendingSyncTablesRef = useRef<Set<SyncTableName> | "all" | null>(null);
  const scheduleSync = useCallback((tables?: readonly SyncTableName[]) => {
    if (pendingSyncTablesRef.current !== "all") {
      if (tables === undefined) {
        pendingSyncTablesRef.current = "all";
      } else {
        const set = pendingSyncTablesRef.current ?? new Set<SyncTableName>();
        for (const t of tables) set.add(t);
        pendingSyncTablesRef.current = set;
      }
    }
    if (syncTimerRef.current) clearTimeout(syncTimerRef.current);
    syncTimerRef.current = setTimeout(() => {
      const pending = pendingSyncTablesRef.current;
      pendingSyncTablesRef.current = null;
      void doSync(pending === "all" || pending === null ? undefined : Array.from(pending));
    }, 300);
  }, [doSync]);

  // Another device's write (or this one's) moved a table's newest timestamp:
  // pull only the tables this device is behind on. The first result arrives
  // with the full sync that runs on unlock, so it's skipped.
  useEffect(() => {
    if (!isAuthenticated || isLocked || latestRemoteSyncTimestamps === undefined) return;
    if (!sawFirstTimestampsRef.current) {
      sawFirstTimestampsRef.current = true;
      return;
    }
    let cancelled = false;
    void tablesBehind(latestRemoteSyncTimestamps).then((tables) => {
      if (!cancelled && tables.length) scheduleSync(tables);
    });
    return () => {
      cancelled = true;
    };
  }, [isAuthenticated, isLocked, latestRemoteSyncTimestamps, scheduleSync]);

  // Sync interval: 5 min when actively used, 15 min when idle (>5 min no interaction).
  // Mutations still trigger immediate sync via scheduleSync(), so this only affects
  // background polling frequency.
  useEffect(() => {
    if (!isAuthenticated || isLocked) return;
    void doSync();

    let lastActivity = Date.now();
    const trackActivity = () => { lastActivity = Date.now(); };
    for (const event of ["mousedown", "keydown", "scroll", "touchstart"]) {
      window.addEventListener(event, trackActivity, { passive: true });
    }

    // One fixed tick that decides each time whether to sync. The previous
    // version swapped to a 15-minute interval on the first idle tick and never
    // swapped back, so a tab that sat idle once polled at the slow rate for
    // the rest of its life.
    let lastSync = Date.now();
    const interval = setInterval(() => {
      const now = Date.now();
      if (!shouldPollSync({ now, lastActivity, lastSync, hidden: document.visibilityState === "hidden" })) return;
      lastSync = now;
      void doSync();
    }, SYNC_POLL_TICK_MS);

    // A tab left in the background polls slowly, so catch up when it's back.
    const syncOnVisible = () => {
      if (document.visibilityState !== "visible") return;
      lastActivity = Date.now();
      if (lastActivity - lastSync < SYNC_ON_VISIBLE_AFTER_MS) return;
      lastSync = lastActivity;
      void doSync();
    };
    document.addEventListener("visibilitychange", syncOnVisible);

    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", syncOnVisible);
      for (const event of ["mousedown", "keydown", "scroll", "touchstart"]) {
        window.removeEventListener(event, trackActivity);
      }
    };
  }, [isAuthenticated, isLocked, doSync]);

  return { scheduleSync };
}
