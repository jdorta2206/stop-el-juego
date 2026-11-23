import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { ensureOfflineBundle } from "./lib/offlineGame";
import { consumeAuthHandoff } from "./lib/oauth";
import { initTwaAdBridge } from "./lib/twaAdBridge";
import { initTwaPlayGamesBridge } from "./lib/twaPlayGamesBridge";
import { captureInstalledAppVersion, getInstalledAppVersion, getAnalyticsClientVersion } from "./lib/appVersion";
import { trackClientError } from "./lib/analyticsClient";
import { sanitizeDiagnosticText } from "./lib/diagnosticPrivacy";

// Record unexpected network failures without retrying requests or changing gameplay.
const reportedNetworkFailures = new Set<string>();
function reportUnexpectedNetworkFailure(error: unknown, context: Record<string, unknown>) {
  const value = error instanceof Error ? error : new Error(String(error ?? ""));
  if (!/failed to fetch|networkerror|network request failed|load failed|fetch failed/i.test(value.message)) return;

  const signature = `${value.message}|${value.stack ?? ""}|${String(context.resource_url ?? "")}`;
  if (reportedNetworkFailures.has(signature)) return;
  reportedNetworkFailures.add(signature);
  if (reportedNetworkFailures.size > 50) {
    const oldest = reportedNetworkFailures.values().next().value;
    if (oldest) reportedNetworkFailures.delete(oldest);
  }

  const safeValue = new Error(sanitizeDiagnosticText(value.message) ?? value.message);
  safeValue.name = value.name;
  safeValue.stack = sanitizeDiagnosticText(value.stack) ?? undefined;

  trackClientError(safeValue, null, {
    phase: "global_network_failure",
    error_kind: "fetch_or_resource_load",
    ...context,
  });
}

// Monitor STOP-owned requests only. Third-party analytics/ad scripts can be
// blocked by privacy tools and are not evidence that the STOP API is unhealthy.
const nativeFetch = window.fetch.bind(window);
window.fetch = (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
  let requestUrl: string | null = null;
  const method = String(init?.method ?? (input instanceof Request ? input.method : "GET")).toUpperCase();
  let retryInput: RequestInfo | URL = input;
  const requestSignal: AbortSignal | null = init?.signal ?? (input instanceof Request ? input.signal : null);
  try {
    const rawUrl = typeof input === "string" ? input : input instanceof URL ? input.href : input.url;
    const parsed = new URL(rawUrl, window.location.origin);
    const isSameOrigin = parsed.origin === window.location.origin;
    const isDiagnosticEndpoint = parsed.pathname === "/api/analytics/client-error";
    const isBestEffortTelemetry = method === "POST" &&
      (parsed.pathname === "/api/analytics/event" || parsed.pathname === "/api/analytics/heartbeat");
    if (isSameOrigin && !isDiagnosticEndpoint && !isBestEffortTelemetry) {
      requestUrl = parsed.origin + parsed.pathname;
      if (method === "GET" && input instanceof Request) retryInput = input.clone();
    } else {
      requestUrl = null;
    }
  } catch {
    // A malformed request URL should not affect the original fetch call.
  }

  const shouldRetryGet = Boolean(requestUrl && method === "GET");
  return nativeFetch(input, init).catch(async (error: unknown) => {
    if (shouldRetryGet && !requestSignal?.aborted) {
      // GET is idempotent. One short retry absorbs brief connection drops during
      // a Railway rollout without replaying game actions or POST submissions.
      await new Promise((resolve) => setTimeout(resolve, 350));
      if (!requestSignal?.aborted) {
        try {
          return await nativeFetch(retryInput, init);
        } catch (retryError) {
          if (!requestSignal?.aborted && requestUrl) {
            reportUnexpectedNetworkFailure(retryError, {
              source: "fetch_rejection",
              resource_url: requestUrl,
              resource_tag: "fetch",
            });
          }
          throw retryError;
        }
      }
    }
    if (requestUrl && !requestSignal?.aborted) {
      reportUnexpectedNetworkFailure(error, {
        source: "fetch_rejection",
        resource_url: requestUrl,
        resource_tag: "fetch",
      });
    }
    throw error;
  });
};

window.addEventListener("unhandledrejection", (event) => {
  reportUnexpectedNetworkFailure(event.reason, { source: "unhandledrejection" });
});

