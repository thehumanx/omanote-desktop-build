import { readLocalStorage, removeLocalStorage, stringCodec, writeLocalStorage } from "./local-storage";

export const NOTIFICATION_BANNER_DISMISSED_KEY = "omanote:notification-permission-dismissed";

export function isNotificationBannerDismissed() {
  return readLocalStorage(NOTIFICATION_BANNER_DISMISSED_KEY, stringCodec, "") === "true";
}

export function setNotificationBannerDismissed(value: boolean) {
  if (value) {
    writeLocalStorage(NOTIFICATION_BANNER_DISMISSED_KEY, stringCodec, "true");
    return;
  }
  // Removed rather than written as "false" — this banner can be reset back to
  // "not yet dismissed" (e.g. if permission is later revoked), unlike the
  // one-shot dismissible banners elsewhere.
  removeLocalStorage(NOTIFICATION_BANNER_DISMISSED_KEY);
}
