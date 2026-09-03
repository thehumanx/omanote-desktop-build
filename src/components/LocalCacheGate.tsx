import { useEffect, useState, type ReactNode } from "react";
import { clearLocalCache, DEXIE_CACHE_OWNER_KEY } from "../app/db";
import { readLocalStorageOptional, stringCodec, writeLocalStorage } from "../lib/local-storage";
import { useAuth } from "../app/auth/AuthContext";

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
 */
export function LocalCacheGate({ children }: { children: ReactNode }) {
  const { user } = useAuth();
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
  const owner = userId ? readLocalStorageOptional(DEXIE_CACHE_OWNER_KEY, stringCodec) : null;
  const awaitingClear = userId !== null && owner !== userId && clearedFor !== userId;

  if (awaitingClear) {
    return <div className="min-h-screen bg-app-canvas" aria-busy="true" />;
  }

  return <>{children}</>;
}
