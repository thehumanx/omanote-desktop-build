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

// The bundled Clerk runtime (~850 KB) is only ever loaded by the desktop app
// (see src/main.tsx), which needs it cached to boot offline. Precaching it made
// every *web* install download it too. Instead it lives in its own cache,
// which only a desktop webview ever creates — on first boot, via the route
// below — and which each new worker then refreshes on install, so an update
// can't leave desktop pointing at a chunk it hasn't cached.
const DESKTOP_ONLY_CACHE = "omanote-desktop-only";
// Rollup names the chunk after the module: `clerk.no-rhc-<hash>.js` today,
// `clerk-<hash>.js` for the full build.
const isDesktopOnlyAsset = (path: string) => /(^|\/)assets\/clerk[.-][^/]+\.js$/.test(path);
const manifestUrl = (entry: string | { url: string }) => (typeof entry === "string" ? entry : entry.url);

const manifest = self.__WB_MANIFEST;
const desktopOnlyUrls = manifest
  .map(manifestUrl)
  .filter(isDesktopOnlyAsset)
  .map((url) => new URL(url, self.registration.scope).href);

precacheAndRoute(manifest.filter((entry) => !isDesktopOnlyAsset(manifestUrl(entry))));
cleanupOutdatedCaches();

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      if (!(await caches.has(DESKTOP_ONLY_CACHE))) return;
      const cache = await caches.open(DESKTOP_ONLY_CACHE);
      await cache.addAll(desktopOnlyUrls);
      for (const request of await cache.keys()) {
        if (!desktopOnlyUrls.includes(request.url)) await cache.delete(request);
      }
    })(),
  );
});

registerRoute(
  ({ url }) => url.origin === self.location.origin && isDesktopOnlyAsset(url.pathname),
  async ({ request }) => {
    const cache = await caches.open(DESKTOP_ONLY_CACHE);
    const cached = await cache.match(request);
    if (cached) return cached;
    const response = await fetch(request);
    if (response.ok) await cache.put(request, response.clone());
    return response;
  },
);

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
