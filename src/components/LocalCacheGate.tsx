import { Fragment, useEffect, useState, type ReactNode } from "react";
import { closeRetiredDbs, DEXIE_CACHE_OWNER_KEY, migrateLegacyCache, selectUserDb } from "../app/db";
import {
  readLocalStorageOptional,
  setStorageUserScope,
  stringCodec,
  writeLocalStorage,
} from "../lib/local-storage";
import { useAuth } from "../app/auth/AuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { AppLoadingScreen } from "./ui";

/** Set once this browser's shared pre-2026-09 cache has been moved (see `migrateLegacyCache`). */
export const LEGACY_CACHE_MIGRATED_KEY = "omanote.dexie-namespaced";

/**
 * Opens the signed-in account's own Dexie database before anything is allowed
 * to read the cache.
 *
 * Each account has its own database (`db.ts` `userDbName`), so another
 * account's rows are never reachable from the open handle. That replaced the
 * earlier design, one database shared by every account on the browser, where
 * this gate had to clear the tables on a handover before the first read — and
 * got the ordering wrong more than once (docs/hardening-audit.md §8.1–8.3,
 * docs/code-quality-audit-2026-09.md §S2).
 *
 * What's left for the gate:
 * - Fail closed while Clerk is still resolving. `user === null` is also what
 *   Clerk reports while loading, and `AuthenticatedAppLayout` mounts off
 *   `useConvexAuth()`, which resolves first.
 * - Point `db` (and the user-scoped localStorage keys) at the right account
 *   during render, so the same-user path paints on the first pass.
 * - Remount the whole tree when the account changes, so no live query keeps
 *   reading the previous account's instance.
 * - Run the one-time copy out of the old shared database.
 */
export function LocalCacheGate({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useAuth();
  const { isOffline } = useNetworkStatus();
  const owner = readLocalStorageOptional(DEXIE_CACHE_OWNER_KEY, stringCodec);
  // The marker as it was before this session wrote it: the migration needs to
  // know who owned the old shared database, not who just signed in.
  const [previousOwner] = useState(owner);

  // Offline, Clerk can't verify a session, so `isLoaded` may never flip. That
  // must not brick the app for a device that has already signed in — `RootRoute`
  // renders this subtree on exactly the same signal (an owner marker while
  // offline), so the marker names the account to open. A second user cannot
  // have signed in without a network, so it still names the right one.
  // `readLocalStorageOptional` yields `undefined`, not `null`, when absent.
  const offlineLocalSession = isOffline && owner !== undefined;
  const accountId = user?.id ?? (offlineLocalSession ? owner : null);

  // Fail closed on "we don't know who this is yet": treating an unresolved
  // session as signed-out is what once let the previous user's rows paint for
  // a frame during a sign-out → sign-in swap.
  const resolved = accountId !== null || isLoaded;

  // Both set during render rather than in an effect: an effect runs after the
  // children have mounted and read.
  setStorageUserScope(accountId);
  const dbName = selectUserDb(resolved ? accountId : null).name;

  const [migrated, setMigrated] = useState(
    () => readLocalStorageOptional(LEGACY_CACHE_MIGRATED_KEY, stringCodec) !== undefined,
  );

  useEffect(() => {
    if (migrated || accountId === null) return;
    let cancelled = false;
    void withTimeout(migrateLegacyCache(accountId, previousOwner), MIGRATION_TIMEOUT_MS)
      .then(
        () => writeLocalStorage(LEGACY_CACHE_MIGRATED_KEY, stringCodec, "1"),
        // Old database left in place (or another tab still holds it open):
        // open the app on what's synced and retry on the next load.
        () => undefined,
      )
      .finally(() => {
        if (!cancelled) setMigrated(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accountId, migrated, previousOwner]);

  useEffect(() => {
    if (user?.id) writeLocalStorage(DEXIE_CACHE_OWNER_KEY, stringCodec, user.id);
  }, [user?.id]);

  const isOpen = resolved && (accountId === null || migrated);

  // After the commit that unmounted whatever read the previous instance.
  useEffect(() => {
    void closeRetiredDbs();
  }, [dbName, isOpen]);

  if (!isOpen) {
    return <AppLoadingScreen />;
  }

  // Keyed on the database so an account switch remounts everything below:
  // a live query subscribed to the previous instance would otherwise keep
  // showing its rows.
  return <Fragment key={dbName}>{children}</Fragment>;
}

/** A delete blocked by another tab can wait indefinitely; the gate can't. */
const MIGRATION_TIMEOUT_MS = 5000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error("timed out")), ms);
    promise.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}
