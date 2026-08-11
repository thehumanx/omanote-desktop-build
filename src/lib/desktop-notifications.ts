/**
 * Desktop-local notification preference. The desktop app asks the OS for its
 * own notification permission and keeps its own on/off switch instead of
 * inheriting the web app's browser-notification setting.
 */

import { readLocalStorage, stringCodec, writeLocalStorage } from "./local-storage";

export const DESKTOP_NOTIFICATIONS_ENABLED_KEY = "omanote:desktop-notifications-enabled";

export function desktopNotificationsEnabled(): boolean {
  // Default on — the OS permission prompt is the real gate. Anything other
  // than the literal stored string "false" (absent key, a stale/garbage
  // value, or a storage read failure) is treated as enabled.
  return readLocalStorage(DESKTOP_NOTIFICATIONS_ENABLED_KEY, stringCodec, "true") !== "false";
}

export function setDesktopNotificationsEnabled(value: boolean) {
  writeLocalStorage(DESKTOP_NOTIFICATIONS_ENABLED_KEY, stringCodec, value ? "true" : "false");
}
