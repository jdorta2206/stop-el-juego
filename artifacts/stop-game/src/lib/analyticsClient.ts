import { getInstalledAppVersion } from "./appVersion";
const STORAGE_KEY = "stop_player_v2";
const ANALYTICS_TWA_KEY = "stop_analytics_twa_v1";
function isTwa(): boolean {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "googleplay-twa" || params.get("source") === "twa") return true;
    if (document.referrer.startsWith("android-app://")) return true;
    if (localStorage.getItem(ANALYTICS_TWA_KEY) === "1") return true;
    return document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa");
  } catch { return false; }
}
function platform(): "web" | "android" | "ios" {
  if (typeof window === "undefined") return "web";
  try {
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
    if (isTwa() || !!localStorage.getItem("stop_installed_app_version")) return "android";
  } catch {}
  return "web";
}
function sessionId(): string | null {
  try { return sessionStorage.getItem(`stop_analytics_session_id_${platform()}`); } catch { return null; }
}
export function trackTrustedGameStart(options?: { mode?: string; language?: string | null }): void {
  if (typeof window === "undefined") return;
  try {
    const appVersion = getInstalledAppVersion();
    const token = (() => { try { return localStorage.getItem("stop_session_token") || sessionStorage.getItem("stop_session_token"); } catch { return null; } })();
    void fetch(`${window.location.origin}/api/analytics/game-start`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Platform": platform(),
        ...(isTwa() ? { "X-Client-TWA": "1" } : {}),
        ...(appVersion ? { "X-Client-Version": appVersion } : {}),
        ...(token ? { "X-Stop-Token": token } : {}),
      },
      body: JSON.stringify({
        mode: options?.mode ?? null,
        language: options?.language ?? (document.documentElement.lang || null),
      }),
      credentials: "include",
      keepalive: true,
    }).catch(() => {});
  } catch {}
}

export function trackAnalyticsEvent(eventName: string, options?: { mode?: string; aiDifficulty?: string; metadata?: Record<string, unknown> }): void {
  if (typeof window === "undefined") return;
  try {
    let playerId: string | null = null;
    let loginMethod: string | null = null;
    const appVersion = getInstalledAppVersion();
    const token = (() => { try { return localStorage.getItem("stop_session_token") || sessionStorage.getItem("stop_session_token"); } catch { return null; } })();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const player = JSON.parse(raw);
      if (typeof player?.id === "string") playerId = player.id;
      if (typeof player?.loginMethod === "string") loginMethod = player.loginMethod;
    }
    void fetch(`${window.location.origin}/api/analytics/event`, {
      method: "POST", headers: {
        "Content-Type": "application/json",
        "X-Client-Platform": platform(),
        ...(isTwa() ? { "X-Client-TWA": "1" } : {}),
        ...(appVersion ? { "X-Client-Version": appVersion } : {}),
        ...(token ? { "X-Stop-Token": token } : {}),
      },
      body: JSON.stringify({ eventName, playerId, sessionId: sessionId(), language: document.documentElement.lang || null,
        mode: options?.mode ?? null, aiDifficulty: options?.aiDifficulty ?? null,
        metadata: { ...(options?.metadata ?? {}), loginMethod } }), keepalive: true
    }).catch(() => {});
  } catch {}
}

export function trackClientError(error: unknown, componentStack?: string | null): void {
  if (typeof window === "undefined") return;
  try {
    const appVersion = getInstalledAppVersion();
    const token = (() => { try { return localStorage.getItem("stop_session_token") || sessionStorage.getItem("stop_session_token"); } catch { return null; } })();
    const value = error instanceof Error ? error : new Error(String(error));
    void fetch(`${window.location.origin}/api/analytics/client-error`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Client-Platform": platform(),
        ...(isTwa() ? { "X-Client-TWA": "1" } : {}),
        ...(appVersion ? { "X-Client-Version": appVersion } : {}),
        ...(token ? { "X-Stop-Token": token } : {}),
      },
      body: JSON.stringify({
        message: value.message.slice(0, 500),
        stack: value.stack?.slice(0, 2500) ?? null,
        componentStack: componentStack?.slice(0, 2500) ?? null,
        sessionId: sessionId(),
        language: document.documentElement.lang || null,
      }),
      keepalive: true,
    }).catch(() => {});
  } catch {}
}
