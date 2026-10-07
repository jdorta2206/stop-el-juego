import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { ensureOfflineBundle } from "./lib/offlineGame";
import { consumeAuthHandoff } from "./lib/oauth";
import { initTwaAdBridge } from "./lib/twaAdBridge";
import { captureInstalledAppVersion, getInstalledAppVersion } from "./lib/appVersion";

// Install the TWA AdMob message listener before React mounts. Native TWA can
// complete the postMessage handshake very early during page startup; waiting
// for RewardedAd to mount can otherwise miss STOP_AD_BRIDGE_READY entirely.
initTwaAdBridge();
captureInstalledAppVersion();

// Recover once from a stale dynamic-import chunk after a deployment.
// This is deliberately one-shot so a genuinely missing asset cannot cause a reload loop.
const CHUNK_RECOVERY_KEY = "stop_chunk_recovery_once";
window.addEventListener("error", (event) => {
  const message = String(event?.message || "");
  if (!message.includes("Failed to fetch dynamically imported module")) return;
  try {
    if (sessionStorage.getItem(CHUNK_RECOVERY_KEY) === "1") return;
    sessionStorage.setItem(CHUNK_RECOVERY_KEY, "1");

    // A deployment can leave an older service worker controlling the page
    // while the server has already removed the hashed chunk it cached.
    // Unregister that controller and clear only the static asset caches before
    // retrying. Keep DATA_CACHE intact so offline game data is not destroyed.
    void (async () => {
      try {
        const registrations = await navigator.serviceWorker?.getRegistrations?.() || [];
        await Promise.all(registrations.map((registration) => registration.unregister()));
      } catch {
        // Cache recovery is best-effort and must never block gameplay.
      }

      try {
        const keys = await caches.keys();
        await Promise.all(
          keys
            .filter((key) => key.startsWith("stop-v"))
            .map((key) => caches.delete(key))
        );
      } catch {
        // Browser cache APIs are optional; the reload below remains the fallback.
      }

      window.location.reload();
    })();
  } catch {
    // Recovery must never interfere with gameplay.
  }
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
      const version = getInstalledAppVersion();
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
  await consumeAuthHandoff();
  createRoot(document.getElementById("root")!).render(
    <HelmetProvider>
      <App />
    </HelmetProvider>
  );

  if (typeof window !== "undefined") {
    requestAnimationFrame(() => {
      const splash = document.getElementById("html-splash");
      if (!splash) return;
      splash.classList.add("fade-out");
      window.setTimeout(() => splash.remove(), 400);
    });
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
