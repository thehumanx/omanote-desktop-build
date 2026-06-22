import { useEffect, useRef } from "react";
import { useApp } from "../app/AppProvider";
import { combineDateKeyAndTime, randomId } from "@omanote/shared";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { computeReminderTriggerAt } from "../lib/reminder-schedule";
import { isTauri, sendDesktopNotification } from "../lib/desktop";
import { desktopNotificationsEnabled } from "../lib/desktop-notifications";

export function ReminderMonitor() {
  const { state, dispatch } = useApp();
  const { settings } = useUserSettings();
  const firedRef = useRef(new Set<string>());
  const todosRef = useRef(state.todos);
  todosRef.current = state.todos;
  const channelRef = useRef<BroadcastChannel | null>(null);

  // Cross-tab dedup: when another tab fires a reminder, add its key to our
  // firedRef so we don't show the same notification a second time.
  useEffect(() => {
    if (typeof BroadcastChannel === "undefined") return;
    const channel = new BroadcastChannel("omanote-reminders");
    channelRef.current = channel;
    channel.onmessage = (event: MessageEvent) => {
      if (event.data?.type === "fired" && typeof event.data.key === "string") {
        firedRef.current.add(event.data.key as string);
      }
    };
    return () => {
      channel.close();
      channelRef.current = null;
    };
  }, []);

  useEffect(() => {
    function checkReminders() {
      const now = new Date();
      for (const todo of todosRef.current) {
        if (todo.deletedAt || todo.status !== "open" || !todo.dueDateKey || !todo.dueTime || todo.reminderFiredAt) {
          continue;
        }

        const dueAt = combineDateKeyAndTime(todo.dueDateKey, todo.dueTime);
        const triggerAt = computeReminderTriggerAt(dueAt, settings.reminderLeadMinutes);
        const key = `${todo.id}:${todo.dueDateKey}:${todo.dueTime}`;
        if (triggerAt <= now && !firedRef.current.has(key)) {
          const canShowInApp = settings.inAppReminderNotifications;
          // The desktop app has its own local toggle and OS-level permission;
          // it must not depend on the web app's browser-notification setting
          // or the webview's Notification.permission state.
          const canShowBrowser = isTauri()
            ? desktopNotificationsEnabled()
            : settings.browserReminderNotifications &&
              typeof Notification !== "undefined" &&
              Notification.permission === "granted";
          if (!canShowInApp && !canShowBrowser) {
            continue;
          }

          firedRef.current.add(key);
          channelRef.current?.postMessage({ type: "fired", key });
          dispatch({ type: "todo/mark-fired", todoId: todo.id, timestamp: Date.now() });

          if (canShowInApp) {
            dispatch({
              type: "toast/add",
              toast: {
                id: randomId(),
                createdAt: Date.now(),
                title: todo.title,
                kind: "reminder",
                tone: "warning",
                todoId: todo.id,
              },
            });
          }

          if (canShowBrowser) {
            if (isTauri()) {
              sendDesktopNotification({ title: "Reminder", body: todo.title }).catch(() => {});
            } else if ("serviceWorker" in navigator) {
              navigator.serviceWorker.ready
                .then((reg) =>
                  reg.showNotification("Reminder", {
                    body: todo.title,
                    icon: "/android-chrome-192x192.png",
                    tag: `omanote-reminder-${todo.id}`,
                    data: { todoId: todo.id },
                  }),
                )
                .catch(() => {});
            } else {
              try {
                const n = new Notification("Reminder", {
                  body: todo.title,
                  icon: "/android-chrome-192x192.png",
                  tag: `omanote-reminder-${todo.id}`,
                });
                n.onclick = () => { window.focus(); n.close(); };
              } catch {
                // Notification API may be unavailable in some contexts
              }
            }
          }
        }
      }
    }

    // Check immediately on mount (and whenever settings change) so a
    // past-due reminder appears without waiting for the first tick.
    checkReminders();
    const interval = window.setInterval(checkReminders, 10_000);
    return () => window.clearInterval(interval);
  }, [dispatch, settings.browserReminderNotifications, settings.inAppReminderNotifications, settings.reminderLeadMinutes]);

  return null;
}
