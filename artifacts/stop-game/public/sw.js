const CACHE = "stop-v10";
const DATA_CACHE = "stop-data-v2";
const STATIC = [
  "/",
  "/manifest.json",
  "/images/stop-logo.png",
  "/images/icon-192.png",
  "/images/icon-512.png"
];
const OFFLINE_BUNDLE_PATH = "/api/game/offline-bundle";

async function cacheResponse(cacheName, request, response) {
  if (!response || !response.ok) return;
  // Clone immediately, before any consumer can read the response body.
  // cache.put() consumes its Response, so never pass the live response object.
  const copy = response.clone();
  const cache = await caches.open(cacheName);
  await cache.put(request, copy);
}

self.addEventListener("install", (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then((c) => Promise.all(STATIC.map((url) =>
        fetch(url, { cache: "reload" })
          .then((res) => {
            if (!res.ok) return null;
            const copy = res.clone();
            return c.put(url, copy);
          })
          .catch(() => null)
      ))),
      caches.open(DATA_CACHE).then((c) =>
        fetch(OFFLINE_BUNDLE_PATH, { cache: "reload" })
          .then((res) => {
            if (!res.ok) return null;
            const copy = res.clone();
            return c.put(OFFLINE_BUNDLE_PATH, copy);
          })
          .catch(() => null)
      ),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  const keep = new Set([CACHE, DATA_CACHE]);
  e.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => !keep.has(k)).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (e) => {
  if (e.request.method !== "GET") return;
  const url = new URL(e.request.url);

  // API calls must always go directly to the server. In particular, never
  // cache authentication responses or consume their Response body in the SW.
  if (url.pathname.startsWith("/api/") && url.pathname !== OFFLINE_BUNDLE_PATH) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  if (url.pathname === OFFLINE_BUNDLE_PATH) {
    e.respondWith((async () => {
      const cache = await caches.open(DATA_CACHE);
      const cached = await cache.match(e.request);
      try {
        const response = await fetch(e.request);
        if (response.ok) {
          const copy = response.clone();
          await cache.put(e.request, copy);
        }
        return response;
      } catch {
        return cached || Response.error();
      }
    })());
    return;
  }

  if (e.request.mode === "navigate" || e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith((async () => {
      try {
        const response = await fetch(e.request);
        if (response.ok) {
          const copy = response.clone();
          const cache = await caches.open(CACHE);
          await cache.put(e.request, copy);
        }
        return response;
      } catch {
        return (await caches.match(e.request)) || (await caches.match("/"));
      }
    })());
    return;
  }

  if (url.pathname.match(/\.[0-9a-f]{8,}\.(js|css)$/) || url.pathname.startsWith("/images/")) {
    e.respondWith((async () => {
      const cached = await caches.match(e.request);
      if (cached) return cached;
      try {
        const response = await fetch(e.request);
        if (response.ok) await cacheResponse(CACHE, e.request, response);
        return response;
      } catch {
        return Response.error();
      }
    })());
    return;
  }

  e.respondWith((async () => {
    try {
      const response = await fetch(e.request);
      if (response.ok && url.origin === self.location.origin) {
        await cacheResponse(CACHE, e.request, response);
      }
      return response;
    } catch {
      return (await caches.match(e.request)) || Response.error();
    }
  })());
});

self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") self.skipWaiting();
});

self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch {}
  const title = data.title || "STOP El Juego";
  const body = data.body || "¡Tienes una notificación!";
  const icon = data.icon || "/images/icon-192.png";
  const badge = data.badge || "/images/badge-96.png";
  const url = data.url || "/";
  e.waitUntil(self.registration.showNotification(title, { body, icon, badge, data: { url }, vibrate: [200, 100, 200], requireInteraction: false }));
});

self.addEventListener("notificationclick", (e) => {
  e.notification.close();
  const url = e.notification.data?.url || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((clients) => {
    for (const client of clients) {
      if (client.url.includes(self.location.origin) && "focus" in client) {
        client.navigate(url);
        return client.focus();
      }
    }
    if (self.clients.openWindow) return self.clients.openWindow(url);
  }));
});