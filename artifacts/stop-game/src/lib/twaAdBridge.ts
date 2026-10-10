const RESULT_BASE = "/api/rewards/admob-result";
// SSV callbacks can arrive after the ad has already been dismissed.
// Keep the web-side request alive long enough to reconcile a delayed callback.
// The native Activity can keep the ad visible well beyond the initial load.
// Do not resume/close the game while a real rewarded ad is still in progress.
const RESULT_TIMEOUT_MS = 300_000;

type RewardedPlacement = "extra_time" | "hint" | "double_points" | "skip_round" | "extra_pack";
type RewardResult = { rewarded: boolean; source: "admob" | "client" | "skipped" | "error"; errorCode?: number; errorDomain?: string; errorMessage?: string };

let initialized = false;
let messageChannelReady = false;
let pendingPlayerId = "guest";
const queuedAchievementKeys = new Set<string>();

export function setRewardedAdPlayerId(playerId: string | undefined): void {
  pendingPlayerId = playerId || "guest";
}

const PGS_ALLOWED_ORIGINS = new Set([
  "https://www.stopjuegodepalabras.com",
  "https://stopjuegodepalabras.com",
]);
const PGS_ACHIEVEMENT_KEYS = new Set([
  "first_win", "combo3", "speed_demon", "chaos_master", "wordsmith",
  "veteran", "champion", "unstoppable", "streak_3", "streak_7",
  "streak_14", "streak_30", "creator", "viral", "shutout",
]);

function isAllowedPageOrigin(): boolean {
  return typeof window !== "undefined" && PGS_ALLOWED_ORIGINS.has(window.location.origin);
}

function sendAchievementRequest(achievementKey: string): boolean {
  if (typeof window === "undefined" || !messageChannelReady || !isAllowedPageOrigin()) return false;
  if (!PGS_ACHIEVEMENT_KEYS.has(achievementKey)) return false;
  try {
    // Android receives this via CustomTabsCallback.onPostMessage. This is a
    // non-navigational message; it must never change location or interrupt play.
    window.postMessage(JSON.stringify({
      type: "STOP_PGS_UNLOCK_ACHIEVEMENT",
      origin: window.location.origin,
      achievementKey,
    }), window.location.origin);
    return true;
  } catch {
    return false;
  }
}

function handleNativeBridgeMessage(event: MessageEvent): void {
  if (!isAllowedPageOrigin()) return;
  const raw = event.data;
  let message: unknown = raw;
  if (typeof raw === "string") {
    try { message = JSON.parse(raw); } catch { return; }
  }
  if (!message || typeof message !== "object") return;
  const type = (message as { type?: unknown }).type;
  if (type !== "STOP_AD_BRIDGE_READY") return;
  messageChannelReady = true;

  // Retry only achievements queued by real local achievement events. A Set
  // deduplicates repeat events while the channel is becoming ready.
  for (const key of queuedAchievementKeys) {
    if (sendAchievementRequest(key)) queuedAchievementKeys.delete(key);
  }
}

function installResumeListener(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  window.addEventListener("message", handleNativeBridgeMessage);
}

export function initTwaAdBridge(): void {
  installResumeListener();
}

/**
 * Best-effort reporting to the native TWA bridge. STOP progression is already
 * persisted locally/server-side before this is called; PGS failure is ignored.
 * Never sends arbitrary Play Console IDs: only known internal achievement keys.
 */
export function reportGooglePlayAchievement(achievementKey: string): void {
  if (typeof window === "undefined" || !PGS_ACHIEVEMENT_KEYS.has(achievementKey)) return;
  if (sendAchievementRequest(achievementKey)) return;
  // Queue only in the official STOP origin; never let a web mirror queue actions
  // that might later be sent if it is navigated into a TWA context.
  if (isAllowedPageOrigin()) queuedAchievementKeys.add(achievementKey);
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
      ? { rewarded: true, source: data.source === "client" ? "client" : "admob" }
      : { rewarded: false, source: "skipped" };
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

export async function requestRewardedAd(placement: RewardedPlacement): Promise<RewardResult> {
  installResumeListener();
  if (typeof window === "undefined") return { rewarded: false, source: "error", errorMessage: "Window unavailable" };

  const requestId = makeRequestId();
  const playerId = pendingPlayerId || "guest";
  const origin = window.location.origin;
  const deepLink = `stopad://rewarded?requestId=${encodeURIComponent(requestId)}&placement=${encodeURIComponent(placement)}&playerId=${encodeURIComponent(playerId)}&origin=${encodeURIComponent(origin)}`;

  return new Promise<RewardResult>((resolve) => {
    let finished = false;
    let checkInFlight = false;
    const startedAt = Date.now();
    let timer: number | null = null;
    let deadlineTimer: number | null = null;

    const checkNow = async () => {
      if (finished || checkInFlight) return;
      checkInFlight = true;
      try {
        const result = await readResult(requestId);
        if (result) finish(result);
        else if (Date.now() - startedAt >= RESULT_TIMEOUT_MS) {
          finish({ rewarded: false, source: "error", errorMessage: "Native rewarded ad request timed out" });
        }
      } finally {
        checkInFlight = false;
      }
    };

    const finish = (result: RewardResult) => {
      if (finished) return;
      finished = true;
      if (timer !== null) window.clearInterval(timer);
      if (deadlineTimer !== null) window.clearTimeout(deadlineTimer);
      document.removeEventListener("visibilitychange", checkNow);
      window.removeEventListener("focus", checkNow);
      if (result.rewarded) void acknowledgeRewardResult(requestId);
      resolve(result);
    };

    timer = window.setInterval(checkNow, 1500);
    deadlineTimer = window.setTimeout(() => {
      finish({ rewarded: false, source: "error", errorMessage: "Native rewarded ad request timed out" });
    }, RESULT_TIMEOUT_MS);
    document.addEventListener("visibilitychange", checkNow);
    window.addEventListener("focus", checkNow);

    try {
      // This navigation is executed directly from the user's "Ver anuncio" click.
      // Android routes the custom scheme to RewardedAdActivity, which is a real
      // foreground Activity and therefore a valid host for RewardedAd.show().
      window.location.href = deepLink;
    } catch {
      finish({ rewarded: false, source: "error", errorMessage: "Unable to launch native rewarded activity" });
    }
  });
}
