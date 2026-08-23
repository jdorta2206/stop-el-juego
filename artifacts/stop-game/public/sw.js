const CACHE = "stop-v8";
// Separate cache for game data (dictionary, etc) so it survives shell upgrades.
const DATA_CACHE = "stop-data-v1";
const STATIC = [
  "/",
  "/manifest.json",
  "/images/stop-logo.png",
  "/images/icon-192.png",
  "/images/icon-512.png"
];
// Endpoint with the dictionary needed to play solo offline.
const OFFLINE_BUNDLE_PATH = "/api/game/offline-bundle";

self.addEventListener("install", (e) => {
  e.waitUntil(
    Promise.all([
      caches.open(CACHE).then((c) =>
        Promise.all(
          STATIC.map((url) =>
            fetch(url, { cache: "reload" })
              .then((res) => (res.ok ? c.put(url, res) : null))
              .catch(() => null)
          )
        )
      ),
      caches.open(DATA_CACHE).then((c) =>
        fetch(OFFLINE_BUNDLE_PATH, { cache: "reload" })
          .then((res) => (res.ok ? c.put(OFFLINE_BUNDLE_PATH, res) : null))
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

  if (url.pathname === OFFLINE_BUNDLE_PATH) {
    e.respondWith(
      caches.open(DATA_CACHE).then((c) =>
        c.match(e.request).then((cached) => {
          const fresh = fetch(e.request)
            .then((res) => {
              if (res.ok) c.put(e.request, res.clone());
              return res;
            })
            .catch(() => cached);
          return cached || fresh;
        })
      )
    );
    return;
  }

  // API calls always use the network; cached data is only a fallback for offline mode.
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
    return;
  }

  // HTML navigation: network first so a new deployment is picked up immediately.
  if (e.request.mode === "navigate" || e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() => caches.match(e.request).then((m) => m || caches.match("/")))
    );
    return;
  }

  // Hashed JS/CSS assets are safe to cache because their filename changes on build.
  if (url.pathname.match(/\.[0-9a-f]{8,}\.(js|css)$/) || url.pathname.startsWith("/images/")) {
    e.respondWith(
      caches.match(e.request).then((cached) =>
        cached ||
        fetch(e.request).then((res) => {
          if (res.ok) {
            const clone = res.clone();
            caches.open(CACHE).then((c) => c.put(e.request, clone));
          }
          return res;
        })
      )
    );
    return;
  }

  e.respondWith(
    fetch(e.request)
      .then((res) => {
        if (res.ok && url.origin === self.location.origin) {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
        }
        return res;
      })
      .catch(() => caches.match(e.request))
  );
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
