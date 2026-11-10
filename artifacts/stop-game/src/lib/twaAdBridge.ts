const RESULT_BASE = "/api/rewards/admob-result";
// An earned client callback is only a signal. Keep polling for signed AdMob SSV
// throughout the reconciliation window; never grant an unverified reward.
const RESULT_TIMEOUT_MS = 300_000;

type RewardedPlacement = "extra_time" | "hint" | "double_points" | "skip_round" | "extra_pack";
export type RewardResult = {
  rewarded: boolean;
  source: "admob" | "client" | "skipped" | "error";
  errorCode?: number;
  errorDomain?: string;
  errorMessage?: string;
  pendingSsv?: boolean;
  requestId?: string;
};

let initialized = false;
let pendingPlayerId = "guest";

export function setRewardedAdPlayerId(playerId: string | undefined): void {
  pendingPlayerId = playerId || "guest";
}

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
    if (data?.ready === true) {
      return data.rewarded === true
        ? { rewarded: true, source: "admob" }
        : { rewarded: false, source: "skipped" };
    }
    if (data?.clientState === "earned") {
      return {
        rewarded: false,
        source: "error",
        pendingSsv: true,
        requestId,
        errorMessage: "El anuncio se ha visto, pero Google aún no ha confirmado la recompensa. Reintenta la comprobación; no se concederá hasta verificarla.",
      };
    }
    return null;
  } catch {
    return null;
  }
}

async function acknowledgeRewardResult(requestId: string): Promise<void> {
  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      const response = await fetch(`${RESULT_BASE}/${encodeURIComponent(requestId)}/consume`, {
        method: "POST",
        credentials: "include",
        cache: "no-store",
      });
      if (response.ok) return;
    } catch {}
    await new Promise((resolve) => window.setTimeout(resolve, 500 * (attempt + 1)));
  }
}

function pollRewardResult(requestId: string): Promise<RewardResult> {
  return new Promise<RewardResult>((resolve) => {
    let finished = false;
    let checkInFlight = false;
    const startedAt = Date.now();
    let timer: number | null = null;
    let deadlineTimer: number | null = null;
    let pageWasHidden = document.visibilityState === "hidden";

    const finish = (result: RewardResult) => {
      if (finished) return;
      finished = true;
      if (timer !== null) window.clearInterval(timer);
      if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleWindowFocus);
      if (result.rewarded) void acknowledgeRewardResult(requestId);
      resolve(result);
    };

    const checkNow = async () => {
      if (finished || checkInFlight) return;
      checkInFlight = true;
      try {
        const result = await readResult(requestId);
        if (result?.rewarded || result?.source === "skipped") {
          finish(result);
          return;
        }
        if (Date.now() - startedAt >= RESULT_TIMEOUT_MS) {
          finish({
            rewarded: false,
            source: "error",
            requestId,
            errorMessage: "No se pudo confirmar la recompensa. Puedes reintentar la comprobación.",
          });
        }
      } finally {
        checkInFlight = false;
      }
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        pageWasHidden = true;
        return;
      }
      if (!pageWasHidden) return;
      pageWasHidden = false;
      void checkNow();
    };

    const handleWindowFocus = () => {
      if (pageWasHidden && document.visibilityState !== "hidden") {
        handleVisibilityChange();
      } else {
        void checkNow();
      }
    };

    timer = window.setInterval(checkNow, 1500);
    const finishAtDeadline = () => {
      // Let an already-running result request settle before closing reconciliation.
      // Otherwise a verified SSV response arriving at the deadline could be discarded.
      if (checkInFlight) {
        deadlineTimer = window.setTimeout(finishAtDeadline, 1500);
        return;
      }
      finish({
        rewarded: false,
        source: "error",
        requestId,
        errorMessage: "No se pudo confirmar la recompensa. Puedes reintentar la comprobación.",
      });
    };
    deadlineTimer = window.setTimeout(finishAtDeadline, RESULT_TIMEOUT_MS);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    window.addEventListener("focus", handleWindowFocus);
    void checkNow();
  });
}

export function retryRewardedResult(requestId: string): Promise<RewardResult> {
  if (!requestId) {
    return Promise.resolve({ rewarded: false, source: "error", errorMessage: "No hay una recompensa pendiente para comprobar." });
  }
  return pollRewardResult(requestId);
}

export async function requestRewardedAd(placement: RewardedPlacement): Promise<RewardResult> {
  installResumeListener();
  if (typeof window === "undefined") return { rewarded: false, source: "error", errorMessage: "Window unavailable" };

  const requestId = makeRequestId();
  const playerId = pendingPlayerId || "guest";
  const origin = window.location.origin;
  const deepLink = `stopad://rewarded?requestId=${encodeURIComponent(requestId)}&placement=${encodeURIComponent(placement)}&playerId=${encodeURIComponent(playerId)}&origin=${encodeURIComponent(origin)}`;
  const resultPromise = pollRewardResult(requestId);

  try {
    // This navigation is executed directly from the user's "Ver anuncio" click.
    // Android routes the custom scheme to RewardedAdActivity, a real foreground Activity.
    window.location.href = deepLink;
  } catch {
    return { rewarded: false, source: "error", requestId, errorMessage: "Unable to launch native rewarded activity" };
  }
  return resultPromise;
}