window.addEventListener("error", (event) => {
  if (event.error) {
    reportUnexpectedNetworkFailure(event.error, {
      source: "window_error",
      filename: sanitizeDiagnosticText(event.filename),
      line: event.lineno || null,
      column: event.colno || null,
    });
    return;
  }

  const target = event.target;
  if (target instanceof HTMLScriptElement || target instanceof HTMLLinkElement) {
    const rawUrl = target instanceof HTMLScriptElement ? target.src : target.href;
    let resourcePath: string | null = null;
    try {
      const parsed = new URL(rawUrl, window.location.origin);
      // External ad/analytics/CDN failures are outside STOP's operational control.
      if (parsed.origin === window.location.origin) resourcePath = parsed.origin + parsed.pathname;
    } catch {
      // Do not record an unparseable URL or any query-string data.
    }
    if (resourcePath) {
      reportUnexpectedNetworkFailure(new Error("Failed to fetch resource"), {
        source: "resource_load",
        resource_url: resourcePath,
        resource_tag: target.tagName.toLowerCase(),
      });
    }
  }
}, true);

// Install the TWA AdMob message listener before React mounts. Native TWA can
// complete the postMessage handshake very early during page startup; waiting
// for RewardedAd to mount can otherwise miss STOP_AD_BRIDGE_READY entirely.
initTwaAdBridge();
initTwaPlayGamesBridge();
captureInstalledAppVersion();

