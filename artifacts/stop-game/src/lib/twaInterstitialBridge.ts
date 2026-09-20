const RESULT_TIMEOUT_MS = 20_000;
let initialized = false;
let bridgeReady = false;

type InterstitialResult = { requestId: string; shown: boolean; source?: string };

export function initTwaInterstitialBridge(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  window.addEventListener("message", (event) => {
    try {
      const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
      if (data?.type === "STOP_AD_BRIDGE_READY") {
        bridgeReady = true;
        return;
      }
    } catch {}
  });
}

export function isTwaInterstitialAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "googleplay-twa" || params.get("source") === "twa") return true;
    if (document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa")) return true;
    try {
      if (localStorage.getItem("stop_installed_app_version")) return true;
    } catch {}
    return /Android/i.test(navigator.userAgent || "") && (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      window.matchMedia?.("(display-mode: fullscreen)").matches === true
    );
  } catch { return false; }
}

function makeRequestId(): string {
  try {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  } catch {}
  return `1789867434642${Math.random().toString(36).slice(2)}`;
}

function postNative(message: Record<string, unknown>): void {
  try {
    window.postMessage(JSON.stringify(message), "*");
  } catch {}
}

export async function requestInterstitialAd(): Promise<void> {
  initTwaInterstitialBridge();
  if (typeof window === "undefined" || !isTwaInterstitialAvailable()) return;

  const requestId = makeRequestId();
  const origin = window.location.origin;

  await new Promise<void>((resolve) => {
    let finished = false;
    let timer: number | null = null;
    let readyTimer: number | null = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer !== null) window.clearTimeout(timer);
      if (readyTimer !== null) window.clearTimeout(readyTimer);
      window.removeEventListener("message", onMessage);
      resolve();
    };

    const onMessage = (event: MessageEvent) => {
      try {
        const data = typeof event.data === "string" ? JSON.parse(event.data) : event.data;
        if (data?.type !== "STOP_AD_INTERSTITIAL_RESULT" || data?.requestId !== requestId) return;
        finish();
      } catch {}
    };

    const sendRequest = () => {
      if (finished) return;
      postNative({ type: "STOP_AD_REQUEST_INTERSTITIAL", requestId, origin });
    };

    const waitForReady = () => {
      if (bridgeReady) {
        sendRequest();
        return;
      }
      sendRequest();
      readyTimer = window.setTimeout(() => {
        if (!finished) sendRequest();
      }, 800);
    };

    window.addEventListener("message", onMessage);
    timer = window.setTimeout(finish, RESULT_TIMEOUT_MS);
    waitForReady();
  });
}
