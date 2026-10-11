/**
 * Google Play Games Services v2 bridge for the Android TWA.
 * Uses the Custom Tabs MessagePort supplied by the native host; ordinary web and iOS are no-ops.
 */
const ORIGIN = "https://www.stopjuegodepalabras.com";
type PgsStatus = { ok: boolean; status: string };
type NativeMessage = { type: string; [key: string]: string };

let initialized = false;
let channelReady = false;
let messagePort: MessagePort | null = null;
let pendingMessages: NativeMessage[] = [];
let lastStatus: PgsStatus | null = null;

function isAndroidTwa(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    return params.get("source") === "googleplay-twa" ||
      params.get("source") === "twa" ||
      document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa");
  } catch {
    return false;
  }
}

function receiveNativeMessage(raw: unknown): void {
  if (typeof raw !== "string") return;
  let payload: any;
  try { payload = JSON.parse(raw); } catch { return; }
  if (payload?.type === "STOP_AD_BRIDGE_READY") {
    channelReady = messagePort !== null;
    if (channelReady) {
      const queued = pendingMessages;
      pendingMessages = [];
      for (const message of queued) send(message);
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
    // TWA Custom Tabs messaging is a MessagePort channel. window.postMessage()
    // alone only posts to this page; it does not deliver the request to Android.
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
  const message = { type, ...extra };
  if (!channelReady || !messagePort) {
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
    if (event.origin !== ORIGIN) return;
    // Chrome transfers the native-to-web MessagePort with the first host message.
    const transferredPort = event.ports?.[0];
    if (transferredPort) {
      messagePort = transferredPort;
      messagePort.onmessage = (portEvent: MessageEvent) => receiveNativeMessage(portEvent.data);
      messagePort.start?.();
    }
    receiveNativeMessage(event.data);
  });
  // Start the Google Play Games connection on app entry. The native side checks
  // existing authentication first and only invokes the SDK sign-in flow when needed.
  // Queue until the host transfers its MessagePort; this never blocks game startup.
  post("STOP_PGS_SIGN_IN");
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

/** Maps an internal STOP achievement key to its published Play Games ID. */
export function unlockPlayGamesAchievementForMilestone(milestoneId: string): boolean {
  const achievementId = PLAY_GAMES_ACHIEVEMENT_IDS[milestoneId];
  return achievementId ? unlockPlayGamesAchievement(achievementId) : false;
}

export function getLastPlayGamesStatus(): PgsStatus | null {
  return lastStatus;
}
