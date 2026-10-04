import { useEffect } from "react";
import { useAuth as useClerkAuth } from "@clerk/react";
import { useConvexConnectionState } from "convex/react";
import { useNetworkStatus } from "../hooks/useNetworkStatus";
import { retainOnlySessionContentKey } from "../lib/crypto";
import { reportError } from "../lib/error-reporting";

/**
 * Removes cached content keys for accounts that no longer have a session in
 * this browser — an expired session, one revoked from another device, or a
 * previous account on a shared machine. See `retainOnlySessionContentKey`.
 *
 * Waits for Clerk to settle while the backend is demonstrably reachable:
 * offline, Clerk can't verify a session and the app opens on the owner marker
 * instead (LocalCacheGate), so "signed out" there doesn't mean the session is
 * gone. Sweeping then would only force a passphrase prompt on someone who
 * never signed out. `navigator.onLine` alone isn't proof — it stays true on a
 * Wi-Fi link with no internet — so a Convex connection must have succeeded.
 *
 * Only the key goes. The account's local database stays, because it can hold
 * writes queued offline that the same user signing back in still needs; it's
 * ciphertext, unreadable without the key.
 */
export function StaleSessionKeySweeper() {
  const { isLoaded, isSignedIn, userId } = useClerkAuth();
  const { isOffline } = useNetworkStatus();
  const { hasEverConnected } = useConvexConnectionState();
  const keep = isSignedIn && userId ? `clerk:${userId}` : null;

  useEffect(() => {
    if (!isLoaded || isOffline || !hasEverConnected) return;
    retainOnlySessionContentKey(keep).catch((error) => reportError(error, "encryption/sweep-session-keys"));
  }, [isLoaded, isOffline, hasEverConnected, keep]);

  return null;
}
