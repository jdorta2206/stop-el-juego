/**
 * Happy Hour — daily 21:00-22:00 local-time event.
 *
 * Mechanics:
 *  - During the active window, every score submission grants x2 XP and x2
 *    coins for that player. Server is the source of truth — clients can't
 *    fake their local time.
 *  - Three timezone-aware push notifications fire per day per player:
 *      pre  (20:45 local)  → "starts in 15 min"
 *      live (21:00 local)  → "ACTIVE now"
 *      last (21:50 local)  → "10 min left"
 *  - Each player's local time is derived from their stored tz_offset_minutes
 *    on push_subscriptions (set by the client at subscribe time via
 *    `new Date().getTimezoneOffset() * -1`). Players without a subscription
 *    fall back to UTC (no bonus, no notif) — implicit nudge to opt in.
 */

export const HAPPY_HOUR_START_LOCAL_MIN = 21 * 60;   // 21:00 local
export const HAPPY_HOUR_DURATION_MIN = 60;
export const HAPPY_HOUR_END_LOCAL_MIN =
  HAPPY_HOUR_START_LOCAL_MIN + HAPPY_HOUR_DURATION_MIN;
export const HAPPY_HOUR_MULTIPLIER = 2;

/** Pre/live/last-call local minutes-of-day for the cron to match against. */
export const HAPPY_HOUR_PRE_LOCAL_MIN = HAPPY_HOUR_START_LOCAL_MIN - 15;  // 20:45
export const HAPPY_HOUR_LIVE_LOCAL_MIN = HAPPY_HOUR_START_LOCAL_MIN;      // 21:00
export const HAPPY_HOUR_LAST_LOCAL_MIN = HAPPY_HOUR_END_LOCAL_MIN - 10;   // 21:50

/** Convert (now UTC + tz offset) to local minutes-of-day in [0, 1440). */
function localMinutesOfDay(tzOffsetMinutes: number, nowMs: number): number {
  const d = new Date(nowMs);
  const utcMin = d.getUTCHours() * 60 + d.getUTCMinutes();
  return ((utcMin + tzOffsetMinutes) % 1440 + 1440) % 1440;
}

export function isHappyHourActiveForTzOffset(
  tzOffsetMinutes: number,
  nowMs: number = Date.now(),
): boolean {
  const m = localMinutesOfDay(tzOffsetMinutes, nowMs);
  return m >= HAPPY_HOUR_START_LOCAL_MIN && m < HAPPY_HOUR_END_LOCAL_MIN;
}

/**
 * Returns the UTC ms boundaries of the NEXT (or currently-active) Happy Hour
 * window for a given tz offset. Used by the frontend countdown.
 *
 * Implementation note: we anchor on the player's *local* minute-of-day, not
 * on UTC midnight. Anchoring on UTC midnight breaks for negative offsets
 * (e.g. America/Argentina at 02:00 UTC = 23:00 prev local day) because the
 * UTC date and the local date disagree there — the function would point to
 * tomorrow's window while the player is actually inside today's window.
 * Computing from "minutes-from-now to today's local 21:00" sidesteps the
 * UTC-vs-local-date ambiguity entirely.
 */
export function getHappyHourWindowUtcMs(
  tzOffsetMinutes: number,
  nowMs: number = Date.now(),
): { startsAtUtcMs: number; endsAtUtcMs: number; active: boolean } {
  const d = new Date(nowMs);
  // Fractional local minute-of-day so seconds carry into the countdown.
  const utcMinFrac =
    d.getUTCHours() * 60 +
    d.getUTCMinutes() +
    d.getUTCSeconds() / 60 +
    d.getUTCMilliseconds() / 60_000;
  const localMinFrac = ((utcMinFrac + tzOffsetMinutes) % 1440 + 1440) % 1440;

  // Minutes from now to today's local 21:00 (negative if already past).
  const minsToStart = HAPPY_HOUR_START_LOCAL_MIN - localMinFrac;
  let startsAtUtcMs = nowMs + minsToStart * 60_000;
  let endsAtUtcMs = startsAtUtcMs + HAPPY_HOUR_DURATION_MIN * 60_000;
  // If today's window already ended, roll to tomorrow.
  if (nowMs >= endsAtUtcMs) {
    startsAtUtcMs += 86_400_000;
    endsAtUtcMs += 86_400_000;
  }
  return {
    startsAtUtcMs,
    endsAtUtcMs,
    active: nowMs >= startsAtUtcMs && nowMs < endsAtUtcMs,
  };
}
