import { useEffect, useState, type ReactNode } from "react";
import { clearLocalCache, DEXIE_CACHE_OWNER_KEY } from "../app/db";
import { readLocalStorageOptional, stringCodec, writeLocalStorage } from "../lib/local-storage";
import { useAuth } from "../app/auth/AuthContext";
import { useNetworkStatus } from "../hooks/useNetworkStatus";

/**
 * Makes sure the Dexie cache in this browser belongs to the signed-in user
 * before anything is allowed to read it.
 *
 * The cache is a single IndexedDB database shared by every account that signs
 * in on this browser, and the read paths do not filter by `userId` — Dexie
 * queries like `db.todos.filter(t => !t.deletedAt)` return whatever is stored.
 * So "the cache belongs to this user" is an invariant that has to hold *before*
 * the first read, not something the reads defend themselves against.
 *
 * This used to live as an effect inside `AppProvider`, next to the `useLiveQuery`
 * calls it was meant to protect, where it got all three parts wrong: it cleared
 * eight of fourteen tables, it skipped clearing entirely when the owner marker
 * was absent, and it fired the clear without awaiting it while the live queries
 * one scope below were already subscribed — under a comment promising the old
 * data was "never visible to the new user (even briefly)". See
 * docs/hardening-audit.md §8.1–8.3.
 *
 * Hoisting it to a gate is what makes the guarantee real: nothing that reads
 * the cache is mounted until the check resolves. `DomainGate` and
 * `EncryptionGate` guard their invariants the same way.
 *
 * The gate then kept one hole for a while longer: it keyed on `user === null`,
 * which is also what Clerk reports *while it is still loading*. Since
 * `AuthenticatedAppLayout` mounts off `useConvexAuth()` — a separate auth
 * source that resolves first — there was a window where the gate was mounted,
 * open, and the cache still belonged to the previous user. It now fails closed
 * on "unresolved" and only treats a confirmed `isLoaded` signed-out state as
 * safe. See docs/code-quality-audit-2026-09.md §S2.
 */
export function LocalCacheGate({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useAuth();
  const { isOffline } = useNetworkStatus();
  const userId = user?.id ?? null;
  const [clearedFor, setClearedFor] = useState<string | null>(null);

  useEffect(() => {
    if (!userId) return;
    const owner = readLocalStorageOptional(DEXIE_CACHE_OWNER_KEY, stringCodec);
    if (owner === userId) return;

    let cancelled = false;
    void (async () => {
      try {
        await clearLocalCache();
      } catch {
        // A failed clear must not be recorded as a successful handover: leaving
        // the marker unwritten means the next mount tries again rather than
        // treating another user's rows as this user's. The gate stays closed
        // and the user sees the fallback below, which is the safe direction to
        // fail in — showing nothing beats showing someone else's notes.
        return;
      }
      if (cancelled) return;
      writeLocalStorage(DEXIE_CACHE_OWNER_KEY, stringCodec, userId);
      setClearedFor(userId);
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  // Read the marker during render rather than tracking it in state so the
  // common path — same user as last time — renders children on the first pass
  // with no blocking frame. `readLocalStorageOptional` is a single synchronous
  // `getItem`, and only a genuine owner mismatch closes the gate.
  const owner = readLocalStorageOptional(DEXIE_CACHE_OWNER_KEY, stringCodec);

  // Offline, Clerk can't verify a session, so `isLoaded` may never flip. That
  // must not brick the app for a device that has already signed in — `RootRoute`
  // renders this subtree on exactly the same signal (an owner marker while
  // offline), so honouring it here keeps the two in agreement. There is no
  // handover risk in this branch: a second user cannot have signed in without a
  // network, so the marker still names whoever owns the rows.
  // `readLocalStorageOptional` yields `undefined`, not `null`, when the marker
  // is absent — comparing against `null` here would make this true on every
  // offline render and reopen the hole this gate exists to close.
  const offlineLocalSession = isOffline && owner !== undefined;

  // The gate must fail *closed* on "we don't know who this is yet". Treating an
  // unresolved session as signed-out is what let the previous user's rows paint
  // for a frame during a sign-out → sign-in swap.
  const isOpen =
    userId === null
      ? isLoaded || offlineLocalSession
      : owner === userId || clearedFor === userId;

  if (!isOpen) {
    return <div className="min-h-screen bg-app-canvas" aria-busy="true" />;
  }

  return <>{children}</>;
}
