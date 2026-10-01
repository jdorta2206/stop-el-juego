import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { inArray } from "drizzle-orm";
import { roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sql } from "drizzle-orm";
import { sendPushToPlayer, notifyFollowersPlayerOnline } from "../lib/pushHelper";
import { presenceLimiter } from "../middlewares/rateLimit";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

// In-memory presence store: playerId → presence data
interface PresenceEntry {
  name: string;
  picture: string | null;
  avatarColor: string;
  provider: string | null;
  roomCode: string | null;
  lastSeen: number;
}

const presenceMap = new Map<string, PresenceEntry>();
// Presence is persisted so online state works correctly across Railway instances.
// The in-memory map remains a short-lived cache, not the source of truth.
const presenceTableReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS player_presence (
    player_id text PRIMARY KEY,
    room_code text,
    last_seen timestamptz NOT NULL DEFAULT NOW()
  )
`).then(() => db.execute(sql`
  CREATE INDEX IF NOT EXISTS player_presence_last_seen_idx
    ON player_presence (last_seen)
`)).catch((err) => {
  console.error("[presence] failed to initialize presence persistence:", err);
  throw err;
});

function playerIdProvider(playerId: string): string | null {
  const prefixes: Array<[string, string]> = [
    ["google_", "google"], ["fb_", "facebook"], ["instagram_", "instagram"],
    ["ig_", "instagram"], ["apple_", "apple"], ["tiktok_", "tiktok"], ["tt_", "tiktok"],
  ];
  return prefixes.find(([prefix]) => playerId.startsWith(prefix))?.[1] ?? null;
}

async function getCanonicalPresenceProfile(playerId: string) {
  const [profile] = await db.select({
    name: playerScoresTable.playerName,
    picture: playerScoresTable.profilePicture,
    avatarColor: playerScoresTable.avatarColor,
  }).from(playerScoresTable).where(eq(playerScoresTable.playerId, playerId)).limit(1);
  if (!profile) return null;
  const prefixes: Array<[string, string]> = [
    ["google_", "google"], ["fb_", "facebook"], ["instagram_", "instagram"],
    ["ig_", "instagram"], ["apple_", "apple"], ["tiktok_", "tiktok"], ["tt_", "tiktok"],
  ];
  const provider = prefixes.find(([prefix]) => playerId.startsWith(prefix))?.[1] ?? null;
  return { ...profile, provider };
}

// Challenges are persisted in PostgreSQL so pending state survives restarts
// and is shared by all Railway instances.
interface Challenge {
  challengeId: string;
  fromPlayerId: string;
  fromName: string;
  fromPicture: string | null;
  fromAvatarColor: string;
  toPlayerId: string;
  roomCode: string;
  status: "pending" | "accepted" | "declined";
  createdAt: number;
  isRoomInvite?: boolean;
}

const challengeTableReady = db.execute(sql`
  CREATE TABLE IF NOT EXISTS player_challenges (
    challenge_id text PRIMARY KEY,
    from_player_id text NOT NULL,
    from_name text NOT NULL,
    from_picture text,
    from_avatar_color text NOT NULL,
    to_player_id text NOT NULL,
    room_code text NOT NULL,
    status text NOT NULL DEFAULT 'pending',
    is_room_invite boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT NOW()
  )
`).then(() => db.execute(sql`
  CREATE INDEX IF NOT EXISTS player_challenges_target_status_idx
    ON player_challenges (to_player_id, status, created_at)
 `)).then(() => db.execute(sql`
  DELETE FROM player_challenges a
  USING player_challenges b
  WHERE a.status = 'pending'
    AND b.status = 'pending'
    AND a.from_player_id = b.from_player_id
    AND a.to_player_id = b.to_player_id
    AND a.is_room_invite = b.is_room_invite
    AND (a.created_at < b.created_at OR (a.created_at = b.created_at AND a.challenge_id < b.challenge_id))
`)).then(() => db.execute(sql`
  CREATE UNIQUE INDEX IF NOT EXISTS player_challenges_pending_pair_uidx
    ON player_challenges (from_player_id, to_player_id, is_room_invite)
    WHERE status = 'pending'
