self.addEventListener("push", (event) => {
  if (!event.data) return;

  let data;
  try {
    data = event.data.json();
  } catch {
    data = { title: "Reminder", body: event.data.text() };
  }

  const title = data.title ?? "Reminder";
  const options = {
    body: data.body,
    icon: data.icon ?? "/android-chrome-192x192.png",
    tag: data.tag,
    data,
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const todoId = event.notification.data?.todoId;

  if (event.action === "complete" && todoId) {
    event.waitUntil(
      clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: "todo/toggle", todoId });
          if ("focus" in client) return client.focus();
        }
        if (clients.openWindow) return clients.openWindow(`/?todoAction=complete&todoId=${encodeURIComponent(todoId)}`);
      }),
    );
    return;
  }

  // Default click: focus existing window or open a new one
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (clients.openWindow) return clients.openWindow("/");
    }),
  );
});
