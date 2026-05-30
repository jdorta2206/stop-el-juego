import { getApiUrl } from "@/lib/utils";

const API_BASE = getApiUrl();

// Fire-and-forget, anonymous guest counters. These never block the game and
// never send any per-user data — they just bump a daily aggregate on the server.
function ping(path: string) {
  try {
    void fetch(`${API_BASE}/api/guest-stats/${path}`, {
      method: "POST",
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
