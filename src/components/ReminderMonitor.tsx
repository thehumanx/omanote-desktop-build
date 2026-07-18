import { useEffect, useRef } from "react";
import { useApp } from "../app/AppProvider";
import { useLocation } from "react-router-dom";
import { combineDateKeyAndTime, previousOccurrenceOnOrBefore, randomId, toDateKey } from "@omanote/shared";
import { useUserSettings } from "../contexts/UserSettingsContext";
import { computeReminderTriggerAt } from "../lib/reminder-schedule";
import { isTauri, sendDesktopNotification } from "../lib/desktop";
import { desktopNotificationsEnabled } from "../lib/desktop-notifications";

export function ReminderMonitor() {
  const { state, dispatch } = useApp();
  const location = useLocation();
  const { settings } = useUserSettings();
  const firedRef = useRef(new Set<string>());
  const handledActionRef = useRef<string | null>(null);
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

  // Listen for "todo/toggle" messages from the service worker
  // (e.g. user clicked "Mark as complete" on a notification action)
  useEffect(() => {
    if (typeof navigator === "undefined" || !("serviceWorker" in navigator)) return;
    const handler = (event: MessageEvent) => {
      if (event.data?.type === "todo/toggle" && typeof event.data.todoId === "string") {
        dispatch({ type: "todo/toggle", todoId: event.data.todoId });
      }
    };
    navigator.serviceWorker.addEventListener("message", handler);
    return () => navigator.serviceWorker.removeEventListener("message", handler);
  }, [dispatch]);

  // Handle notification actions when the service worker had to open the app
  // in a fresh window instead of messaging an already-running client.
  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const todoAction = params.get("todoAction");
    const todoId = params.get("todoId");
    const actionKey = todoAction && todoId ? `${todoAction}:${todoId}` : null;
    if (todoAction !== "complete" || !todoId || handledActionRef.current === actionKey) return;

    handledActionRef.current = actionKey;
    dispatch({ type: "todo/toggle", todoId });

    params.delete("todoAction");
    params.delete("todoId");
    const nextSearch = params.toString();
    const nextUrl = `${location.pathname}${nextSearch ? `?${nextSearch}` : ""}${location.hash}`;
    window.history.replaceState({}, "", nextUrl);
  }, [dispatch, location.hash, location.pathname, location.search]);

  useEffect(() => {
    function checkReminders() {
      const now = new Date();
      const todayKey = toDateKey(now);
      for (const todo of todosRef.current) {
        if (todo.deletedAt || todo.status !== "open" || !todo.dueDateKey || !todo.dueTime) {
          continue;
        }
        const repeating = Boolean(todo.reminderEveryMinutes && todo.reminderUntil);

        // Recurring series: fire for the current occurrence computed from the
        // rule (so daily/weekly reminders repeat), not the pinned dueDateKey.
        // Skip occurrences the master has already advanced past (completed).
        let occurrenceDateKey = todo.dueDateKey;
        const recurring = Boolean(todo.recurrence);
        if (todo.recurrence) {
          const occ = previousOccurrenceOnOrBefore(todo.recurrence, todayKey);
          if (!occ || occ < todo.dueDateKey) continue;
          occurrenceDateKey = occ;
        }

        // reminderFiredAt only debounces one-shot reminders; repeating and
        // recurring reminders fire once per slot/occurrence, deduped by key.
        if (todo.reminderFiredAt && !repeating && !recurring) {
          continue;
        }

        const dueAt = combineDateKeyAndTime(occurrenceDateKey, todo.dueTime);
        let triggerAt = computeReminderTriggerAt(dueAt, settings.reminderLeadMinutes);
        let key = `${todo.id}:${occurrenceDateKey}:${todo.dueTime}`;
        if (repeating) {
          if (now.getTime() > todo.reminderUntil!) continue;
          if (now >= triggerAt) {
            // Fire only the latest elapsed slot — after a laptop wakes from
            // sleep we don't replay every missed interval.
            const everyMs = todo.reminderEveryMinutes! * 60_000;
            const slot = Math.floor((now.getTime() - triggerAt.getTime()) / everyMs);
            const slotAt = triggerAt.getTime() + slot * everyMs;
            if (slotAt > todo.reminderUntil!) continue;
            triggerAt = new Date(slotAt);
            key = `${todo.id}:repeat:${slotAt}`;
          }
        }
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
                .then((reg) => {
                  const options = {
                    body: todo.title,
                    icon: "/android-chrome-192x192.png",
                    tag: `omanote-reminder-${todo.id}`,
                    data: { todoId: todo.id },
                    actions: [{ action: "complete", title: "✓ Mark as complete" }],
                  } as NotificationOptions & {
                    actions: { action: string; title: string }[];
                  };
                  return reg.showNotification("Reminder", options);
                })
                .catch(() => {});
            } else {
              try {
                const options = {
                  body: todo.title,
                  icon: "/android-chrome-192x192.png",
                  tag: `omanote-reminder-${todo.id}`,
                  data: { todoId: todo.id },
                  actions: [{ action: "complete", title: "✓ Mark as complete" }],
                } as NotificationOptions & {
                  actions: { action: string; title: string }[];
                };
                const n = new Notification("Reminder", options);
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
