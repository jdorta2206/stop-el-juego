const RESULT_TIMEOUT_MS = 20_000;
let initialized = false;

export function initTwaInterstitialBridge(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
}

function hasAndroidAppReferrer(): boolean {
  if (typeof document === "undefined") return false;
  try {
    return document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa");
  } catch {
    return false;
  }
}

export function isTwaInterstitialAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "googleplay-twa" || params.get("source") === "twa") return true;
    if (hasAndroidAppReferrer()) return true;
    // The TWA can run inside a Custom Tab without exposing standalone/fullscreen
    // display-mode. For this bridge the Android package is the native transport
    // for the interstitial, so any Android WebView/Custom Tab session is eligible.
    return /Android/i.test(navigator.userAgent || "");
  } catch { return false; }
}

function makeRequestId(): string {
  try {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  } catch {}
  return `${Date.now()}${Math.random().toString(36).slice(2)}`;
}

export async function requestInterstitialAd(): Promise<void> {
  initTwaInterstitialBridge();
  if (typeof window === "undefined" || !isTwaInterstitialAvailable()) return;

  const requestId = makeRequestId();
  const origin = window.location.origin;
  const deepLink = `stopad://interstitial?requestId=${encodeURIComponent(requestId)}&origin=${encodeURIComponent(origin)}`;

  await new Promise<void>((resolve) => {
    let finished = false;
    let timer: number | null = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer !== null) window.clearTimeout(timer);
      document.removeEventListener("visibilitychange", onReturn);
      window.removeEventListener("focus", onReturn);
      resolve();
    };

    const onReturn = () => {
      if (document.visibilityState === "visible") window.setTimeout(finish, 120);
    };

    document.addEventListener("visibilitychange", onReturn);
    window.addEventListener("focus", onReturn);
    timer = window.setTimeout(finish, RESULT_TIMEOUT_MS);

    try { window.location.href = deepLink; } catch { finish(); }
  });
}
