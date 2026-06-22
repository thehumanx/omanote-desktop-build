import { clearAuth, clearStoredContentKey, getAuth, setAuth } from "../shared/storage";
import type { AuthState } from "../shared/types";
import { getAppUrl } from "../shared/config";

const APP_URL = getAppUrl();
const TOKEN_REFRESH_BUFFER_MS = 5 * 60 * 1000;
const AUTH_REFRESH_TIMEOUT_MS = 20_000;
const AUTH_BRIDGE_INJECTION_LISTENER_TIMEOUT_MS = 30_000;

export async function openAuthTab(options: {
  mode?: "connect" | "refresh";
  active?: boolean;
} = {}): Promise<chrome.tabs.Tab> {
  const url = `${APP_URL}/auth/extension${options.mode === "refresh" ? "?mode=refresh" : ""}`;
  const tab = await chrome.tabs.create({ url, active: options.active ?? true });
  if (tab.id !== undefined) ensureBridgeInjected(tab.id, url);
  return tab;
}

/**
 * Belt-and-braces: also inject the auth-bridge programmatically once the
 * auth tab finishes loading. The static content_scripts entry should handle
 * this, but on Firefox it sometimes silently doesn't run (host-permission
 * propagation quirks, install-time race). Programmatic injection guarantees
 * the bridge runs as long as the user has granted host access.
 */
function ensureBridgeInjected(tabId: number, expectedUrl: string): void {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;

  function cleanupListeners() {
    chrome.tabs.onUpdated.removeListener(listener);
    chrome.tabs.onRemoved.removeListener(cleanup);
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  }

  const listener = (
    updatedTabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
  ) => {
    if (updatedTabId !== tabId) return;
    if (changeInfo.status !== "complete") return;
    if (!tab.url || !tab.url.startsWith(expectedUrl)) {
      cleanupListeners();
      return;
    }
    cleanupListeners();
    chrome.scripting.executeScript({
      target: { tabId },
      files: ["content/auth-bridge.js"],
    }).catch((err) => {
      // Already injected (static content_scripts beat us to it) is fine.
      // Anything else means host permission isn't actually granted.
      console.warn("[omanote] auth-bridge injection skipped:", err);
    });
  };
  chrome.tabs.onUpdated.addListener(listener);
  // Safety: clean up the listener if the tab closes before completing.
  const cleanup = (closedTabId: number) => {
    if (closedTabId !== tabId) return;
    cleanupListeners();
  };
  chrome.tabs.onRemoved.addListener(cleanup);
  timeoutId = setTimeout(cleanupListeners, AUTH_BRIDGE_INJECTION_LISTENER_TIMEOUT_MS);
}

export async function handleTokenReceived(
  token: string,
  expiresAt: number,
  user: AuthState["user"],
): Promise<void> {
  await setAuth({ token, expiresAt, user });
  // Update badge to indicate connected state
  await chrome.action.setBadgeText({ text: "" });
}

export async function disconnect(): Promise<void> {
  await clearAuth();
  await clearStoredContentKey();
  await chrome.action.setBadgeText({ text: "" });
}

export async function getAuthState(): Promise<AuthState | null> {
  return getAuth();
}

export async function isTokenExpiringSoon(auth: AuthState): Promise<boolean> {
  return Date.now() > auth.expiresAt - TOKEN_REFRESH_BUFFER_MS;
}

function isUsableRefreshedAuth(auth: AuthState, previousAuth: AuthState): boolean {
  if (Date.now() > auth.expiresAt - TOKEN_REFRESH_BUFFER_MS) return false;
  return auth.token !== previousAuth.token || auth.expiresAt !== previousAuth.expiresAt;
}

export async function refreshAuthToken(previousAuth: AuthState): Promise<AuthState> {
  let refreshTabId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let settled = false;

  return await new Promise<AuthState>((resolve, reject) => {
    function cleanup() {
      chrome.storage.onChanged.removeListener(onStorageChange);
      if (timeoutId !== undefined) clearTimeout(timeoutId);
    }

    function settleWithAuth(auth: AuthState) {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(auth);
    }

    function settleWithError(error: Error) {
      if (settled) return;
      settled = true;
      cleanup();
      if (refreshTabId !== undefined) {
        void chrome.tabs.remove(refreshTabId).catch((err) => {
          console.debug("[omanote] failed to close refresh auth tab:", err);
        });
      }
      reject(error);
    }

    function onStorageChange(
      changes: Record<string, chrome.storage.StorageChange>,
      areaName: string,
    ) {
      if (areaName !== "local") return;
      const nextAuth = changes.omanote_auth?.newValue as AuthState | undefined;
      if (!nextAuth || !isUsableRefreshedAuth(nextAuth, previousAuth)) return;
      settleWithAuth(nextAuth);
    }

    chrome.storage.onChanged.addListener(onStorageChange);
    timeoutId = setTimeout(() => {
      settleWithError(new Error("Your omanote web session needs to be refreshed. Sign in in the opened tab, then try again."));
    }, AUTH_REFRESH_TIMEOUT_MS);

    openAuthTab({ mode: "refresh", active: false })
      .then((tab) => {
        refreshTabId = tab.id;
      })
      .catch((err) => {
        settleWithError(err instanceof Error ? err : new Error("Could not refresh omanote session."));
      });
  });
}
