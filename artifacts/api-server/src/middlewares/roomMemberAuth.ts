import type { NextFunction, Request, Response } from "express";
import { db, roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

/**
 * Defense-in-depth authorization for room endpoints whose handlers accept a
 * playerId from the request. The individual handlers still validate their
 * own game-specific rules; this middleware prevents a caller from borrowing
 * another player's identity simply by knowing the room code and playerId.
 *
 * Guests remain supported: verifyClaimedIdentity intentionally allows guest
 * ids through, while OAuth-style ids must match the signed session token.
 */
export async function requireRoomMemberIdentity(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const match = req.path.match(/^\/([^/]+)\/(draft|spy|funvote|rematch|events)$/i);
  if (!match) {
    next();
    return;
  }

  const roomCode = decodeURIComponent(match[1]).toUpperCase();
  const endpoint = match[2].toLowerCase();
  const rawPlayerId = endpoint === "events"
    ? req.query.playerId
    : endpoint === "draft"
      ? req.query.playerId
      : req.body?.playerId;
  const playerId = typeof rawPlayerId === "string" ? rawPlayerId.trim() : "";

  if (!playerId) {
    res.status(400).json({ error: "playerId required" });
    return;
  }

  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const [room] = await db
    .select({ playersJson: roomsTable.playersJson })
    .from(roomsTable)
    .where(eq(roomsTable.roomCode, roomCode))
    .limit(1);

  if (!room) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  let players: unknown[] = [];
  try {
    const parsed = JSON.parse(room.playersJson || "[]");
    players = Array.isArray(parsed) ? parsed : [];
  } catch {
    res.status(500).json({ error: "Invalid room state" });
    return;
  }

  const isMember = players.some(
    (p: any) => p && typeof p.playerId === "string" && p.playerId === playerId,
  );

  if (!isMember) {
    res.status(403).json({ error: "Not a member of this room" });
    return;
  }

  next();
}
