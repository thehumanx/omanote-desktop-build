import { isTauri } from "./desktop";

export type DeviceClientType = "web" | "extension" | "desktop";

const DEVICE_ID_PREFIX = "omanote.deviceId";

function randomId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export const CHROME_EXTENSION_STORE_URL = "https://chromewebstore.google.com/detail/omanote/foafmfgfdbdiiggmmfdoalgpfhkejbjn";
export const FIREFOX_EXTENSION_STORE_URL = "https://addons.mozilla.org/en-US/firefox/addon/omanote/";

export function detectBrowserName(userAgent: string): string {
  if (/Edg\//.test(userAgent)) return "Edge";
  if (/Firefox\//.test(userAgent)) return "Firefox";
  if (/Chrome\//.test(userAgent) && !/Chromium\//.test(userAgent)) return "Chrome";
  if (/Safari\//.test(userAgent) && /Version\//.test(userAgent)) return "Safari";
  return "Browser";
}

export function getExtensionStoreUrl(): string {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  return detectBrowserName(userAgent) === "Firefox" ? FIREFOX_EXTENSION_STORE_URL : CHROME_EXTENSION_STORE_URL;
}

export function detectPlatformName(userAgent: string): string {
  if (/Windows NT/i.test(userAgent)) return "Windows";
  if (/Macintosh|Mac OS X/i.test(userAgent)) return "macOS";
  if (/iPhone|iPad|iPod/i.test(userAgent)) return "iOS";
  if (/Android/i.test(userAgent)) return "Android";
  if (/Linux/i.test(userAgent)) return "Linux";
  return "Unknown platform";
}

export function buildDeviceName({
  clientType,
  browserName,
  platformName,
}: {
  clientType: DeviceClientType;
  browserName: string;
  platformName: string;
}): string {
  const appLabel =
    clientType === "extension"
      ? `${browserName} Extension`
      : clientType === "desktop"
        ? "Desktop app"
        : browserName;
  return `${appLabel} on ${platformName}`;
}

export function getOrCreateDeviceId(
  storage: Pick<Storage, "getItem" | "setItem">,
  clientType: DeviceClientType,
): string {
  const storageKey = `${DEVICE_ID_PREFIX}.${clientType}`;
  const existing = storage.getItem(storageKey);
  if (existing) return existing;
  const next = `${clientType}-${randomId()}`;
  storage.setItem(storageKey, next);
  return next;
}

/** The web app reports as "desktop" when running inside the Tauri shell. */
export function detectWebClientType(): "web" | "desktop" {
  return isTauri() ? "desktop" : "web";
}

export function getCurrentDeviceMetadata(clientType: DeviceClientType) {
  const userAgent = typeof navigator === "undefined" ? "" : navigator.userAgent;
  const browserName = detectBrowserName(userAgent);
  const platformName = detectPlatformName(userAgent);
  const storage = typeof window === "undefined" ? null : window.localStorage;
  // The desktop shell shares the web storage scope so installs that registered
  // before the "desktop" client type existed keep their device id, and the
  // existing record upgrades in place instead of duplicating.
  const storageScope = clientType === "desktop" ? "web" : clientType;

  return {
    deviceId: storage ? getOrCreateDeviceId(storage, storageScope) : `${storageScope}-${randomId()}`,
    clientType,
    deviceName: buildDeviceName({ clientType, browserName, platformName }),
    // The Tauri webview UA only describes the embedded engine, not an app the
    // user would recognize, so skip the browser name on desktop.
    browserName: clientType === "desktop" ? undefined : browserName,
    platformName,
    userAgent: userAgent || undefined,
  };
}
