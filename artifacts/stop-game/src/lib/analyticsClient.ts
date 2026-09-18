const STORAGE_KEY = "stop_player_v2";
function platform(): "web" | "android" | "ios" {
  if (typeof window === "undefined") return "web";
  try {
    if (/iphone|ipad|ipod/i.test(navigator.userAgent)) return "ios";
    if (document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa") ||
        new URLSearchParams(window.location.search).get("source") === "googleplay-twa" ||
        !!localStorage.getItem("stop_installed_app_version")) return "android";
  } catch {}
  return "web";
}
function sessionId(): string | null {
  try { return sessionStorage.getItem(`stop_analytics_session_id_${platform()}`); } catch { return null; }
}
export function trackAnalyticsEvent(eventName: string, options?: { mode?: string; aiDifficulty?: string; metadata?: Record<string, unknown> }): void {
  if (typeof window === "undefined") return;
  try {
    let playerId: string | null = null;
    let loginMethod: string | null = null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const player = JSON.parse(raw);
      if (typeof player?.id === "string") playerId = player.id;
      if (typeof player?.loginMethod === "string") loginMethod = player.loginMethod;
    }
    void fetch(`${window.location.origin}/api/analytics/event`, {
      method: "POST", headers: { "Content-Type": "application/json", "X-Client-Platform": platform() },
      body: JSON.stringify({ eventName, playerId, sessionId: sessionId(), language: document.documentElement.lang || null,
        mode: options?.mode ?? null, aiDifficulty: options?.aiDifficulty ?? null,
        metadata: { ...(options?.metadata ?? {}), loginMethod } }), keepalive: true
    }).catch(() => {});
  } catch {}
}
