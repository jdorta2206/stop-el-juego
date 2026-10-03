/**
 * Central runtime gate for advertising.
 *
 * Google AdMob has temporarily suspended this account through 31 Oct 2026.
 * Keep every ad format disabled until 1 Nov 2026 00:00 UTC, then let the
 * normal ad configuration resume automatically.
 *
 * This is a safety gate, not a way to bypass Google's enforcement.
 */
export const ADS_SUSPENSION_END_MS = Date.UTC(2026, 10, 1, 0, 0, 0);

export function areAdsTemporarilySuspended(now = Date.now()): boolean {
  return now < ADS_SUSPENSION_END_MS;
}
