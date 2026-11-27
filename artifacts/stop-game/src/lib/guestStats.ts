import { getApiUrl } from "@/lib/utils";

const API_BASE = getApiUrl();

// Fire-and-forget, anonymous guest counters. These never block the game and
// never send any per-user data — they just bump a daily aggregate on the server.
function createEventId(): string {
  try {
    if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") return crypto.randomUUID();
  } catch { /* use a non-cryptographic fallback for anonymous analytics only */ }
  return `guest-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 14)}`;
}

function ping(path: string) {
  try {
    void fetch(`${API_BASE}/api/guest-stats/${path}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ eventId: createEventId() }),
      keepalive: true,
    }).catch(() => {});
  } catch {
    /* ignore — analytics must never break gameplay */
  }
}

/** A guest (not-logged-in) player finished a game. */
export function trackGuestGame() {
  ping("game");
}

/** A guest tapped the end-of-game "sign in & save" CTA. */
export function trackGuestConversion() {
  ping("conversion");
}
