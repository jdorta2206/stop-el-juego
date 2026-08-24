import { createRoot } from "react-dom/client";
import { HelmetProvider } from "react-helmet-async";
import App from "./App";
import "./index.css";
import { ensureOfflineBundle } from "./lib/offlineGame";
import { consumeAuthHandoff } from "./lib/oauth";
import { captureInstalledAppVersion } from "./lib/appVersion";

captureInstalledAppVersion();
consumeAuthHandoff();

createRoot(document.getElementById("root")!).render(
  <HelmetProvider>
    <App />
  </HelmetProvider>
);

if (typeof window !== "undefined") {
  setTimeout(() => { ensureOfflineBundle(); }, 1500);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    // Versioned registration plus updateViaCache:none forces browsers holding
    // an older worker response to fetch and install the current worker.
    navigator.serviceWorker.register("/sw.js?v=20260824", { updateViaCache: "none" })
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
    fontSize: "14px", fontWeight: "bold", whiteSpace: "nowrap",
  });

  const text = document.createElement("span");
  text.textContent = "🆕 Nueva versión disponible";

  const btn = document.createElement("button");
  btn.textContent = "Actualizar";
  Object.assign(btn.style, {
    padding: "6px 16px", borderRadius: "10px", background: "rgba(249,168,37,0.9)",
    color: "#0d1757", fontWeight: "black", fontSize: "13px", border: "none", cursor: "pointer",
  });
  btn.onclick = () => { banner.remove(); onUpdate(); };

  const close = document.createElement("button");
  close.textContent = "✕";
  Object.assign(close.style, { background: "none", border: "none", color: "rgba(255,255,255,0.5)", cursor: "pointer", fontSize: "16px", padding: "0 4px" });
  close.onclick = () => banner.remove();

  banner.appendChild(text);
  banner.appendChild(btn);
  banner.appendChild(close);
  document.body.appendChild(banner);
}