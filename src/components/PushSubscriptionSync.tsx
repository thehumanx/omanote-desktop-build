import { useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { subscribeToPush, extractSubscriptionKeys, getExistingPushSubscription } from "../lib/push-subscription";

export function PushSubscriptionSync() {
  const { settings } = useUserSettings();
  const upsertPushSubscription = useMutation(api.pushSubscriptions.upsertPushSubscription);
  const setMyTimeZone = useMutation(api.userSettings.setMyTimeZone);
  // The same subscription UserSettingsContext holds, so Convex serves it from
  // one query; it's only read here for the stored zone.
  const storedSettings = useQuery(api.userSettings.getMySettings);

  // Push reminders are scheduled on the server, whose clock is UTC; it needs
  // this device's zone to fire them at the local due time. Sent only when it
  // differs from the stored one — once per account, then on travel.
  const storedTimeZone = storedSettings === undefined ? undefined : storedSettings?.timeZone ?? null;
  useEffect(() => {
    if (storedTimeZone === undefined) return; // still loading
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (!timeZone || timeZone === storedTimeZone) return;
    setMyTimeZone({ timeZone }).catch(() => {
      // Best-effort, like the subscription sync below.
    });
  }, [setMyTimeZone, storedTimeZone]);

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
