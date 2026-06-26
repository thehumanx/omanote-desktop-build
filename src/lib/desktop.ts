/**
 * Helpers for running inside the Tauri desktop shell.
 *
 * Inside Tauri the notification plugin injects a `window.Notification`
 * shim that routes to native OS notifications, so most web Notification
 * code works unchanged. Service workers and Web Push are unavailable
 * under the tauri:// origin, so those paths must be skipped.
 */

export function isTauri(): boolean {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

export type DesktopPlatform = "macos" | "windows" | "linux";

/** OS the desktop shell runs on, or null outside Tauri. */
export function desktopPlatform(): DesktopPlatform | null {
  if (!isTauri()) return null;
  const ua = navigator.userAgent;
  if (/Mac/i.test(ua)) return "macos";
  if (/Win/i.test(ua)) return "windows";
  return "linux";
}

/** Open a URL in the user's default system browser. */
export async function openInSystemBrowser(url: string): Promise<void> {
  const { invoke } = await import("@tauri-apps/api/core");
  await invoke("plugin:opener|open_url", { url });
}

export type DesktopNotificationPermission = "granted" | "denied" | "default";

/**
 * Native (OS-level) notification permission for the desktop app itself —
 * independent of the web app's Notification API state.
 */
export async function getDesktopNotificationPermission(): Promise<DesktopNotificationPermission> {
  if (!isTauri()) return "default";
  try {
    const { isPermissionGranted } = await import("@tauri-apps/plugin-notification");
    return (await isPermissionGranted()) ? "granted" : "default";
  } catch {
    return "default";
  }
}

export async function requestDesktopNotificationPermission(): Promise<DesktopNotificationPermission> {
  if (!isTauri()) return "default";
  try {
    const { isPermissionGranted, requestPermission } = await import(
      "@tauri-apps/plugin-notification"
    );
    if (await isPermissionGranted()) return "granted";
    return await requestPermission();
  } catch {
    return "default";
  }
}

/**
 * Version of the installed desktop shell (from tauri.conf.json), or null when
 * not running inside Tauri or the shell predates the required capability.
 */
export async function getDesktopAppVersion(): Promise<string | null> {
  if (!isTauri()) return null;
  try {
    const { getVersion } = await import("@tauri-apps/api/app");
    return await getVersion();
  } catch {
    return null;
  }
}

export async function sendDesktopNotification(options: { title: string; body?: string }): Promise<void> {
  const { isPermissionGranted, requestPermission, sendNotification } = await import(
    "@tauri-apps/plugin-notification"
  );
  let granted = await isPermissionGranted();
  if (!granted) {
    granted = (await requestPermission()) === "granted";
  }
  if (granted) {
    sendNotification({ title: options.title, body: options.body });
  }
}

/**
 * The Tauri webview ignores target="_blank" links, so route external
 * http(s) links to the system browser instead.
 */
export function installExternalLinkHandler(): void {
  if (!isTauri()) return;
  document.addEventListener("click", (event) => {
    const anchor = (event.target as HTMLElement | null)?.closest?.("a[href]");
    if (!(anchor instanceof HTMLAnchorElement)) return;
    const url = anchor.href;
    if (!/^https?:/i.test(url)) return;
    if (new URL(url).origin === window.location.origin) return;
    event.preventDefault();
    void import("@tauri-apps/api/core").then(({ invoke }) =>
      invoke("plugin:opener|open_url", { url }),
    );
  }, true);
}
