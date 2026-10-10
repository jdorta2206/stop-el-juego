/**
 * Google Play Games Services v2 bridge for the Android TWA.
 * Messages travel over the Custom Tabs MessagePort established by the native
 * TWA host. This is intentionally a no-op on ordinary web and iOS.
 */
const ORIGIN = "https://www.stopjuegodepalabras.com";
type PgsStatus = { ok: boolean; status: string };
type NativeMessage = { type: string; [key: string]: string };

let initialized = false;
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
  if (payload?.type !== "STOP_PGS_STATUS_RESULT") return;
  lastStatus = {
    ok: payload.ok === true,
    status: typeof payload.status === "string" ? payload.status : "unknown",
  };
  window.dispatchEvent(new CustomEvent("stop:play-games-status", { detail: lastStatus }));
}

function attachMessagePort(port: MessagePort): void {
  if (messagePort && messagePort !== port) messagePort.close();
  messagePort = port;
  messagePort.onmessage = (event: MessageEvent) => receiveNativeMessage(event.data);
  messagePort.start();
  const queued = pendingMessages;
  pendingMessages = [];
  for (const message of queued) messagePort.postMessage(JSON.stringify(message));
}

function post(type: string, extra: Record<string, string> = {}): boolean {
  if (!isAndroidTwa()) return false;
  const message = { type, ...extra };
  if (messagePort) {
    try { messagePort.postMessage(JSON.stringify(message)); return true; } catch { return false; }
  }
  // The native host sends STOP_AD_BRIDGE_READY through window.postMessage;
  // the first such event transfers the MessagePort. Queue requests until then.
  pendingMessages.push(message);
  return true;
}

export function initTwaPlayGamesBridge(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  if (!isAndroidTwa()) return;
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== ORIGIN) return;
    const port = event.ports?.[0];
    if (port) {
      attachMessagePort(port);
      return;
    }
    // Never treat arbitrary window messages as native commands or status.
    // TWA messages after handshake are delivered only over the MessagePort.
  });
  // Queue status until native host opens the channel and transfers its port.
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
