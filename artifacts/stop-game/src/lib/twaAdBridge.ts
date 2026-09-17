const RESULT_BASE = "/api/rewards/admob-result";
const RESULT_TIMEOUT_MS = 15_000;

type RewardedPlacement = "extra_time" | "hint" | "double_points" | "skip_round" | "extra_pack";
type RewardResult = { rewarded: boolean; source: "admob" | "skipped" | "error"; errorCode?: number; errorDomain?: string; errorMessage?: string };

let initialized = false;

function installResumeListener(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
}

export function initTwaAdBridge(): void {
  installResumeListener();
}

export function isTwaAdBridgeAvailable(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "googleplay-twa" || params.get("source") === "twa") return true;
    return /Android/i.test(navigator.userAgent || "") && (
      window.matchMedia?.("(display-mode: standalone)").matches === true ||
      window.matchMedia?.("(display-mode: fullscreen)").matches === true
    );
  } catch {
    return false;
  }
}

function makeRequestId(): string {
  try {
    if (crypto.randomUUID) return crypto.randomUUID().replace(/-/g, "");
  } catch {}
  return `${Date.now()}${Math.random().toString(36).slice(2)}${Math.random().toString(36).slice(2)}`;
}

async function readResult(requestId: string): Promise<RewardResult | null> {
  try {
    const response = await fetch(`${RESULT_BASE}/${encodeURIComponent(requestId)}`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
    });
    if (!response.ok) return null;
    const data = await response.json();
    if (data?.ready !== true) return null;
    return data.rewarded === true
      ? { rewarded: true, source: "admob" }
      : { rewarded: false, source: "skipped" };
  } catch {
    return null;
  }
}

export async function requestRewardedAd(placement: RewardedPlacement): Promise<RewardResult> {
  installResumeListener();
  if (typeof window === "undefined") return { rewarded: false, source: "error", errorMessage: "Window unavailable" };

  const requestId = makeRequestId();
  const deepLink = `stopad://rewarded?requestId=${encodeURIComponent(requestId)}&placement=${encodeURIComponent(placement)}`;

  return new Promise<RewardResult>((resolve) => {
    let finished = false;
    const startedAt = Date.now();
    let timer: number | null = null;

    const finish = (result: RewardResult) => {
      if (finished) return;
      finished = true;
      if (timer !== null) window.clearInterval(timer);
      document.removeEventListener("visibilitychange", checkNow);
      window.removeEventListener("focus", checkNow);
      resolve(result);
    };

    const checkNow = async () => {
      if (finished) return;
      const result = await readResult(requestId);
      if (result) finish(result);
      else if (Date.now() - startedAt >= RESULT_TIMEOUT_MS) {
        finish({ rewarded: false, source: "error", errorMessage: "El anuncio no está disponible ahora mismo" });
      }
    };

    timer = window.setInterval(checkNow, 750);
    document.addEventListener("visibilitychange", checkNow);
    window.addEventListener("focus", checkNow);

    try {
      // This navigation is executed directly from the user's "Ver anuncio" click.
      // Android routes the custom scheme to RewardedAdActivity, which is a real
      // foreground Activity and therefore a valid host for RewardedAd.show().
      window.location.href = deepLink;
    } catch {
      finish({ rewarded: false, source: "error", errorMessage: "No se ha podido abrir el anuncio" });
    }
  });
}
