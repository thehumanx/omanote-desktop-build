import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { subscribeToPush, extractSubscriptionKeys, getExistingPushSubscription } from "../lib/push-subscription";

export function PushSubscriptionSync() {
  const { settings } = useUserSettings();
  const upsertPushSubscription = useMutation(api.pushSubscriptions.upsertPushSubscription);

  useEffect(() => {
    if (!settings.browserReminderNotifications) return;
    if (typeof Notification === "undefined" || Notification.permission !== "granted") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    async function sync() {
      try {
        let sub = await getExistingPushSubscription();
        if (!sub) {
          sub = await subscribeToPush();
        }
        if (!sub) return;
        const { p256dh, auth } = extractSubscriptionKeys(sub);
        await upsertPushSubscription({ endpoint: sub.endpoint, p256dh, auth });
      } catch {
        // Best-effort — do not surface errors to the user
      }
    }

    void sync();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings.browserReminderNotifications]);

  return null;
}