`)).catch((err) => {
  console.error("[presence] failed to initialize challenge persistence:", err);
  throw err;
});

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 4; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// Clean up stale entries every 2 minutes
setInterval(() => {
  const cutoff = Date.now() - 3 * 60 * 1000;
  for (const [id, data] of presenceMap) {
    if (data.lastSeen < cutoff) presenceMap.delete(id);
  }
  // Presence and challenges are shared PostgreSQL state; cleanup is safe on every instance.
  void Promise.all([
    presenceTableReady.then(() => db.execute(sql`
      DELETE FROM player_presence
      WHERE last_seen < NOW() - INTERVAL '3 minutes'
    `)),
    challengeTableReady.then(() => db.execute(sql`
      DELETE FROM player_challenges
      WHERE created_at < NOW() - INTERVAL '2 minutes'
    `)),
  ]).catch((err) => console.error("[presence] cleanup failed:", err));
}, 2 * 60 * 1000);

// POST /api/presence/ping
router.post("/ping", presenceLimiter, async (req, res) => {
  const { playerId, roomCode, language } = req.body as {
    playerId: string;
    roomCode?: string | null;
    language?: string;
  };

  if (!playerId) return res.status(400).json({ error: "playerId required" });
  if (!verifyClaimedIdentity(req, playerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }

  const profile = await getCanonicalPresenceProfile(playerId);
  if (!profile) return res.status(404).json({ error: "Player not found" });

  let canonicalRoomCode: string | null = null;
  if (roomCode) {
    const [room] = await db.select({
      roomCode: roomsTable.roomCode,
      playersJson: roomsTable.playersJson,
    }).from(roomsTable)
      .where(eq(roomsTable.roomCode, String(roomCode).trim().toUpperCase()))
      .limit(1);
    if (room) {
      try {
        const players = JSON.parse(room.playersJson || "[]");
        if (Array.isArray(players) && players.some((p: any) => p?.playerId === playerId)) {
          canonicalRoomCode = room.roomCode;
        }
      } catch {}
    }
  }

  await presenceTableReady;
  const [existingRow] = await db.execute(sql`
    SELECT last_seen
    FROM player_presence
    WHERE player_id = ${playerId}
    LIMIT 1
  `).then((result) => result.rows as Array<{ last_seen: string | Date }>);

  const lastSeenMs = existingRow ? new Date(existingRow.last_seen).getTime() : 0;
  const wasOffline = !existingRow || lastSeenMs < Date.now() - 3 * 60 * 1000;
  const now = new Date();

  await db.execute(sql`
    INSERT INTO player_presence (player_id, room_code, last_seen)
    VALUES (${playerId}, ${canonicalRoomCode}, ${now})
    ON CONFLICT (player_id) DO UPDATE
      SET room_code = EXCLUDED.room_code,
          last_seen = EXCLUDED.last_seen
  `);

  presenceMap.set(playerId, {
    ...profile,
    roomCode: canonicalRoomCode,
    lastSeen: now.getTime(),
  });

  if (wasOffline && profile.provider && profile.provider !== "guest") {
    notifyFollowersPlayerOnline(playerId, profile.name, language || "es").catch(() => {});
  }

  return res.json({ ok: true });
});

// GET /api/presence/online
router.get("/online", async (_req, res) => {
  const cutoff = new Date(Date.now() - 90 * 1000);
  await presenceTableReady;
  const rows = await db.execute(sql`
    SELECT player_id, room_code, last_seen
    FROM player_presence
    WHERE last_seen >= ${cutoff}
    ORDER BY last_seen DESC
  `);
  const presenceRows = rows.rows as Array<{
    player_id: string;
    room_code: string | null;
    last_seen: string | Date;
  }>;

  const ids = presenceRows.map((row) => row.player_id);
  if (ids.length === 0) return res.json({ online: [] });

  const profiles = await db.select({
    playerId: playerScoresTable.playerId,
    name: playerScoresTable.playerName,
    picture: playerScoresTable.profilePicture,
    avatarColor: playerScoresTable.avatarColor,
    equippedAvatar: playerScoresTable.equippedAvatar,
    equippedFrame: playerScoresTable.equippedFrame,
    equippedTitle: playerScoresTable.equippedTitle,
  }).from(playerScoresTable).where(inArray(playerScoresTable.playerId, ids));

  const byId = new Map(profiles.map((p) => [p.playerId, p]));
  const online = presenceRows.flatMap((row) => {
    const profile = byId.get(row.player_id);
    if (!profile) return [];
    return [{
      playerId: row.player_id,
      name: profile.name,
      picture: profile.picture ?? null,
      avatarColor: profile.avatarColor ?? "#e53e3e",
      provider: playerIdProvider(row.player_id),
      roomCode: row.room_code,
      lastSeen: new Date(row.last_seen).getTime(),
      equippedAvatar: profile.equippedAvatar ?? null,
      equippedFrame: profile.equippedFrame ?? null,
      equippedTitle: profile.equippedTitle ?? null,
    }];
  });

  return res.json({ online });
});

// POST /api/presence/challenge — send a challenge to another player
router.post("/challenge", async (req, res) => {
  const { fromPlayerId, fromName, fromPicture, fromAvatarColor, toPlayerId } = req.body as {
    fromPlayerId: string;
    fromName: string;
    fromPicture?: string | null;
    fromAvatarColor?: string;
    toPlayerId: string;
  };

  if (!fromPlayerId || !toPlayerId || !fromName) {
    return res.status(400).json({ error: "fromPlayerId, fromName and toPlayerId required" });
  }
  if (!verifyClaimedIdentity(req, fromPlayerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }

  const profile = await getCanonicalPresenceProfile(fromPlayerId);
  if (!profile) return res.status(404).json({ error: "Player not found" });

  // Check target player is online using shared PostgreSQL presence.
  await presenceTableReady;
  const targetRows = await db.execute(sql`
    SELECT player_id
    FROM player_presence
    WHERE player_id = ${toPlayerId}
      AND last_seen >= NOW() - INTERVAL '90 seconds'
    LIMIT 1
  `);
  if ((targetRows.rows as unknown[]).length === 0) {
    return res.status(404).json({ error: "Player is not online" });
  }

  await challengeTableReady;

  // Do not delete an existing pending challenge before creating a replacement
  // room. Two concurrent requests can otherwise both create rooms, with the
  // second request deleting the first challenge after the first response has
  // already handed its room code to the caller. The partial unique index below
  // is the concurrency authority: if another pending challenge wins, this
  // request deletes only its own newly-created room and returns the winner.
  const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${Math.random().toString(36).slice(2, 8)}`;

  // Room codes are UNIQUE in the database. Reserve the room before publishing
  // the challenge, retrying only on a genuine uniqueness collision. This avoids
  // a challenge pointing at a room that was never created.
  const players = [{
    playerId: fromPlayerId,
    playerName: profile.name,
    avatarColor: profile.avatarColor ?? "#e53e3e",
    loginMethod: null as string | null,
    score: 0,
    roundScore: 0,
    isHost: true,
    isReady: false,
  }];

  let roomCode: string | null = null;
  for (let attempt = 0; attempt < 10 && !roomCode; attempt++) {
    const candidate = generateRoomCode();
    try {
      await db.insert(roomsTable).values({
        roomCode: candidate,
        hostId: fromPlayerId,
        hostName: profile.name,
        status: "waiting",
        currentRound: 0,
        maxRounds: 3,
        language: "es",
        playersJson: JSON.stringify(players),
        stopperJson: null,
        isPublic: false,
      });
      roomCode = candidate;
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : String(e);
      if (!/unique|duplicate/i.test(message) || attempt === 9) {
        console.error("[presence/challenge] room creation failed:", message);
        return res.status(503).json({ error: "Unable to create challenge room" });
      }
    }
  }

  if (!roomCode) {
    return res.status(503).json({ error: "Unable to allocate challenge room" });
  }

  try {
    const inserted = await db.execute(sql`
      INSERT INTO player_challenges
        (challenge_id, from_player_id, from_name, from_picture, from_avatar_color,
         to_player_id, room_code, status, is_room_invite, created_at)
      VALUES
        (${challengeId}, ${fromPlayerId}, ${profile.name}, ${profile.picture || null},
         ${profile.avatarColor || "#e53e3e"}, ${toPlayerId}, ${roomCode},
         'pending', FALSE, NOW())
      ON CONFLICT (from_player_id, to_player_id, is_room_invite) WHERE status = 'pending'
      DO NOTHING
      RETURNING challenge_id, room_code
    `);
    if ((inserted as any).rowCount === 0) {
      await db.delete(roomsTable).where(eq(roomsTable.roomCode, roomCode)).catch(() => {});
      const existing = await db.execute(sql`
        SELECT challenge_id, room_code
        FROM player_challenges
        WHERE from_player_id = ${fromPlayerId}
          AND to_player_id = ${toPlayerId}
          AND is_room_invite = FALSE
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const winner = (existing.rows as any[])[0];
      if (!winner) return res.status(409).json({ error: "Challenge creation raced; please retry" });
      return res.json({ challengeId: winner.challenge_id, roomCode: winner.room_code });
    }
  } catch (err) {
    await db.delete(roomsTable).where(eq(roomsTable.roomCode, roomCode)).catch(() => {});
    console.error("[presence/challenge] challenge persistence failed:", err);
    return res.status(503).json({ error: "Unable to create challenge" });
  }

  // Send push notification to target (works even if they have the app closed)
  const lang = (req.body as any).language || "es";
  const CHALLENGE_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "⚔️ ¡Nuevo reto!", body: `${profile.name} te desafía a una partida de STOP. ¡Acepta si te atreves!` },
    en: { title: "⚔️ New challenge!", body: `${profile.name} is challenging you to a STOP game. Do you dare accept?` },
    pt: { title: "⚔️ Novo desafio!", body: `${profile.name} desafia-te para uma partida de STOP. Aceitas?` },
    fr: { title: "⚔️ Nouveau défi !", body: `${profile.name} te défie à une partie de STOP. Tu oses accepter ?` },
  };
  const challengeMsg = CHALLENGE_MSGS[lang] || CHALLENGE_MSGS.es;
  sendPushToPlayer(toPlayerId, { ...challengeMsg, url: "/multiplayer" }).catch(() => {});

  return res.json({ challengeId, roomCode });
});

// POST /api/presence/room-invite — invite a player to an already-existing room
router.post("/room-invite", async (req, res) => {
  const { fromPlayerId, fromName, fromPicture, fromAvatarColor, toPlayerId, roomCode } = req.body as {
    fromPlayerId: string;
    fromName: string;
    fromPicture?: string | null;
    fromAvatarColor?: string;
    toPlayerId: string;
    roomCode: string;
  };

  if (!fromPlayerId || !toPlayerId || !fromName || !roomCode) {
    return res.status(400).json({ error: "fromPlayerId, fromName, toPlayerId and roomCode required" });
  }
  if (!verifyClaimedIdentity(req, fromPlayerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }

  const normalizedRoomCode = String(roomCode).trim().toUpperCase();
  const profile = await getCanonicalPresenceProfile(fromPlayerId);
  if (!profile) return res.status(404).json({ error: "Player not found" });

  await challengeTableReady;

  // Lock the room row while validating ownership and creating the invite.
  // /leave also locks the room before deleting it, so an invite cannot point
  // at a room that disappears between the ownership check and INSERT.
  const result = await db.transaction(async (tx) => {
    const [room] = await tx
      .select({ hostId: roomsTable.hostId })
      .from(roomsTable)
      .where(eq(roomsTable.roomCode, normalizedRoomCode))
      .for("update")
      .limit(1);
    if (!room || room.hostId !== fromPlayerId) {
      return { error: "unauthorized" as const };
    }

    // Do not delete an existing pending invite before inserting the
    // replacement. Concurrent requests are serialized by the partial unique
    // index below; if another request wins, return that existing invite.
    const challengeId = `ri_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${Math.random().toString(36).slice(2, 8)}`;
    const inserted = await tx.execute(sql`
      INSERT INTO player_challenges
        (challenge_id, from_player_id, from_name, from_picture, from_avatar_color,
         to_player_id, room_code, status, is_room_invite, created_at)
      VALUES
        (${challengeId}, ${fromPlayerId}, ${profile.name}, ${profile.picture || null},
         ${profile.avatarColor || "#e53e3e"}, ${toPlayerId}, ${normalizedRoomCode},
         'pending', TRUE, NOW())
      ON CONFLICT (from_player_id, to_player_id, is_room_invite) WHERE status = 'pending'
      DO NOTHING
      RETURNING challenge_id
    `);
    if ((inserted as any).rowCount === 0) {
      const existing = await tx.execute(sql`
        SELECT challenge_id
        FROM player_challenges
        WHERE from_player_id = ${fromPlayerId}
          AND to_player_id = ${toPlayerId}
          AND is_room_invite = TRUE
          AND status = 'pending'
        ORDER BY created_at DESC
        LIMIT 1
      `);
      const winner = (existing.rows as any[])[0];
      if (!winner) return { error: "raced" as const };
      return { challengeId: winner.challenge_id as string };
    }

    return { challengeId };
  });

  if ("error" in result) {
    if (result.error === "raced") {
      return res.status(409).json({ error: "Room invite creation raced; please retry" });
    }
    return res.status(403).json({ error: "Not authorized to invite from this room" });
  }
  const challengeId = result.challengeId;

  // Push notification to target (works even if app is closed)
  const invLang = (req.body as any).language || "es";
  const INVITE_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "🎮 ¡Te invitan a tu sala!", body: `${profile.name} te invita a unirte a la sala ${normalizedRoomCode}` },
    en: { title: "🎮 Room invite!", body: `${profile.name} invites you to join room ${normalizedRoomCode}` },
    pt: { title: "🎮 Convite para sala!", body: `${profile.name} convida-te para a sala ${normalizedRoomCode}` },
    fr: { title: "🎮 Invitation à la salle !", body: `${profile.name} t'invite à rejoindre la salle ${normalizedRoomCode}` },
  };
  const invMsg = INVITE_MSGS[invLang] || INVITE_MSGS.es;
  sendPushToPlayer(toPlayerId, { ...invMsg, url: `/multiplayer?room=${normalizedRoomCode}` }).catch(() => {});

  return res.json({ ok: true, challengeId });
});

