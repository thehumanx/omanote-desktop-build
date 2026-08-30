import { useEffect, useState } from "react";
import { useConvexConnectionState } from "convex/react";

// Retries with zero successful connections ever — below this we're still in
// the normal "just started, first attempt hasn't landed yet" window.
const UNREACHABLE_RETRY_THRESHOLD = 2;

export function useNetworkStatus() {
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // `navigator.onLine` only reflects whether the OS network interface is up,
  // not whether the internet is actually reachable — in the Tauri webview a
  // dead/DNS-broken connection (e.g. Wi-Fi connected, no internet) reports
  // "online" forever, which left offline fallbacks elsewhere (App.tsx,
  // EncryptionContext) permanently blocked on data that can never arrive.
  // Convex's own retry count is a much stronger signal: repeated failed
  // connection attempts with no successful connection ever established means
  // we're actually offline, regardless of what the OS reports.
  const { hasEverConnected, connectionRetries } = useConvexConnectionState();
  const convexUnreachable = !hasEverConnected && connectionRetries >= UNREACHABLE_RETRY_THRESHOLD;

  const effectiveIsOnline = isOnline && !convexUnreachable;
  return { isOnline: effectiveIsOnline, isOffline: !effectiveIsOnline };
}
