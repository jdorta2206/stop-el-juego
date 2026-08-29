const CACHE = "stop-v9";
const DATA_CACHE = "stop-data-v1";
const STATIC = ["/", "/manifest.json", "/images/stop-logo.png", "/images/icon-192.png", "/images/icon-512.png"];
const OFFLINE_BUNDLE_PATH = "/api/game/offline-bundle";

self.addEventListener("install", (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then((c) => Promise.all(STATIC.map((url) => fetch(url, { cache: "reload" }).then((res) => (res.ok ? c.put(url, res) : null)).catch(() => null)))),
      caches.open(DATA_CACHE).then((c) => fetch(OFFLINE_BUNDLE_PATH, { cache: "reload" }).then((res) => (res.ok ? c.put(OFFLINE_BUNDLE_PATH, res) : null)).catch(() => null)),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  const keep = new Set([CACHE, DATA_CACHE]);
  e.waitUntil(caches.keys().then((keys) => Promise.all(keys.filter((key) => !keep.has(key)).map((key) => caches.delete(key)))).then(() => self.clients.claim()));
});

self.addEventListener("fetch", (e) => {
  const req = e.request;
  if (req.method !== "GET") return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  // Authentication/session endpoints must never be served from the shell cache.
  if (url.pathname.startsWith("/api/auth/")) {
    e.respondWith(fetch(req, { cache: "no-store" }));
    return;
  }

  if (url.pathname === OFFLINE_BUNDLE_PATH) {
    e.respondWith(caches.open(DATA_CACHE).then(async (cache) => {
      try {
        const network = await fetch(req, { cache: "no-store" });
        if (network.ok) await cache.put(req, network.clone());
        return network;
      } catch {
        return (await cache.match(req)) || new Response("{}", { status: 503, headers: { "Content-Type": "application/json" } });
      }
    }));
    return;
  }

  e.respondWith(caches.match(req).then((cached) => cached || fetch(req).then((res) => {
    if (res.ok && url.pathname.startsWith("/assets/")) caches.open(CACHE).then((cache) => cache.put(req, res.clone())).catch(() => {});
    return res;
  }).catch(() => cached || new Response("Offline", { status: 503 }))));
});

// Web Push: receive server notifications and display them even when the game
// is closed/backgrounded. This handler was accidentally removed from sw.js
// during the auth/service-worker cache cleanup.
self.addEventListener("push", (e) => {
  let data = {};
  try {
    data = e.data?.json() ?? {};
  } catch {
    try {
      data = { body: e.data?.text() || "¡Tienes una notificación!" };
    } catch {}
  }

  const title = data.title || "STOP El Juego";
  const body = data.body || "¡Tienes una notificación!";
  const icon = data.icon || "/images/icon-192.png";
  const badge = data.badge || "/images/badge-96.png";
  const url = data.url || "/";

  e.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon,
      badge,
      data: { url },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    })
  );
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";

  e.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
      for (const client of clients) {
        if (client.url.includes(self.location.origin) && "focus" in client) {
          client.navigate(url);
          return client.focus();
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(url);
    })
  );
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});