// Recover from stale/missing lazy chunks after a deployment. Browsers report
// these failures with different messages; Vite also emits "vite:preloadError".
// Keep recovery one-shot per tab to avoid reload loops on a genuinely missing asset.
const CHUNK_RECOVERY_KEY = "stop_chunk_recovery_once";
let chunkRecoveryStarted = false;
function recoverFromChunkFailure(reason: unknown) {
  if (chunkRecoveryStarted) return;
  const message = typeof reason === "string"
    ? reason
    : String((reason as { message?: unknown } | null)?.message ?? reason ?? "");
  const isChunkFailure = /failed to fetch dynamically imported module|importing a module script failed|error loading dynamically imported module|failed to load module script|loading chunk .* failed|chunkloaderror|vite:preloaderror/i.test(message)
    || /dynamic import|modulepreload/i.test(message);
  // Some WebViews report a stale React.lazy module as an undefined default
  // export instead of a conventional chunk-loading error. Recover only from
  // these explicit module-resolution signatures, using the same one-shot
  // cache cleanup below; unrelated runtime errors must not trigger reloads.
  const isLazyDefaultFailure = /lazy-module-missing-default|cannot read properties of undefined \(reading ['"]default['"]\)|undefined is not an object.*(?:_result\.default|\.default)|_result\.default/i.test(message);
  if (!isChunkFailure && !isLazyDefaultFailure) return;

  try {
    if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1") return;
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");
    chunkRecoveryStarted = true;

    // Remove stale code caches only. Never clear player/offline data.
    void (async () => {
      // Keep the active service worker registered: unregistering it here can
      // interrupt Web Push delivery. A fresh navigation uses network-first HTML,
      // while removing only STOP's versioned code caches forces current chunks.
      try {
        const keys = await caches.keys();
        await Promise.all(keys.filter((key) => /^stop-v/i.test(key)).map((key) => caches.delete(key)));
      } catch {}
      window.location.reload();
    })();
  } catch {
    // Recovery must never interfere with gameplay.
  }
}

window.addEventListener("error", (event) => recoverFromChunkFailure(event?.message || ""));
window.addEventListener("unhandledrejection", (event) => recoverFromChunkFailure(event?.reason));
window.addEventListener("vite:preloadError", (event) => {
  recoverFromChunkFailure((event as CustomEvent).payload || "vite:preloadError");
  // Allow the recovery reload; prevent the stale chunk error from becoming an uncaught page failure.
  event.preventDefault();
});

async function startAnalyticsHeartbeat() {
  if (typeof window === "undefined") return;

  const params = new URLSearchParams(window.location.search);
  let isAndroidTwa =
    document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa") ||
    params.get("source") === "googleplay-twa" ||
    !!getInstalledAppVersion();

  if (!isAndroidTwa && /Android/i.test(navigator.userAgent || "") && window.matchMedia?.("(display-mode: standalone)")?.matches) {
    try {
      const getInstalledRelatedApps = (navigator as Navigator & {
        getInstalledRelatedApps?: () => Promise<Array<{ platform?: string; id?: string }>>;
      }).getInstalledRelatedApps;
      const relatedApps = await getInstalledRelatedApps?.();
      isAndroidTwa = !!relatedApps?.some(
        (app) => app.platform === "play" && app.id === "app.replit.stop_el_juego.twa"
      );
    } catch {
      // Analytics must never interfere with gameplay.
    }
  }

  const platform = isAndroidTwa ? "android" : "web";
  if (isAndroidTwa) {
    try { localStorage.setItem("stop_analytics_twa_v1", "1"); } catch {}
  }
  const sessionKey = `stop_analytics_session_id_${platform}`;
  let sessionId: string;

  try {
    const stored = sessionStorage.getItem(sessionKey);
    if (stored) {
      sessionId = stored;
    } else {
      sessionId = `${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
      sessionStorage.setItem(sessionKey, sessionId);
    }
  } catch {
    sessionId = `${platform}_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  }

  let pingInFlight = false;

  const ping = async () => {
    if (pingInFlight) return;
    pingInFlight = true;
    try {
      const version = getAnalyticsClientVersion();
      let playerId: string | null = null;
      let loginMethod: string | null = null;
      try {
        const raw = localStorage.getItem("stop_player_v2");
        if (raw) {
          const parsed = JSON.parse(raw);
          if (typeof parsed?.id === "string") playerId = parsed.id;
          if (typeof parsed?.loginMethod === "string") loginMethod = parsed.loginMethod;
        }
      } catch {
        // Analytics identity is optional and must never affect gameplay.
      }
      await fetch(`${window.location.origin}/api/analytics/heartbeat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-Client-Platform": platform,
          ...(isAndroidTwa ? { "X-Client-TWA": "1" } : {}),
          ...(version ? { "X-Client-Version": version } : {}),
          ...(() => {
            try {
              const token = localStorage.getItem("stop_session_token") || sessionStorage.getItem("stop_session_token");
              return token ? { "X-Stop-Token": token } : {};
            } catch { return {}; }
          })(),
        },
        body: JSON.stringify({ sessionId, playerId, loginMethod, language: document.documentElement.lang || null }),
        keepalive: true,
      }).catch(() => {});
    } catch {
      // Analytics must never interfere with gameplay.
    } finally {
      pingInFlight = false;
    }
  };

  ping();
  window.setInterval(ping, 30_000);
}

async function bootstrapApp() {
  // OAuth handoff is an optional startup enhancement. Never let a stalled
  // network request prevent the game UI from mounting indefinitely.
  try {
    await Promise.race([
      consumeAuthHandoff(),
      new Promise<void>((resolve) => window.setTimeout(resolve, 2500)),
    ]);
  } catch {
    // Authentication recovery must not take the whole game offline.
  }
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  if (typeof window !== "undefined") {
    setTimeout(() => { ensureOfflineBundle(); }, 1500);
  }
}

void startAnalyticsHeartbeat();
void bootstrapApp();

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js")
      .then((registration) => {
        setInterval(() => registration.update(), 60_000);

        const notifyUpdate = (worker: ServiceWorker) => {
          worker.addEventListener("statechange", () => {
            if (worker.state === "activated") window.location.reload();
          });
          showUpdateBanner(() => worker.postMessage({ type: "SKIP_WAITING" }));
        };

        if (registration.waiting) notifyUpdate(registration.waiting);

        registration.addEventListener("updatefound", () => {
          const newWorker = registration.installing;
          if (!newWorker) return;
          newWorker.addEventListener("statechange", () => {
            if (newWorker.state === "installed" && navigator.serviceWorker.controller) {
              notifyUpdate(newWorker);
            }
          });
        });
      })
      .catch(() => {});
  });
}

function showUpdateBanner(onUpdate: () => void) {
  if (document.getElementById("sw-update-banner")) return;

  const banner = document.createElement("div");
  banner.id = "sw-update-banner";
  Object.assign(banner.style, {
    position: "fixed", bottom: "80px", left: "50%", transform: "translateX(-50%)",
    zIndex: "9999", display: "flex", alignItems: "center", gap: "12px",
    padding: "12px 20px", borderRadius: "16px", background: "rgba(10,18,60,0.97)",
    border: "2px solid rgba(249,168,37,0.6)", boxShadow: "0 8px 32px rgba(0,0,0,0.5)",
    backdropFilter: "blur(12px)", color: "white", fontFamily: "inherit",
    fontSize: "14px", fontWeight: "bold", whiteSpace: "nowrap", animation: "slideUp 0.3s ease",
  });

  const style = document.createElement("style");
  style.textContent = `@keyframes slideUp { from { opacity: 0; transform: translateX(-50%) translateY(20px); } to { opacity: 1; transform: translateX(-50%) translateY(0); } }`;
  document.head.appendChild(style);

  const text = document.createElement("span");
  text.textContent = "🆕 Nueva versión disponible";
  const btn = document.createElement("button");
  btn.textContent = "Actualizar";
  Object.assign(btn.style, { padding: "6px 16px", borderRadius: "10px", background: "rgba(249,168,37,0.9)", color: "#0d1757", fontWeight: "black", fontSize: "13px", border: "none", cursor: "pointer" });
  btn.onclick = () => { banner.remove(); onUpdate(); };

  const close = document.createElement("button");
  close.textContent = "✕";
  Object.assign(close.style, { background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "16px", padding: "0 4px" });
  close.onclick = () => banner.remove();

  banner.appendChild(text); banner.appendChild(btn); banner.appendChild(close);
  document.body.appendChild(banner);
}
