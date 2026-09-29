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
  CREATE UNIQUE INDEX IF NOT EXISTS player_challenges_pending_pair_uidx
    ON player_challenges (from_player_id, to_player_id)
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
  // Challenges expire after 2 minutes. The database is the shared source
  // of truth, so this cleanup is safe to run on every instance.
  void challengeTableReady.then(() => db.execute(sql`
    DELETE FROM player_challenges
    WHERE created_at < NOW() - INTERVAL '2 minutes'
  `)).catch((err) => console.error("[presence] challenge cleanup failed:", err));
}, 2 * 60 * 1000);

// POST /api/presence/ping
router.post("/ping", presenceLimiter, (req, res) => {
  const { playerId, name, picture, avatarColor, provider, roomCode, language } = req.body as {
    playerId: string;
    name: string;
    picture?: string | null;
    avatarColor?: string;
    provider?: string | null;
    roomCode?: string | null;
    language?: string;
  };

  if (!playerId || !name) {
    return res.status(400).json({ error: "playerId and name required" });
  }
  if (!verifyClaimedIdentity(req, playerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }

  // Check if this is a fresh connection (player was offline for > 3 min)
  const existing = presenceMap.get(playerId);
  const wasOffline = !existing || existing.lastSeen < Date.now() - 3 * 60 * 1000;

  presenceMap.set(playerId, {
    name,
    picture: picture || null,
    avatarColor: avatarColor || "#e53e3e",
    provider: provider || null,
    roomCode: roomCode || null,
    lastSeen: Date.now(),
  });

  // Notify followers asynchronously (non-blocking) when player reconnects
  if (wasOffline && provider && provider !== "guest") {
    notifyFollowersPlayerOnline(playerId, name, language || "es").catch(() => {});
  }

  return res.json({ ok: true });
});

// GET /api/presence/online
router.get("/online", async (_req, res) => {
  const cutoff = Date.now() - 90 * 1000;
  const online: Array<{
    playerId: string;
    name: string;
    picture: string | null;
    avatarColor: string;
    provider: string | null;
    roomCode: string | null;
    lastSeen: number;
  }> = [];

  for (const [playerId, data] of presenceMap) {
    if (data.lastSeen >= cutoff) {
      online.push({ playerId, ...data });
    }
  }

  const ids = online.map(p => p.playerId);
  if (ids.length > 0) {
    try {
      const cosmetics = await db.select({
        playerId: playerScoresTable.playerId,
        profilePicture: playerScoresTable.profilePicture,
        equippedAvatar: playerScoresTable.equippedAvatar,
        equippedFrame: playerScoresTable.equippedFrame,
        equippedTitle: playerScoresTable.equippedTitle,
      }).from(playerScoresTable).where(inArray(playerScoresTable.playerId, ids));
      const byId = new Map(cosmetics.map(c => [c.playerId, c]));
      for (const p of online) {
        const c = byId.get(p.playerId);
        if (c) {
          (p as any).picture = c.profilePicture ?? p.picture ?? null;
          (p as any).equippedAvatar = c.equippedAvatar ?? null;
          (p as any).equippedFrame = c.equippedFrame ?? null;
          (p as any).equippedTitle = c.equippedTitle ?? null;
        }
      }
    } catch {}
  }
  online.sort((a, b) => b.lastSeen - a.lastSeen);
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

  // Check target player is online
  const cutoff = Date.now() - 90 * 1000;
  const target = presenceMap.get(toPlayerId);
  if (!target || target.lastSeen < cutoff) {
    return res.status(404).json({ error: "Player is not online" });
  }

  await challengeTableReady;

  // Remove any existing pending challenge between these two players.
  await db.execute(sql`
    DELETE FROM player_challenges
    WHERE from_player_id = ${fromPlayerId}
      AND to_player_id = ${toPlayerId}
      AND status = 'pending'
  `);

  const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${Math.random().toString(36).slice(2, 8)}`;

  // Room codes are UNIQUE in the database. Reserve the room before publishing
  // the challenge, retrying only on a genuine uniqueness collision. This avoids
  // a challenge pointing at a room that was never created.
  const players = [{
    playerId: fromPlayerId,
    playerName: fromName,
    avatarColor: fromAvatarColor ?? "#e53e3e",
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
        hostName: fromName,
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
        (${challengeId}, ${fromPlayerId}, ${fromName}, ${fromPicture || null},
         ${fromAvatarColor || "#e53e3e"}, ${toPlayerId}, ${roomCode},
         'pending', FALSE, NOW())
      ON CONFLICT (from_player_id, to_player_id) WHERE status = 'pending'
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
    es: { title: "⚔️ ¡Nuevo reto!", body: `${fromName} te desafía a una partida de STOP. ¡Acepta si te atreves!` },
    en: { title: "⚔️ New challenge!", body: `${fromName} is challenging you to a STOP game. Do you dare accept?` },
    pt: { title: "⚔️ Novo desafio!", body: `${fromName} desafia-te para uma partida de STOP. Aceitas?` },
    fr: { title: "⚔️ Nouveau défi !", body: `${fromName} te défie à une partie de STOP. Tu oses accepter ?` },
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
  const [room] = await db.select({ hostId: roomsTable.hostId })
    .from(roomsTable)
    .where(eq(roomsTable.roomCode, normalizedRoomCode))
    .limit(1);
  if (!room || room.hostId !== fromPlayerId) {
    return res.status(403).json({ error: "Not authorized to invite from this room" });
  }

  await challengeTableReady;

  // Remove any existing pending room-invite from this sender to this target.
  await db.execute(sql`
    DELETE FROM player_challenges
    WHERE from_player_id = ${fromPlayerId}
      AND to_player_id = ${toPlayerId}
      AND is_room_invite = TRUE
      AND status = 'pending'
  `);

  const challengeId = `ri_${Date.now()}_${Math.random().toString(36).slice(2, 6)}_${Math.random().toString(36).slice(2, 8)}`;

  await db.execute(sql`
    INSERT INTO player_challenges
      (challenge_id, from_player_id, from_name, from_picture, from_avatar_color,
       to_player_id, room_code, status, is_room_invite, created_at)
    VALUES
      (${challengeId}, ${fromPlayerId}, ${fromName}, ${fromPicture || null},
       ${fromAvatarColor || "#e53e3e"}, ${toPlayerId}, ${roomCode},
       'pending', TRUE, NOW())
  `);

  // Push notification to target (works even if app is closed)
  const invLang = (req.body as any).language || "es";
  const INVITE_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "🎮 ¡Te invitan a tu sala!", body: `${fromName} te invita a unirte a la sala ${roomCode}` },
    en: { title: "🎮 Room invite!", body: `${fromName} invites you to join room ${roomCode}` },
    pt: { title: "🎮 Convite para sala!", body: `${fromName} convida-te para a sala ${roomCode}` },
    fr: { title: "🎮 Invitation à la salle !", body: `${fromName} t'invite à rejoindre la salle ${roomCode}` },
  };
  const invMsg = INVITE_MSGS[invLang] || INVITE_MSGS.es;
  sendPushToPlayer(toPlayerId, { ...invMsg, url: `/multiplayer?room=${roomCode}` }).catch(() => {});

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
