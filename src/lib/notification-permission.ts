export const NOTIFICATION_BANNER_DISMISSED_KEY = "omanote:notification-permission-dismissed";

function getStorage() {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export function isNotificationBannerDismissed() {
  const storage = getStorage();
  if (!storage) return false;
  return storage.getItem(NOTIFICATION_BANNER_DISMISSED_KEY) === "true";
}

export function setNotificationBannerDismissed(value: boolean) {
  const storage = getStorage();
  if (!storage) return;
  if (value) {
    storage.setItem(NOTIFICATION_BANNER_DISMISSED_KEY, "true");
    return;
  }
  storage.removeItem(NOTIFICATION_BANNER_DISMISSED_KEY);
}
