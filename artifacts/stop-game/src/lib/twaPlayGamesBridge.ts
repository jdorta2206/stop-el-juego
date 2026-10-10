/**
 * Google Play Games Services v2 bridge for the Android TWA.
 * Uses the existing Custom Tabs postMessage channel; ordinary web and iOS are no-ops.
 */
const ORIGIN = "https://www.stopjuegodepalabras.com";
type PgsStatus = { ok: boolean; status: string };
type NativeMessage = { type: string; [key: string]: string };

let initialized = false;
let channelReady = false;
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
    channelReady = true;
    const queued = pendingMessages;
    pendingMessages = [];
    for (const message of queued) send(message);
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
  try {
    // CustomTabsSession.postMessage delivers native messages as window message
    // events. The reverse direction uses the page's window.postMessage API.
    window.postMessage(JSON.stringify(message), ORIGIN);
    return true;
  } catch {
    return false;
  }
}

function post(type: string, extra: Record<string, string> = {}): boolean {
  if (!isAndroidTwa()) return false;
  const message = { type, ...extra };
  if (!channelReady) {
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
    receiveNativeMessage(event.data);
  });
  // Native host sends readiness repeatedly while the TWA message channel opens.
  post("STOP_PGS_STATUS");
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

export function getLastPlayGamesStatus(): PgsStatus | null {
  return lastStatus;
}
