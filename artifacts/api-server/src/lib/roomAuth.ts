import crypto from "crypto";
import type { Request } from "express";
import { db, roomMembersTable, roomsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";
import { readPlayerId, verifyClaimedIdentity } from "./playerAuth.js";

const ROOM_CREDENTIAL_BYTES = 32;

/** Generate a credential that is returned only to the member who created/joined the room. */
export function generateRoomMemberCredential(): string {
  return crypto.randomBytes(ROOM_CREDENTIAL_BYTES).toString("base64url");
}

/** Store only a SHA-256 digest; the bearer credential itself never reaches the database. */
export function hashRoomMemberCredential(credential: string): string {
  return crypto.createHash("sha256").update(credential, "utf8").digest("hex");
}

function credentialFromRequest(req: Request): string | null {
  const raw = req.headers["x-room-credential"];
  return typeof raw === "string" && raw.length >= 32 ? raw : null;
}

/**
 * Guest-safe room membership check.
 * Logged-in accounts must also have a valid signed account token.
 * Guests additionally need the private per-room credential.
 */
export async function requireRoomMember(
  req: Request,
  roomCode: string,
  playerId: string,
): Promise<boolean> {
  if (!playerId || !verifyClaimedIdentity(req, playerId)) return false;

  const roomRows = await db.select({
    id: roomsTable.id,
  }).from(roomsTable).where(eq(roomsTable.roomCode, roomCode)).limit(1);
  if (!roomRows.length) return false;

  const memberRows = await db.select({
    credentialHash: roomMembersTable.credentialHash,
  }).from(roomMembersTable).where(and(
    eq(roomMembersTable.roomId, roomRows[0].id),
    eq(roomMembersTable.playerId, playerId),
  )).limit(1);
  if (!memberRows.length) return false;

  const credential = credentialFromRequest(req);
  if (!credential) return false;

  const expected = hashRoomMemberCredential(credential);
  const supplied = Buffer.from(expected, "hex");
  const stored = Buffer.from(memberRows[0].credentialHash, "hex");
  return supplied.length === stored.length && crypto.timingSafeEqual(supplied, stored);
}

/** Host authorization builds on membership, so knowing a guest hostId is no longer enough. */
export async function requireRoomHost(
  req: Request,
  roomCode: string,
  playerId: string,
): Promise<boolean> {
  if (!await requireRoomMember(req, roomCode, playerId)) return false;

  const rows = await db.select({ hostId: roomsTable.hostId })
    .from(roomsTable)
    .where(eq(roomsTable.roomCode, roomCode))
    .limit(1);
  return rows.length > 0 && rows[0].hostId === playerId;
}

/**
 * Resolve the authenticated player for endpoints that already carry a playerId.
 * Account users are verified cryptographically; guest callers remain guest IDs
 * and are authorized by requireRoomMember/requireRoomHost.
 */
export function requestPlayerId(req: Request, claimedId?: string | null): string | null {
  const signed = readPlayerId(req);
  if (signed) return signed;
  return claimedId ?? null;
}
