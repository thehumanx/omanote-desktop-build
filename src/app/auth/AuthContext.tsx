import React, { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { useAuth as useClerkAuth, useUser } from "@clerk/react";
import { clearLocalCache, db, DEXIE_CACHE_OWNER_KEY } from "../db";
import { SignOutConfirmModal } from "../../components/SignOutConfirmModal";

interface AuthContextValue {
  user: {
    id: string;
    name: string;
    email: string;
    imageUrl: string | null;
    provider: "clerk";
  } | null;
  /**
   * False while Clerk is still resolving the session.
   *
   * Load-bearing for `LocalCacheGate`: without it, `user === null` conflates
   * "signed out" with "we don't know yet", and the gate opens during the
   * loading window — long enough for the live queries below it to paint the
   * *previous* user's cached rows. `AuthenticatedAppLayout` mounts off
   * `useConvexAuth()`, which resolves independently of (and typically before)
   * Clerk, so that window is reliably hit on a sign-out → sign-in swap.
   */
  isLoaded: boolean;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
  /**
   * Clerk session JWT for services that authenticate outside Convex — today
   * just the RSS proxy worker, which verifies it against Clerk's JWKS.
   *
   * Uses the same "convex" template as the rest of the app so there's one
   * audience to configure. Returns null when signed out.
   */
  getSessionToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * Empties the local cache as part of signing out.
 *
 * Sign-out used to leave everything in place and defer the wipe to whenever a
 * *different* user next signed in. That left the outgoing user's encrypted rows
 * and all their plaintext metadata — hashtags, guest emails, due dates, counts —
 * sitting in IndexedDB indefinitely on a shared or borrowed machine, and made
 * cleanup contingent on an event that might never happen.
 *
 * Clearing here also drops the outbox, which is why unsynced writes are
 * confirmed first: the queue is a Dexie table precisely so it cannot survive
 * into another account (see the v6 migration note in db.ts), so "keep the
 * outbox but clear everything else" is not an option.
 *
 * Returns false if the user declined at the confirmation.
 */
async function clearLocalDataForSignOut(): Promise<void> {
  try {
    await clearLocalCache();
    // Only drop the owner marker once the cache is actually empty. If the clear
    // failed we leave it pointing at the outgoing user, so LocalCacheGate sees
    // a mismatch and re-clears before the next user reads anything.
    window.localStorage.removeItem(DEXIE_CACHE_OWNER_KEY);
  } catch {
    // Fall through and sign out regardless — dropping the session is the more
    // urgent half, and the gate is the backstop for the cache.
  }
}

/** Unsent writes still in the queue, or 0 if the queue can't be read. */
async function countPendingWrites(): Promise<number> {
  try {
    return await db.outbox.count();
  } catch {
    // An unreadable outbox is not a reason to block sign-out.
    return 0;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isSignedIn, signOut, getToken, isLoaded: isAuthLoaded } = useClerkAuth();
  const { user, isLoaded: isUserLoaded } = useUser();

  // Set when a sign-out is paused waiting on the confirmation modal. The
  // resolver is held in a ref so `signOut` can await the user's answer and the
  // modal can stay a plain controlled component.
  const [pendingSignOutCount, setPendingSignOutCount] = useState<number | null>(null);
  const signOutDecisionRef = useRef<((confirmed: boolean) => void) | null>(null);

  const resolveSignOutPrompt = useCallback((confirmed: boolean) => {
    setPendingSignOutCount(null);
    const decide = signOutDecisionRef.current;
    signOutDecisionRef.current = null;
    decide?.(confirmed);
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user: isSignedIn && user
        ? {
            id: user.id,
            name: user.fullName ?? user.username ?? user.primaryEmailAddress?.emailAddress ?? "User",
            email: user.primaryEmailAddress?.emailAddress ?? "",
            imageUrl: user.imageUrl ?? null,
            provider: "clerk" as const,
          }
        : null,
      // Both hooks have to have settled: `isSignedIn` and `user` come from
      // different Clerk hooks and are not guaranteed to resolve on the same
      // tick, and the gate needs "the id is knowable", not "one of them is".
      isLoaded: isAuthLoaded && isUserLoaded,
      signOut: async () => {
        const pending = await countPendingWrites();
        if (pending > 0) {
          const confirmed = await new Promise<boolean>((resolve) => {
            signOutDecisionRef.current = resolve;
            setPendingSignOutCount(pending);
          });
          if (!confirmed) return;
        }
        await clearLocalDataForSignOut();
        await signOut();
      },
      deleteAccount: async () => {
        if (!user) {
          throw new Error("No authenticated user");
        }
        await user.delete();
      },
      getSessionToken: () => getToken({ template: "convex" }),
    }),
    [getToken, isAuthLoaded, isSignedIn, isUserLoaded, signOut, user],
  );

  return (
    <AuthContext.Provider value={value}>
      {children}
      {pendingSignOutCount !== null && (
        <SignOutConfirmModal
          pendingCount={pendingSignOutCount}
          onConfirm={() => resolveSignOutPrompt(true)}
          onCancel={() => resolveSignOutPrompt(false)}
        />
      )}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error("useAuth must be used inside AuthProvider");
  return value;
}
