import type { Request } from "express";
import { verifyClaimedIdentity } from "./playerAuth";

/** Minimal player shape needed to authorize room actions. */
export interface RoomMemberLike {
  playerId?: unknown;
  isBot?: unknown;
}

/**
 * Parse the persisted room member list defensively. Invalid/corrupt data is
 * treated as an empty membership list rather than being trusted.
 */
export function parseRoomMembers(json: string | null | undefined): RoomMemberLike[] {
  if (!json) return [];
  try {
    const parsed: unknown = JSON.parse(json);
    if (!Array.isArray(parsed) || parsed.length > 32) return [];
    return parsed.filter((player): player is RoomMemberLike => {
      if (!player || typeof player !== "object" || Array.isArray(player)) return false;
      const value = player as Record<string, unknown>;
      return typeof value.playerId === "string" && value.playerId.length > 0 && value.playerId.length <= 128;
    });
  } catch (error) {
    console.warn("Could not parse room membership", error);
    return [];
  }
}

/**
 * Authorize a claimed player for a room action.
 *
 * Membership is always checked against the server-persisted room member list.
 * Logged-in identities are additionally cryptographically bound to the
 * request by verifyClaimedIdentity. Guest IDs remain supported by design.
 * Bots can never authenticate as callers.
 */
export function isAuthorizedRoomMember(
  req: Request,
  playersJson: string | null | undefined,
  claimedPlayerId: string | null | undefined,
): boolean {
  if (!claimedPlayerId || claimedPlayerId.length > 128) return false;
  const members = parseRoomMembers(playersJson);
  const member = members.find((player) => player.playerId === claimedPlayerId);
  if (!member || member.isBot === true) return false;
  return verifyClaimedIdentity(req, claimedPlayerId);
}

/** Host authorization using the persisted host id plus caller identity. */
export function isAuthorizedRoomHost(
  req: Request,
  playersJson: string | null | undefined,
  hostId: string | null | undefined,
  claimedPlayerId: string | null | undefined,
): boolean {
  if (!hostId || !claimedPlayerId || hostId !== claimedPlayerId) return false;
  return isAuthorizedRoomMember(req, playersJson, claimedPlayerId);
}
