/**
 * Desktop-local notification preference. The desktop app asks the OS for its
 * own notification permission and keeps its own on/off switch instead of
 * inheriting the web app's browser-notification setting.
 */

export const DESKTOP_NOTIFICATIONS_ENABLED_KEY = "omanote:desktop-notifications-enabled";

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function desktopNotificationsEnabled(): boolean {
  const stored = getStorage()?.getItem(DESKTOP_NOTIFICATIONS_ENABLED_KEY);
  // Default on — the OS permission prompt is the real gate.
  return stored !== "false";
}

export function setDesktopNotificationsEnabled(value: boolean) {
  getStorage()?.setItem(DESKTOP_NOTIFICATIONS_ENABLED_KEY, value ? "true" : "false");
}
