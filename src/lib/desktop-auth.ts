/**
 * Desktop sign-in handoff.
 *
 * The desktop app never runs OAuth in its webview. Instead it opens the
 * production website's /auth/desktop page in the system browser; that page
 * (signed in via Clerk as usual) asks Convex to mint a single-use Clerk
 * sign-in token and redirects to an omanote:// deep link. Back in the app,
 * the token is exchanged for a real Clerk session via the "ticket" strategy.
 */

import { openInSystemBrowser } from "./desktop";

export const PROD_WEB_URL = "https://omanote.com";

const STATE_KEY = "omanote:desktop-auth-state";

/** Website origin to send the user to for sign-in. In dev the Vite server
 * is both the app and the website, so the browser flow stays on dev too. */
export function desktopAuthWebOrigin(): string {
  return import.meta.env.DEV ? window.location.origin : PROD_WEB_URL;
}

function randomState(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
}

/** Opens the system browser at the sign-in handoff page and remembers the
 * state nonce so the deep-link callback can be validated. */
export async function startDesktopSignIn(): Promise<void> {
  const state = randomState();
  try {
    window.localStorage.setItem(STATE_KEY, state);
  } catch {
    // Private mode — the callback will be accepted without state matching.
  }
  const url = `${desktopAuthWebOrigin()}/auth/desktop?state=${state}`;
  await openInSystemBrowser(url);
}

export type DesktopAuthCallback = { token: string };

/**
 * Parses an omanote:// deep link. Returns the sign-in token when the URL is
 * a valid auth callback whose state matches the one we generated, else null.
 */
export function parseDesktopAuthCallback(url: string): DesktopAuthCallback | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return null;
  }
  if (parsed.protocol !== "omanote:") return null;
  // omanote://auth/callback?token=...&state=...  (host is "auth")
  if (parsed.host !== "auth") return null;
  const token = parsed.searchParams.get("token");
  if (!token) return null;

  let expectedState: string | null = null;
  try {
    expectedState = window.localStorage.getItem(STATE_KEY);
    window.localStorage.removeItem(STATE_KEY);
  } catch {
    expectedState = null;
  }
  const state = parsed.searchParams.get("state");
  if (expectedState && state !== expectedState) return null;
  return { token };
}

/** Builds the deep link the website redirects to after minting a token. */
export function desktopAuthDeepLink(token: string, state: string | null): string {
  const params = new URLSearchParams({ token });
  if (state) params.set("state", state);
  return `omanote://auth/callback?${params.toString()}`;
}
