import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { sendPushToPlayer, notifyFollowersPlayerOnline } from "../lib/pushHelper";

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

// In-memory challenges store
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
}

const challengeMap = new Map<string, Challenge>();

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
  // Challenges expire after 2 minutes
  const challengeCutoff = Date.now() - 2 * 60 * 1000;
  for (const [id] of challengeMap) {
    const c = challengeMap.get(id)!;
    if (c.createdAt < challengeCutoff) challengeMap.delete(id);
  }
}, 2 * 60 * 1000);

// POST /api/presence/ping
router.post("/ping", (req, res) => {
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
router.get("/online", (_req, res) => {
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

  // Check target player is online
  const cutoff = Date.now() - 90 * 1000;
  const target = presenceMap.get(toPlayerId);
  if (!target || target.lastSeen < cutoff) {
    return res.status(404).json({ error: "Player is not online" });
  }

  // Remove any existing pending challenge between these two
  for (const [id, c] of challengeMap) {
    if (c.fromPlayerId === fromPlayerId && c.toPlayerId === toPlayerId && c.status === "pending") {
      challengeMap.delete(id);
    }
  }

  const challengeId = `ch_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
  const roomCode = generateRoomCode();

  // Create the room in the DB right now so /join works when the challenge is accepted
  try {
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
    await db.insert(roomsTable).values({
      roomCode,
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
  } catch (e) {
    console.error("Challenge room creation failed:", e);
  }

  challengeMap.set(challengeId, {
    challengeId,
    fromPlayerId,
    fromName,
    fromPicture: fromPicture || null,
    fromAvatarColor: fromAvatarColor || "#e53e3e",
    toPlayerId,
    roomCode,
    status: "pending",
    createdAt: Date.now(),
  });

  // Send push notification to target (works even if they have the app closed)
  const lang = (req.body as any).language || "es";
  const CHALLENGE_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "⚔️ ¡Nuevo reto!", body: `${fromName} te desafía a una partida de STOP. ¡Acepta si te atreves!` },
    en: { title: "⚔️ New challenge!", body: `${fromName} is challenging you to a STOP game. Do you dare accept?` },
    pt: { title: "⚔️ Novo desafio!", body: `${fromName} desafia-te para uma partida de STOP. Aceitas?` },
    fr: { title: "⚔️ Nouveau défi !", body: `${fromName} te défie à une partie de STOP. Tu oses accepter ?` },
  };
  const challengeMsg = CHALLENGE_MSGS[lang] || CHALLENGE_MSGS.es;
  sendPushToPlayer(toPlayerId, { ...challengeMsg, url: "/multijugador" }).catch(() => {});

  return res.json({ challengeId, roomCode });
});

// POST /api/presence/room-invite — invite a player to an already-existing room
router.post("/room-invite", (req, res) => {
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

  // Remove any existing pending room-invite from this sender to this target
  for (const [id, c] of challengeMap) {
    if (
      c.fromPlayerId === fromPlayerId &&
      c.toPlayerId === toPlayerId &&
      (c as any).isRoomInvite &&
      c.status === "pending"
    ) {
      challengeMap.delete(id);
    }
  }

  const challengeId = `ri_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;

  const entry: Challenge & { isRoomInvite?: boolean } = {
    challengeId,
    fromPlayerId,
    fromName,
    fromPicture: fromPicture || null,
    fromAvatarColor: fromAvatarColor || "#e53e3e",
    toPlayerId,
    roomCode,
    status: "pending",
    createdAt: Date.now(),
  };
  (entry as any).isRoomInvite = true;

  challengeMap.set(challengeId, entry);

  // Push notification to target (works even if app is closed)
  const invLang = (req.body as any).language || "es";
  const INVITE_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "🎮 ¡Te invitan a tu sala!", body: `${fromName} te invita a unirte a la sala ${roomCode}` },
    en: { title: "🎮 Room invite!", body: `${fromName} invites you to join room ${roomCode}` },
    pt: { title: "🎮 Convite para sala!", body: `${fromName} convida-te para a sala ${roomCode}` },
    fr: { title: "🎮 Invitation à la salle !", body: `${fromName} t'invite à rejoindre la salle ${roomCode}` },
  };
  const invMsg = INVITE_MSGS[invLang] || INVITE_MSGS.es;
  sendPushToPlayer(toPlayerId, { ...invMsg, url: `/multijugador?room=${roomCode}` }).catch(() => {});

  return res.json({ ok: true, challengeId });
});

// GET /api/presence/challenges/:playerId — get incoming pending challenges + room invites
router.get("/challenges/:playerId", (req, res) => {
  const { playerId } = req.params;
  const cutoff = Date.now() - 60 * 1000;

  const incoming = Array.from(challengeMap.values())
    .filter((c) => c.toPlayerId === playerId && c.status === "pending" && c.createdAt >= cutoff)
    .map((c) => ({ ...c, isRoomInvite: !!(c as any).isRoomInvite }));

  return res.json({ challenges: incoming });
});

// POST /api/presence/challenge/:challengeId/respond
router.post("/challenge/:challengeId/respond", (req, res) => {
  const { challengeId } = req.params;
  const { accepted } = req.body as { accepted: boolean };

  const challenge = challengeMap.get(challengeId);
  if (!challenge) {
    return res.status(404).json({ error: "Challenge not found or expired" });
  }

  challenge.status = accepted ? "accepted" : "declined";
  return res.json({ ok: true, roomCode: accepted ? challenge.roomCode : null });
});

// GET /api/presence/challenge/:challengeId/status — poll status (for sender)
router.get("/challenge/:challengeId/status", (req, res) => {
  const { challengeId } = req.params;
  const challenge = challengeMap.get(challengeId);
  if (!challenge) {
    return res.json({ status: "expired" });
  }
  return res.json({ status: challenge.status, roomCode: challenge.roomCode });
});

export default router;
