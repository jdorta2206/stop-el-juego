import { useEffect, useState } from "react";
import { getApiUrl } from "@/lib/utils";

const HAPPY_HOUR_START_LOCAL_MIN = 21 * 60;
const HAPPY_HOUR_DURATION_MIN = 60;
const HAPPY_HOUR_MULTIPLIER = 2;

export interface HappyHourState {
  active: boolean;
  startsAtUtcMs: number;
  endsAtUtcMs: number;
  msUntilStart: number;
  msUntilEnd: number;
  multiplier: number;
}

/**
 * Computes the Happy Hour window locally (no network) so the banner can
 * tick down second-by-second without spamming the API. Mirror of the
 * server-side `getHappyHourWindowUtcMs` in lib/happyHour.ts — both must
 * stay in sync. We re-compute every second to drive the countdown.
 *
 * Note: we trust the user's clock for the *display*; the server still has
 * final say on whether x2 actually applies when the score is submitted.
 */
function computeWindow(nowMs: number): HappyHourState {
  const d = new Date(nowMs);
  const tzOffsetMinutes = -d.getTimezoneOffset();
  // Anchor on local minute-of-day (not UTC midnight) so the window is
  // correct for negative-offset locales near UTC midnight. Mirror of
  // server-side `getHappyHourWindowUtcMs` in api-server/src/lib/happyHour.ts.
  const utcMinFrac =
    d.getUTCHours() * 60 +
    d.getUTCMinutes() +
    d.getUTCSeconds() / 60 +
    d.getUTCMilliseconds() / 60_000;
  const localMinFrac = ((utcMinFrac + tzOffsetMinutes) % 1440 + 1440) % 1440;
  const minsToStart = HAPPY_HOUR_START_LOCAL_MIN - localMinFrac;
  let startsAtUtcMs = nowMs + minsToStart * 60_000;
  let endsAtUtcMs = startsAtUtcMs + HAPPY_HOUR_DURATION_MIN * 60_000;
  if (nowMs >= endsAtUtcMs) {
    startsAtUtcMs += 86_400_000;
    endsAtUtcMs += 86_400_000;
  }
  const active = nowMs >= startsAtUtcMs && nowMs < endsAtUtcMs;
  return {
    active,
    startsAtUtcMs,
    endsAtUtcMs,
    msUntilStart: Math.max(0, startsAtUtcMs - nowMs),
    msUntilEnd: Math.max(0, endsAtUtcMs - nowMs),
    multiplier: HAPPY_HOUR_MULTIPLIER,
  };
}

export function useHappyHour(): HappyHourState {
  const [state, setState] = useState<HappyHourState>(() => computeWindow(Date.now()));

  useEffect(() => {
    // Tick every second while active (countdown), every 30 s otherwise to save battery.
    let id: number;
    const tick = () => {
      const next = computeWindow(Date.now());
      setState(next);
      const interval = next.active ? 1000 : 30_000;
      id = window.setTimeout(tick, interval);
    };
    id = window.setTimeout(tick, 1000);
    return () => window.clearTimeout(id);
  }, []);

  return state;
}

export function formatCountdown(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  return `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * Read-only helper: returns the current happy-hour state once, without React.
 * Used by post-game toasts that need a snapshot at score-submit time.
 */
export function getHappyHourSnapshot(): HappyHourState {
  return computeWindow(Date.now());
}
