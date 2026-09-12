/// <reference no-default-lib="true" />
/// <reference lib="esnext" />
/// <reference lib="webworker" />
import { precacheAndRoute, cleanupOutdatedCaches, createHandlerBoundToURL } from "workbox-precaching";
import { registerRoute, NavigationRoute } from "workbox-routing";
import { clientsClaim } from "workbox-core";

declare const self: ServiceWorkerGlobalScope;

// Deliberate: a new worker takes over immediately rather than waiting for every
// tab to close.
//
// The trade-off is that an already-open tab keeps running the *previous* bundle
// while the new worker's precache no longer holds that bundle's content-hashed
// chunks. Navigating to a route it hadn't loaded yet then misses the precache,
// falls through to the network, and 404s — which used to surface as a
// full-screen "Something went wrong".
//
// That is now handled where it belongs, on the import: `lazyWithReload`
// (src/lib/lazy-with-reload.ts) catches the failed chunk and reloads once, so
// the tab picks up the current index.html and the current chunk names. Instant
// activation plus one self-healing reload beats deferring updates until every
// tab closes, which on a pinned tab can be never.
//
// If you ever remove `lazyWithReload`, remove `skipWaiting()` with it — the two
// are a pair, and instant activation with no recovery path is the original bug.
self.skipWaiting();
clientsClaim();

precacheAndRoute(self.__WB_MANIFEST);
cleanupOutdatedCaches();

// Serve the cached app shell for navigations (e.g. reloading offline)
// instead of failing the request when the network is unreachable.
registerRoute(new NavigationRoute(createHandlerBoundToURL("index.html")));

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
      self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
        for (const client of clientList) {
          client.postMessage({ type: "todo/toggle", todoId });
          if ("focus" in client) return client.focus();
        }
        if (self.clients.openWindow) return self.clients.openWindow(`/?todoAction=complete&todoId=${encodeURIComponent(todoId)}`);
      }),
    );
    return;
  }

  // Default click: focus existing window or open a new one
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ("focus" in client) return client.focus();
      }
      if (self.clients.openWindow) return self.clients.openWindow("/");
    }),
  );
});
