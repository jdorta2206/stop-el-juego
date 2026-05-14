const CACHE = "stop-v7";
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
        // Use individual puts so a single missing asset doesn't abort install
        Promise.all(
          STATIC.map((url) =>
            fetch(url, { cache: "reload" })
              .then((res) => (res.ok ? c.put(url, res) : null))
              .catch(() => null)
          )
        )
      ),
      // Pre-warm the offline data bundle so the very first match works
      // even if the player goes offline immediately after installing.
      caches.open(DATA_CACHE).then((c) =>
        fetch(OFFLINE_BUNDLE_PATH, { cache: "reload" })
          .then((res) => (res.ok ? c.put(OFFLINE_BUNDLE_PATH, res) : null))
          .catch(() => null)
      ),
    ]).then(() => self.skipWaiting())
  );
});

self.addEventListener("activate", (e) => {
  // Keep both the current shell cache AND the data cache; only purge older versions.
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

  // Offline data bundle: stale-while-revalidate from the dedicated data cache,
  // so the dictionary is available instantly and refreshed in the background.
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

  // API calls: always network, fall back to cache
  if (url.pathname.startsWith("/api/")) {
    e.respondWith(
      fetch(e.request).catch(() => caches.match(e.request))
    );
    return;
  }

  // HTML navigation requests: NETWORK FIRST so updates are always picked up.
  // If offline, fall back to the cached shell ("/").
  if (e.request.mode === "navigate" || e.request.headers.get("accept")?.includes("text/html")) {
    e.respondWith(
      fetch(e.request)
        .then((res) => {
          const clone = res.clone();
          caches.open(CACHE).then((c) => c.put(e.request, clone));
          return res;
        })
        .catch(() =>
          caches.match(e.request).then((m) => m || caches.match("/"))
        )
    );
    return;
  }

  // JS/CSS/images with content hash in URL: cache first (safe because hash changes on deploy)
  if (
    url.pathname.match(/\.[0-9a-f]{8,}\.(js|css)$/) ||
    url.pathname.startsWith("/images/")
  ) {
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

  // Everything else: network first, cache as fallback
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

// Allow the page to trigger SW update via postMessage
self.addEventListener("message", (e) => {
  if (e.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

// ── Push notifications ────────────────────────────────────────────────────────
self.addEventListener("push", (e) => {
  let data = {};
  try { data = e.data?.json() ?? {}; } catch {}

  const title  = data.title  || "STOP El Juego";
  const body   = data.body   || "¡Tienes una notificación!";
  const icon   = data.icon   || "/images/icon-192.png";
  const badge  = data.badge  || "/images/badge-96.png";
  const url    = data.url    || "/";

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
