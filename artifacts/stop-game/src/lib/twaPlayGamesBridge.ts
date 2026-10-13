/**
 * Google Play Games Services v2 bridge for the Android TWA.
 * Uses the Custom Tabs MessagePort supplied by the native host; ordinary web and iOS are no-ops.
 */
const ALLOWED_ORIGINS = new Set([
  "https://www.stopjuegodepalabras.com",
  "https://stopjuegodepalabras.com",
]);
type PgsStatus = { ok: boolean; status: string };
type NativeMessage = { type: string; [key: string]: string };

let initialized = false;
let channelReady = false;
let messagePort: MessagePort | null = null;
let pendingMessages: NativeMessage[] = [];
let lastStatus: PgsStatus | null = null;

export function isAndroidTwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "googleplay-twa" || params.get("source") === "twa" ||
        document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa")) {
      return true;
    }
    // Older Play Store builds do not yet include the launchUrl marker. Some
    // Android TWA/Chrome versions also report display-mode "browser" and omit
    // the app referrer, so requiring standalone mode hides the status card in
    // the actual installed app. Restrict this fallback to Android; the native
    // message channel remains the authority for whether Play Games is available.
    return /Android/i.test(navigator.userAgent);
  } catch {
    return false;
  }
}

function receiveNativeMessage(raw: unknown): void {
  if (typeof raw !== "string") return;
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return; }
  if (payload?.type === "STOP_AD_BRIDGE_READY") {
    const wasReady = channelReady;
    channelReady = messagePort !== null;
    if (channelReady) {
      const queued = pendingMessages;
      pendingMessages = [];
      for (const message of queued) send(message);

      // The native startup auth-state check can finish before the Custom Tabs
      // channel is ready, so its status reply may be lost. Request a fresh
      // snapshot once the web listener and message port are both ready.
      if (!wasReady) post("STOP_PGS_STATUS");
    }
    return;
  }
  if (payload?.type !== "STOP_PGS_STATUS_RESULT") return;
  lastStatus = {
    ok: payload.ok === true,
    status: typeof payload.status === "string" ? payload.status : "unknown",
  };
  window.dispatchEvent(new CustomEvent("stop:play-games-status", { detail: lastStatus }));
}

function send(message: NativeMessage): boolean {
  if (!messagePort || !channelReady) return false;
  try {
    messagePort.postMessage(JSON.stringify(message));
    return true;
  } catch {
    channelReady = false;
    messagePort = null;
    return false;
  }
}

function post(type: string, extra: Record<string, string> = {}): boolean {
  if (!isAndroidTwa()) return false;
  const message = { type, ...extra, origin: window.location.origin };
  if (!channelReady || !messagePort) {
    // If the player taps sign-in before Android finishes opening the MessagePort,
    // do not queue duplicate explicit sign-in requests.
    if (type === "STOP_PGS_SIGN_IN" &&
        pendingMessages.some((pending) => pending.type === "STOP_PGS_SIGN_IN")) {
      return true;
    }
    // Status refreshes are snapshots, so only the newest queued refresh matters.
    if (type === "STOP_PGS_STATUS") {
      pendingMessages = pendingMessages.filter((pending) => pending.type !== "STOP_PGS_STATUS");
    }
    pendingMessages.push(message);
    return true;
  }
  return send(message);
}

export function initTwaPlayGamesBridge(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  if (!isAndroidTwa()) return;
  window.addEventListener("message", (event: MessageEvent) => {
    if (!ALLOWED_ORIGINS.has(event.origin)) return;
    const transferredPort = event.ports?.[0];
    if (transferredPort) {
      messagePort = transferredPort;
      messagePort.onmessage = (portEvent: MessageEvent) => receiveNativeMessage(portEvent.data);
      messagePort.start?.();
    }
    receiveNativeMessage(event.data);
  });
  // Surface an explicit startup state immediately, rather than leaving the
  // home screen looking disconnected while native Play Games checks auth state.
  lastStatus = { ok: false, status: "conectando" };
  window.dispatchEvent(new CustomEvent("stop:play-games-status", { detail: lastStatus }));
  // Startup is deliberately non-interactive. Sign-in is only requested after an
  // explicit player action; the status snapshot reconciles the UI when the channel opens.

  // The Play Games account can change while Android backgrounds the TWA.
  // Refresh status when the player returns so the UI does not keep stale auth state.
  const refreshStatus = () => {
    if (document.visibilityState === "visible") post("STOP_PGS_STATUS");
  };
  document.addEventListener("visibilitychange", refreshStatus);
  window.addEventListener("focus", refreshStatus);
}

export function requestPlayGamesSignIn(): boolean {
  return post("STOP_PGS_SIGN_IN");
}

export function showPlayGamesAchievements(): boolean {
  return post("STOP_PGS_SHOW_ACHIEVEMENTS");
}

/** Call only after the game independently validates the earned milestone. */
export function unlockPlayGamesAchievement(achievementId: string): boolean {
  const id = achievementId.trim();
  if (!/^Cgk[A-Za-z0-9_-]{10,}$/.test(id)) return false;
  return post("STOP_PGS_UNLOCK_ACHIEVEMENT", { achievementId: id });
}

/** Published Google Play Games achievement IDs from the STOP game-services project. */
const PLAY_GAMES_ACHIEVEMENT_IDS: Record<string, string> = {
  first_win: "CgkIlrPSvaAaEAIQAQ",
  combo3: "CgkIlrPSvaAaEAIQGg",
  speed_demon: "CgkIlrPSvaAaEAIQEw",
  chaos_master: "CgkIlrPSvaAaEAIQEQ",
  wordsmith: "CgkIlrPSvaAaEAIQGA",
  veteran: "CgkIlrPSvaAaEAIQHA",
  champion: "CgkIlrPSvaAaEAIQGw",
  unstoppable: "CgkIlrPSvaAaEAIQEA",
  streak_3: "CgkIlrPSvaAaEAIQFQ",
  streak_7: "CgkIlrPSvaAaEAIQEg",
  streak_14: "CgkIlrPSvaAaEAIQGQ",
  streak_30: "CgkIlrPSvaAaEAIQFw",
  creator: "CgkIlrPSvaAaEAIQFg",
  viral: "CgkIlrPSvaAaEAIQFA",
  shutout: "CgkIlrPSvaAaEAIQHQ",
};

export function unlockPlayGamesAchievementForMilestone(milestoneId: string): boolean {
  const achievementId = PLAY_GAMES_ACHIEVEMENT_IDS[milestoneId];
  return achievementId ? unlockPlayGamesAchievement(achievementId) : false;
}

export function getLastPlayGamesStatus(): PgsStatus | null {
  return lastStatus;
}
