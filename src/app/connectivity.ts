import type { ConnectionState } from "convex/browser";

/**
 * Whether a write can be sent now, or must go to the durable outbox.
 *
 * `navigator.onLine` alone isn't enough. It only says a network interface is
 * up, so behind a captive portal, a dead VPN or broken DNS — and in the Tauri
 * webview, which reports online on a dead connection (docs/architecture.md,
 * "Detecting offline") — it stays true while the Convex socket is down. A
 * mutation issued then doesn't fail: it waits in the Convex client's in-memory
 * queue, and closing the app drops it with no trace. So a socket that is down
 * after having connected (or after failed attempts) counts as offline too.
 *
 * A socket that simply hasn't finished its first connect yet doesn't: that
 * would send every write made in the first second of a session through the
 * outbox for no reason.
 */

type ConnectionSource = { connectionState(): ConnectionState };

let source: ConnectionSource | null = null;

/** AppProvider registers the live Convex client; tests register a fake. */
export function registerConvexConnection(client: ConnectionSource | null): void {
  source = client && typeof client.connectionState === "function" ? client : null;
}

function readConnectionState(): ConnectionState | null {
  try {
    return source?.connectionState() ?? null;
  } catch {
    return null;
  }
}

/** True when the Convex socket is known to be down, whatever the browser says. */
export function isConvexDisconnected(state: ConnectionState | null = readConnectionState()): boolean {
  if (!state) return false;
  return !state.isWebSocketConnected && (state.hasEverConnected || state.connectionRetries > 0);
}

export function isEffectivelyOffline(): boolean {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return true;
  return isConvexDisconnected();
}

/** Mutations sent but not yet acknowledged; lost if the app closes now. */
export function hasUnacknowledgedWrites(): boolean {
  const state = readConnectionState();
  return Boolean(state && state.inflightMutations > 0);
}
