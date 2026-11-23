export type AuthRestoreStatus = "pending" | "restored" | "unavailable";
export type DailyStatusRequestMode = "wait" | "local" | "server";

/**
 * Only request the server-authoritative daily status after a persisted account
 * session has been restored. Guests and offline/unavailable sessions keep the
 * existing local banner state without sending a stale authenticated request.
 */
export function getDailyStatusRequestMode(
  player: { loginMethod?: string | null } | null | undefined,
  authRestoreStatus: AuthRestoreStatus,
): DailyStatusRequestMode {
  if (!player || player.loginMethod === "guest") return "local";
  if (authRestoreStatus === "pending") return "wait";
  if (authRestoreStatus === "unavailable") return "local";
  return "server";
}
