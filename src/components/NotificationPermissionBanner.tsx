import { useEffect, useState } from "react";
import { useMutation } from "convex/react";
import { Bell, X } from "lucide-react";
import { api } from "../../convex/_generated/api";
import { Button } from "./ui";
import { useUserSettings } from "../contexts/UserSettingsContext";
import {
  isNotificationBannerDismissed,
  setNotificationBannerDismissed,
} from "../lib/notification-permission";
import { subscribeToPush, extractSubscriptionKeys } from "../lib/push-subscription";
import {
  isTauri,
  getDesktopNotificationPermission,
  requestDesktopNotificationPermission,
} from "../lib/desktop";
import { desktopNotificationsEnabled } from "../lib/desktop-notifications";

export function NotificationPermissionBanner() {
  const { settings } = useUserSettings();
  const inDesktop = isTauri();
  const upsertPushSubscription = useMutation(api.pushSubscriptions.upsertPushSubscription);
  const [permissionState, setPermissionState] = useState<NotificationPermission | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    setDismissed(isNotificationBannerDismissed());
    // Desktop asks the OS for its own permission, independent of the
    // webview's Notification API state.
    if (inDesktop) {
      void getDesktopNotificationPermission().then(setPermissionState);
      return;
    }
    if (typeof Notification === "undefined") return;
    setPermissionState(Notification.permission);
  }, [inDesktop]);

  if (inDesktop ? !desktopNotificationsEnabled() : !settings.browserReminderNotifications) return null;
  if (permissionState !== "default" || dismissed) return null;

  const handleEnable = async () => {
    if (inDesktop) {
      const result = await requestDesktopNotificationPermission();
      setPermissionState(result);
      return;
    }
    try {
      const result = await Notification.requestPermission();
      setPermissionState(result);
      if (result === "granted") {
        try {
          const sub = await subscribeToPush();
          if (sub) {
            const { p256dh, auth } = extractSubscriptionKeys(sub);
            await upsertPushSubscription({ endpoint: sub.endpoint, p256dh, auth });
          }
        } catch {
          // Push subscription is best-effort
        }
      }
    } catch {
      // Some browsers don't support the promise-based API
    }
  };

  const handleDismiss = () => {
    setNotificationBannerDismissed(true);
    setDismissed(true);
  };

  return (
    <div className="fixed bottom-[88px] left-1/2 z-40 w-[min(92vw,420px)] -translate-x-1/2">
      <div className="flex items-center gap-3 rounded-xl border border-app-line bg-app-surface px-4 py-3 shadow-soft">
        <div className="flex-shrink-0">
          <div className="rounded-full bg-app-surface-muted p-2">
            <Bell className="h-4 w-4 text-app-ink-muted" />
          </div>
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-app-ink">Stay on top of reminders</p>
          <p className="mt-0.5 text-xs text-app-ink-faint">Get notified even when omanote is in the background.</p>
        </div>
        <div className="flex flex-shrink-0 items-center gap-2">
          <Button tone="default" className="px-3 py-1.5 text-xs" onClick={() => void handleEnable()}>
            Enable
          </Button>
          <Button tone="ghost" className="p-1.5" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
