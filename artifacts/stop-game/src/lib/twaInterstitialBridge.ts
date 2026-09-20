const RESULT_TIMEOUT_MS = 15_000;
let initialized = false;

export function initTwaInterstitialBridge(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
}

export function isTwaInterstitialAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    // Use the same TWA detection signals already used by Google Play Billing.
    // The production TWA can legitimately have no URL marker and no standalone
    // display-mode, while document.referrer still exposes android-app://.
    const referrer = typeof document !== "undefined" ? (document.referrer || "") : "";
    if (referrer.startsWith("android-app://")) return true;

    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "googleplay-twa" || params.get("source") === "twa") return true;
    if (params.has("appVersion") || /STOPApp\/[0-9][0-9.]*/i.test(navigator.userAgent || "")) return true;

    try {
      if (localStorage.getItem("stop_installed_app_version")) return true;
    } catch {}

    // In a production TWA none of the browser-side TWA markers is guaranteed
    // to be present. The native deep-link is the actual capability check: the
    // installed STOP Android app owns stopad://interstitial. On Android, allow
    // the request instead of silently dropping it because a browser signal is
    // missing. On desktop/web this remains disabled.
    return /Android/i.test(navigator.userAgent || "") && (
      window.location.hostname === "stopjuegodepalabras.com" ||
      window.location.hostname === "www.stopjuegodepalabras.com"
    );
  } catch { return false; }
}

function makeRequestId(): string {
  try {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  } catch {}
  return String(Date.now()) + Math.random().toString(36).slice(2);
}

export async function requestInterstitialAd(): Promise<void> {
  initTwaInterstitialBridge();
  if (typeof window === "undefined" || !isTwaInterstitialAvailable()) return;

  const requestId = makeRequestId();
  const origin = window.location.origin;

  await new Promise<void>((resolve) => {
    let finished = false;
    let timer: number | null = null;
    let focusTimer: number | null = null;

    const finish = () => {
      if (finished) return;
      finished = true;
      if (timer !== null) window.clearTimeout(timer);
      if (focusTimer !== null) window.clearTimeout(focusTimer);
      document.removeEventListener("visibilitychange", checkResume);
      window.removeEventListener("focus", checkResume);
      resolve();
    };

    const checkResume = () => {
      if (!finished && document.visibilityState === "visible") finish();
    };

    document.addEventListener("visibilitychange", checkResume);
    window.addEventListener("focus", checkResume);
    timer = window.setTimeout(finish, RESULT_TIMEOUT_MS);

    try {
      const deepLink =
        "stopad://interstitial?requestId=" +
        encodeURIComponent(requestId) +
        "&origin=" +
        encodeURIComponent(origin);
      // Same native Activity launch mechanism as the already-working Rewarded ads.
      window.location.href = deepLink;
      focusTimer = window.setTimeout(checkResume, 1200);
    } catch {
      finish();
    }
  });
}
