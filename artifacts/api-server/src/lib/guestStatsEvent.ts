export function isGuestStatsEventId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9._:-]{8,160}$/.test(value);
}
