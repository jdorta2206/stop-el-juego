/**
 * Google Play Games Services v2 bridge for the Android TWA.
 *
 * This bridge is deliberately a no-op on web/iOS. Native calls are sent only
 * from the installed Android TWA and never participate in core game scoring.
 */
const ORIGIN = "https://www.stopjuegodepalabras.com";
type PgsStatus = { ok: boolean; status: string };

let initialized = false;
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

function post(type: string, extra: Record<string, string> = {}): boolean {
  if (!isAndroidTwa()) return false;
  try {
    // Android's TWA postMessage channel consumes JSON messages from this origin.
    window.postMessage(JSON.stringify({ type, ...extra }), ORIGIN);
    return true;
  } catch {
    return false;
  }
}

export function initTwaPlayGamesBridge(): void {
  if (typeof window === "undefined" || initialized) return;
  initialized = true;
  window.addEventListener("message", (event: MessageEvent) => {
    if (event.origin !== ORIGIN || typeof event.data !== "string") return;
    let payload: any;
    try { payload = JSON.parse(event.data); } catch { return; }
    if (payload?.type !== "STOP_PGS_STATUS_RESULT") return;
    lastStatus = {
      ok: payload.ok === true,
      status: typeof payload.status === "string" ? payload.status : "unknown",
    };
    window.dispatchEvent(new CustomEvent("stop:play-games-status", { detail: lastStatus }));
  });
  if (isAndroidTwa()) post("STOP_PGS_STATUS");
}

export function requestPlayGamesSignIn(): boolean {
  return post("STOP_PGS_SIGN_IN");
}

export function showPlayGamesAchievements(): boolean {
  return post("STOP_PGS_SHOW_ACHIEVEMENTS");
}

/**
 * Unlock a Play Games achievement by its configured Play Console ID.
 * Call only after the game has independently validated the earned milestone.
 */
export function unlockPlayGamesAchievement(achievementId: string): boolean {
  const id = achievementId.trim();
  if (!/^Cgk[A-Za-z0-9_-]{10,}$/.test(id)) return false;
  return post("STOP_PGS_UNLOCK_ACHIEVEMENT", { achievementId: id });
}

export function getLastPlayGamesStatus(): PgsStatus | null {
  return lastStatus;
}