// GET /api/presence/challenges/:playerId — get incoming pending challenges + room invites
router.get("/challenges/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!verifyClaimedIdentity(req, playerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }
  await challengeTableReady;
  const rows = await db.execute(sql`
    SELECT challenge_id, from_player_id, from_name, from_picture, from_avatar_color,
           to_player_id, room_code, status, is_room_invite, created_at
    FROM player_challenges
    WHERE to_player_id = ${playerId}
      AND status = 'pending'
      AND created_at >= NOW() - INTERVAL '60 seconds'
    ORDER BY created_at DESC
  `);
  const incoming = (rows.rows as any[]).map((c) => ({
    challengeId: c.challenge_id,
    fromPlayerId: c.from_player_id,
    fromName: c.from_name,
    fromPicture: c.from_picture,
    fromAvatarColor: c.from_avatar_color,
    toPlayerId: c.to_player_id,
    roomCode: c.room_code,
    status: c.status,
    createdAt: new Date(c.created_at).getTime(),
    isRoomInvite: !!c.is_room_invite,
  }));
  return res.json({ challenges: incoming });
});

// POST /api/presence/challenge/:challengeId/respond
router.post("/challenge/:challengeId/respond", async (req, res) => {
  const { challengeId } = req.params;
  const { accepted } = req.body as { accepted: boolean };

  await challengeTableReady;
  const rows = await db.execute(sql`
    SELECT challenge_id, from_player_id, from_name, from_picture, from_avatar_color,
           to_player_id, room_code, status, is_room_invite, created_at
    FROM player_challenges
    WHERE challenge_id = ${challengeId}
      AND created_at >= NOW() - INTERVAL '2 minutes'
    LIMIT 1
  `);
  const row = (rows.rows as any[])[0];
  if (!row) return res.status(404).json({ error: "Challenge not found or expired" });

  if (!verifyClaimedIdentity(req, row.to_player_id)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }
  if (row.status !== "pending") {
    return res.status(409).json({ error: "Challenge already answered" });
  }

  const nextStatus = accepted ? "accepted" : "declined";
  const updated = await db.execute(sql`
    UPDATE player_challenges
    SET status = ${nextStatus}
    WHERE challenge_id = ${challengeId}
      AND status = 'pending'
  `);
  if ((updated as any).rowCount === 0) {
    return res.status(409).json({ error: "Challenge already answered" });
  }
  return res.json({ ok: true, roomCode: accepted ? row.room_code : null });
});

// GET /api/presence/challenge/:challengeId/status — poll status (for sender)
router.get("/challenge/:challengeId/status", async (req, res) => {
  const { challengeId } = req.params;
  await challengeTableReady;
  const rows = await db.execute(sql`
    SELECT from_player_id, room_code, status, created_at
    FROM player_challenges
    WHERE challenge_id = ${challengeId}
      AND created_at >= NOW() - INTERVAL '2 minutes'
    LIMIT 1
  `);
  const row = (rows.rows as any[])[0];
  if (!row) return res.json({ status: "expired" });

  if (!verifyClaimedIdentity(req, row.from_player_id)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }
  return res.json({
    status: row.status,
    roomCode: row.room_code,
  });
});


export default router;
