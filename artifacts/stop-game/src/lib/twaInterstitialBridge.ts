const RESULT_TIMEOUT_MS = 20_000;
let initialized = false;
let bridgeReady = false;
const pendingResults = new Map<string, () => void>();

function handleNativeMessage(event: MessageEvent): void {
  const data = event?.data;
  if (!data) return;
  try {
    const message = typeof data === "string" ? JSON.parse(data) : data;
    if (message?.type === "STOP_AD_BRIDGE_READY") { bridgeReady = true; return; }
    if (message?.type !== "STOP_AD_INTERSTITIAL_RESULT" || !message.requestId) return;
    const resolve = pendingResults.get(String(message.requestId));
    if (!resolve) return;
    pendingResults.delete(String(message.requestId));
    resolve();
  } catch {}
}

export function initTwaInterstitialBridge(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  window.addEventListener("message", handleNativeMessage);
}

function makeRequestId(): string {
  try { if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, ""); } catch {}
  return String(Date.now()) + Math.random().toString(36).slice(2);
}

export function isTwaInterstitialAvailable(): boolean {
  if (typeof window === "undefined") return false;
  return /Android/i.test(navigator.userAgent || "");
}

export async function requestInterstitialAd(): Promise<void> {
  initTwaInterstitialBridge();
  if (typeof window === "undefined" || !isTwaInterstitialAvailable()) return;
  const requestId = makeRequestId();
  await new Promise<void>((resolve) => {
    let finished = false;
    let timer: number | null = null;
    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer !== null) window.clearTimeout(timer);
      pendingResults.delete(requestId);
      resolve();
    };
    pendingResults.set(requestId, finish);
    timer = window.setTimeout(finish, RESULT_TIMEOUT_MS);
    try {
      const send = () => window.postMessage(JSON.stringify({ type: "STOP_AD_REQUEST_INTERSTITIAL", requestId }), "*");
      if (bridgeReady) send(); else window.setTimeout(send, 500);
    } catch { finish(); }
  });
}