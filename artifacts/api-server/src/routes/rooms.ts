import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable, playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, and, lt, inArray } from "drizzle-orm";
import { CreateRoomBody, JoinRoomBody, SubmitRoomResultsBody } from "@workspace/api-zod";
import { calculateStreak } from "./ranking";

const router: IRouter = Router();

const ALPHABET_ES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(l => !["Q","X"].includes(l));

// Server-validated premium lookup: reads isPremium from the player_scores table.
// Cosmetic-grade: a guest spoofing another playerId would also need to spoof their identity end-to-end.
async function isPlayerPremium(playerId: string | null | undefined): Promise<boolean> {
  if (!playerId) return false;
  try {
    const rows = await db.select({ isPremium: playerScoresTable.isPremium })
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, playerId))
      .limit(1);
    return rows[0]?.isPremium === true;
  } catch {
    return false;
  }
}

// ── SSE listeners: roomCode → set of response objects ──────────────────────
type SseClient = { res: import("express").Response; playerId: string };
const sseClients = new Map<string, Set<SseClient>>();

function broadcastRoom(code: string, roomPayload: object) {
  const clients = sseClients.get(code);
  if (!clients || clients.size === 0) return;
  const data = `data: ${JSON.stringify(roomPayload)}\n\n`;
  for (const client of [...clients]) {
    try { client.res.write(data); } catch { clients.delete(client); }
  }
}

// Format room AND broadcast to SSE clients at the same time
function broadcastAndFormat(room: any) {
  const formatted = formatRoom(room);
  broadcastRoom(formatted.roomCode as string, formatted);
  return formatted;
}

// ── In-memory stores (ephemeral, no DB needed) ─────────────────────────────
type Reaction = { id: string; emoji: string; playerName: string; ts: number };
const roomReactions = new Map<string, Reaction[]>();
const roomCategoryPacks = new Map<string, "standard" | "crazy" | "mix">();

type QuickPhrase = { id: string; playerName: string; text: string; ts: number };
const roomPhrases = new Map<string, QuickPhrase[]>();

// Live typing presence — playerId → { name, ts }. Stale after 3 seconds.
const roomTyping = new Map<string, Map<string, { name: string; ts: number }>>();
function getTyping(code: string, excludeId?: string): { playerId: string; playerName: string }[] {
  const m = roomTyping.get(code);
  if (!m) return [];
  const cutoff = Date.now() - 3000;
  const out: { playerId: string; playerName: string }[] = [];
  for (const [pid, info] of [...m.entries()]) {
    if (info.ts < cutoff) { m.delete(pid); continue; }
    if (excludeId && pid === excludeId) continue;
    out.push({ playerId: pid, playerName: info.name });
  }
  return out;
}

// 🕵️ Live in-progress responses (for spy/peek mechanic). Stale after 5s.
// playerId → { name, responses: { category: word }, ts }
const roomLiveResponses = new Map<string, Map<string, { name: string; responses: Record<string, string>; ts: number }>>();
// roomCode → map of playerId → spy uses this round.
// Free players: 1 use/round. Premium players: 2 uses/round.
const roomSpyUsage = new Map<string, Map<string, number>>();
const SPY_LIMIT_FREE = 1;
const SPY_LIMIT_PREMIUM = 2;

// Rematch links — oldCode → newCode (in-memory, ephemeral)
const roomRematch = new Map<string, string>();

// 👏 Votos a "Jugada de la ronda" — 1 voto por ronda por jugador.
// Key: roomCode → Map<`${round}:${voterId}`, FunVote>
type FunVote = {
  round: number;
  voterId: string;
  votedPlayerId: string;
  category: string;
  answer: string;
};
const roomFunVotes = new Map<string, Map<string, FunVote>>();
function getFunVotes(code: string): FunVote[] {
  const m = roomFunVotes.get(code);
  return m ? Array.from(m.values()) : [];
}

const QUICK_PHRASES = [
  "¡Buena!", "¡Trampa! 😤", "¡Revanche!", "¡Eso no vale!",
  "🔥 ¡Brillante!", "😂 ¡Me ganaste!", "¡GG!", "🤔 ¡Difícil esa!",
];

function getPhrases(code: string): QuickPhrase[] {
  const all = roomPhrases.get(code) ?? [];
  const cutoff = Date.now() - 30_000;
  return all.filter(p => p.ts > cutoff);
}

const VALID_REACTIONS = ["🔥", "❤️", "😂", "👑", "🎯", "😤", "💪", "🤯"];

function getReactions(code: string): Reaction[] {
  const all = roomReactions.get(code) ?? [];
  const fresh = all.filter(r => Date.now() - r.ts < 8000);
  if (fresh.length !== all.length) roomReactions.set(code, fresh);
  return fresh;
}

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function parsePlayers(json: string): any[] {
  try { return JSON.parse(json); } catch { return []; }
}

function parseStopper(json: string | null): any | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function randomLetter(): string {
  return ALPHABET_ES[Math.floor(Math.random() * ALPHABET_ES.length)];
}

function parseBluffMeta(json: string | null): any | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function formatRoom(room: any) {
  const meta = parseBluffMeta(room.stopperJson);
  const code = room.roomCode as string;
  return {
    id: room.id,
    roomCode: code,
    hostId: room.hostId,
    hostName: room.hostName || "",
    status: room.status,
    currentLetter: room.currentLetter,
    currentRound: room.currentRound,
    maxRounds: room.maxRounds,
    maxPlayers: room.maxPlayers ?? 8,
    gameMode: room.gameMode ?? "classic",
    categoryPack: roomCategoryPacks.get(code) ?? "standard",
    language: room.language,
    isPublic: room.isPublic ?? false,
    players: parsePlayers(room.playersJson),
    stopper: meta?.stopper ?? meta,
    bluffData: meta?.bluffVotes ?? null,
    bluffVoteDeadline: meta?.bluffDeadline ?? null,
    reactions: getReactions(code),
    phrases: getPhrases(code),
    typing: getTyping(code),
    rematchCode: roomRematch.get(code) ?? null,
    funVotes: getFunVotes(code),
    createdAt: room.createdAt,
  };
}

// Resolve bluff votes: majority "lie" = caught, otherwise not caught. Adjust scores.
function resolveBluffs(players: any[], bluffVotes: Record<string, any>): any[] {
  return players.map((p: any) => {
    if (!p.bluffedCategories?.length || !bluffVotes[p.playerId]) return p;
    const voteMap = bluffVotes[p.playerId]; // { cat: { voterId: "lie"|"real" } }
    let scoreAdjust = 0;
    const bluffResults: any[] = [];
    for (const cat of p.bluffedCategories) {
      const votes = Object.values(voteMap[cat] ?? {}) as string[];
      const lieCnt = votes.filter(v => v === "lie").length;
      const caught = votes.length > 0 && lieCnt > votes.length / 2; // strict majority
      scoreAdjust += caught ? -10 : 20;
      bluffResults.push({ cat, caught, votes: voteMap[cat] ?? {} });
    }
    return { ...p, score: (p.score || 0) + scoreAdjust, bluffResults };
  });
}

// Auto-submit all non-guest players' scores to the global leaderboard when the game ends
async function submitAllScoresToLeaderboard(players: any[], letter: string) {
  const winner = [...players].sort((a, b) => (b.score || 0) - (a.score || 0))[0];
  const today = new Date().toISOString().split("T")[0];

  await Promise.allSettled(players.map(async (p: any) => {
    // Skip guests and players with 0 or no score
    if (!p.playerId || p.loginMethod === "guest") return;

    const rawScore = p.score || 0;
    // Apply 1.5x multiplier for multiplayer
    const score = Math.round(rawScore * 1.5);
    const won = winner?.playerId === p.playerId;

    const existing = await db
      .select()
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, p.playerId))
      .limit(1);

    // Streak calculation
    const { newStreak, updatedToday } = calculateStreak(
      existing[0]?.lastPlayedDate ?? null,
      existing[0]?.currentStreak ?? 0
    );
    const newLongest = Math.max(existing[0]?.longestStreak ?? 0, newStreak);

    if (existing.length > 0) {
      await db.update(playerScoresTable)
        .set({
          playerName: p.playerName,
          avatarColor: p.avatarColor ?? existing[0].avatarColor,
          totalScore: existing[0].totalScore + score,
          gamesPlayed: existing[0].gamesPlayed + 1,
          wins: existing[0].wins + (won ? 1 : 0),
          ...(updatedToday ? {
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastPlayedDate: today,
          } : {}),
          updatedAt: new Date(),
        })
        .where(eq(playerScoresTable.playerId, p.playerId));
    } else {
      await db.insert(playerScoresTable).values({
        playerId: p.playerId,
        playerName: p.playerName,
        avatarColor: p.avatarColor ?? "#e53e3e",
        totalScore: score,
        gamesPlayed: 1,
        wins: won ? 1 : 0,
        currentStreak: 1,
        longestStreak: 1,
        lastPlayedDate: today,
      });
    }

    await db.insert(gameHistoryTable).values({
      playerId: p.playerId,
      score,
      letter,
      mode: "multiplayer",
      won,
    });
  }));
}

// Delete stale rooms (guests/hosts leave without cleanup).
// - "waiting" rooms older than 2 hours
// - any other state ("playing"/"stopped"/"finished"/"bluffvoting") older than 6 hours
//   so abandoned games don't accumulate as DB garbage and slow down public listings.
async function purgeStaleRooms() {
  try {
    const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
    await db.delete(roomsTable).where(
      and(eq(roomsTable.status, "waiting"), lt(roomsTable.updatedAt, twoHoursAgo))
    );
    await db.delete(roomsTable).where(lt(roomsTable.updatedAt, sixHoursAgo));
  } catch (err) {
    console.error("[purgeStaleRooms] failed:", (err as Error).message);
  }
}

// GET /rooms/public — list open public rooms (also purges stale rooms)
// Sanitize a formatted room for public spectator/overlay views.
// Hide individual players' answers while a round is in progress to prevent cheating.
function sanitizeRoomForSpectator(room: any) {
  if (room.status === "playing" || room.status === "stopping") {
    return {
      ...room,
      players: (room.players ?? []).map((p: any) => ({
        ...p,
        answers: undefined,
        bluffedCategories: undefined,
      })),
      typing: undefined,
      stopper: room.stopper ? { stopperName: room.stopper.stopperName } : null,
    };
  }
  return room;
}

// GET /rooms/live — public rooms currently mid-game (for streamer directory)
router.get("/live", async (_req, res) => {
  const rows = await db
    .select()
    .from(roomsTable)
    .where(and(
      eq(roomsTable.isPublic, true),
      inArray(roomsTable.status, ["playing", "stopping", "revealing", "bluffvoting"]),
    ))
    .orderBy(roomsTable.createdAt)
    .limit(12);
  const list = rows.map(r => {
    const players = parsePlayers(r.playersJson);
    return {
      roomCode: r.roomCode,
      hostName: r.hostName || "Anfitrión",
      status: r.status,
      currentLetter: r.currentLetter,
      currentRound: r.currentRound,
      maxRounds: r.maxRounds,
      gameMode: r.gameMode ?? "classic",
      language: r.language,
      playerCount: players.length,
      topScore: Math.max(0, ...players.map((p: any) => p.score || 0)),
    };
  });
  res.json({ rooms: list });
});

// GET /rooms/:code/spectate — sanitized public view (no auth required)
router.get("/:roomCode/spectate", async (req, res) => {
  const { roomCode } = req.params;
  const rows = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode));
  if (!rows.length) { res.status(404).json({ error: "Room not found" }); return; }
  const room = rows[0];
  if (!room.isPublic) { res.status(403).json({ error: "Room is private" }); return; }
  res.json(sanitizeRoomForSpectator(formatRoom(room)));
});

// PATCH /rooms/:code/visibility — host toggles streamer mode (isPublic)
router.patch("/:roomCode/visibility", async (req, res) => {
  const { roomCode } = req.params;
  const { hostId, isPublic } = req.body ?? {};
  if (typeof isPublic !== "boolean" || !hostId) {
    res.status(400).json({ error: "Missing hostId or isPublic" }); return;
  }
  const rows = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode));
  if (!rows.length) { res.status(404).json({ error: "Room not found" }); return; }
  if (rows[0].hostId !== hostId) { res.status(403).json({ error: "Only host can change visibility" }); return; }
  const [updated] = await db.update(roomsTable)
    .set({ isPublic })
    .where(eq(roomsTable.roomCode, roomCode))
    .returning();
  res.json(formatRoom(updated));
});

router.get("/public", async (_req, res) => {
  // Opportunistic cleanup: remove stale waiting rooms on every public listing request
  purgeStaleRooms().catch(() => {});

  const rooms = await db
    .select()
    .from(roomsTable)
    .where(and(eq(roomsTable.isPublic, true), eq(roomsTable.status, "waiting")))
    .orderBy(roomsTable.createdAt)
    .limit(20);

  const formatted = rooms.map(r => ({
    roomCode: r.roomCode,
    hostId: r.hostId,
    hostName: r.hostName || "Anfitrión",
    maxRounds: r.maxRounds,
    maxPlayers: r.maxPlayers ?? 8,
    gameMode: r.gameMode ?? "classic",
    language: r.language,
    playerCount: parsePlayers(r.playersJson).length,
    createdAt: r.createdAt,
  }));
  res.json({ rooms: formatted });
});

// POST /rooms — create room
router.post("/", async (req, res) => {
  const body = CreateRoomBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const { hostId, hostName, avatarColor, loginMethod, maxRounds, language, isPublic } = body.data;
  const gameMode = (body.data as any).gameMode ?? "classic";
  const maxPlayers = (body.data as any).maxPlayers ?? 8;

  let roomCode = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const existing = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode)).limit(1);
    if (existing.length === 0) break;
    roomCode = generateRoomCode();
  }

  // Look up premium status from DB (server-validated, can't be faked by client)
  const hostPremium = await isPlayerPremium(hostId);

  const players = [{
    playerId: hostId,
    playerName: hostName,
    avatarColor: avatarColor ?? "#e53e3e",
    loginMethod: loginMethod ?? null,
    isPremium: hostPremium,
    score: 0,
    roundScore: 0,
    isHost: true,
    isReady: false,
  }];

  const [room] = await db.insert(roomsTable).values({
    roomCode,
    hostId,
    hostName: hostName ?? "",
    status: "waiting",
    currentRound: 0,
    maxRounds: maxRounds ?? 3,
    maxPlayers,
    gameMode,
    language: language ?? "es",
    playersJson: JSON.stringify(players),
    stopperJson: null,
    isPublic: isPublic ?? false,
  }).returning();

  res.status(201).json(formatRoom(room));
});

// GET /rooms/:roomCode
router.get("/:roomCode", async (req, res) => {
  const { roomCode } = req.params;
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }
  res.json(formatRoom(rooms[0]));
});

// POST /rooms/:roomCode/join
router.post("/:roomCode/join", async (req, res) => {
  const { roomCode } = req.params;
  const body = JoinRoomBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const code = roomCode.toUpperCase();
  const { playerId, playerName, avatarColor, loginMethod } = body.data;
  const joinerPremium = await isPlayerPremium(playerId);

  // 🛡️ Optimistic-concurrency join: read → modify → write with retry.
  // Two players joining simultaneously could otherwise overwrite each other.
  // We use updatedAt as a version stamp; on conflict we re-read and retry.
  let updated: any = null;
  for (let attempt = 0; attempt < 5; attempt++) {
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
    if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

    const room = rooms[0];
    const lastVersion = room.updatedAt;
    const players = parsePlayers(room.playersJson);

    if (!players.find((p: any) => p.playerId === playerId)) {
      players.push({
        playerId,
        playerName,
        avatarColor: avatarColor ?? "#3182ce",
        loginMethod: loginMethod ?? null,
        isPremium: joinerPremium,
        score: 0,
        roundScore: 0,
        isHost: false,
        isReady: false,
      });
    } else {
      // Already in the room — just refresh activity timestamp and broadcast
      updated = room;
      break;
    }

    const result = await db.update(roomsTable)
      .set({ playersJson: JSON.stringify(players), updatedAt: new Date() })
      .where(and(
        eq(roomsTable.roomCode, code),
        eq(roomsTable.updatedAt, lastVersion as any),
      ))
      .returning();

    if (result.length > 0) {
      updated = result[0];
      break;
    }
    // Conflict — somebody else updated the row. Retry.
    await new Promise(r => setTimeout(r, 30 + attempt * 50));
  }

  if (!updated) {
    res.status(503).json({ error: "Room is busy, please retry" });
    return;
  }

  // 🚀 Notifica a todos en la sala que entró un nuevo jugador
  res.json(broadcastAndFormat(updated));
});

// POST /rooms/:roomCode/start — host starts / continues the game
router.post("/:roomCode/start", async (req, res) => {
  const { roomCode } = req.params;
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  const players = parsePlayers(room.playersJson);

  const newRound = room.currentRound === 0 ? 1 : room.currentRound;
  const MP_CARDS = ["lightning", "shield", "sabotage", "double_or_nothing", "steal"] as const;

  // Reset all ready flags and round scores; assign power cards on round 1 only
  const resetPlayers = players.map((p: any) => ({
    ...p,
    isReady: false,
    roundScore: 0,
    // Assign 1 random card at game start (round 1); keep it for subsequent rounds until used
    powerCard: newRound === 1
      ? MP_CARDS[Math.floor(Math.random() * MP_CARDS.length)]
      : (p.powerCard ?? null),
    powerCardUsed: newRound === 1 ? false : (p.powerCardUsed ?? false),
    bluffImmune: false,
  }));

  const [updated] = await db.update(roomsTable)
    .set({
      status: "playing",
      currentRound: newRound,
      currentLetter: randomLetter(),
      playersJson: JSON.stringify(resetPlayers),
      stopperJson: null,
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  // 🚀 Empuja el cambio a TODOS los jugadores por SSE de inmediato
  // (antes solo el host recibía la respuesta y los demás esperaban polling).
  res.json(broadcastAndFormat(updated));
});

// POST /rooms/:roomCode/leave — player leaves the room
router.post("/:roomCode/leave", async (req, res) => {
  const { roomCode } = req.params;
  const { playerId } = req.body as { playerId: string };

  if (!playerId) { res.status(400).json({ error: "playerId required" }); return; }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.json({ ok: true }); return; }

  const room = rooms[0];
  const players = parsePlayers(room.playersJson);
  const leavingPlayer = players.find((p: any) => p.playerId === playerId);

  // If game is already in progress or finished, do nothing (let the game continue)
  if (room.status === "playing" || room.status === "stopped" || room.status === "finished") {
    res.json({ ok: true });
    return;
  }

  // If the host leaves while in lobby → delete the room entirely
  if (leavingPlayer?.isHost) {
    await db.delete(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase()));
    // Free in-memory ephemeral state for this room
    roomTyping.delete(roomCode.toUpperCase());
    roomLiveResponses.delete(roomCode.toUpperCase());
    roomSpyUsage.delete(roomCode.toUpperCase());
    roomRematch.delete(roomCode.toUpperCase());
    roomFunVotes.delete(roomCode.toUpperCase());
    res.json({ ok: true, deleted: true });
    return;
  }

  // Regular player leaves → remove from players list
  const remaining = players.filter((p: any) => p.playerId !== playerId);
  const [updated] = await db.update(roomsTable)
    .set({ playersJson: JSON.stringify(remaining), updatedAt: new Date() })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  // 🚀 Notify the rest of the lobby that the player is gone (no más fantasmas)
  try { if (updated) broadcastAndFormat(updated); } catch {}
  res.json({ ok: true });
});

// POST /rooms/:roomCode/react — player sends an emoji reaction (in-memory, ephemeral)
router.post("/:roomCode/react", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const { emoji, playerName } = req.body as { emoji: string; playerName: string };
  if (!VALID_REACTIONS.includes(emoji)) { res.status(400).json({ error: "Invalid emoji" }); return; }
  const list = roomReactions.get(code) ?? [];
  list.push({ id: Math.random().toString(36).slice(2), emoji, playerName: playerName ?? "?", ts: Date.now() });
  roomReactions.set(code, list.slice(-40));
  // 🚀 Push reactions to all clients immediately (otherwise wait up to 1.5s)
  try {
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
    if (rooms.length > 0) broadcastAndFormat(rooms[0]);
  } catch {}
  res.json({ ok: true });
});

// POST /rooms/:roomCode/category-pack — host sets category pack (standard/crazy/mix)
router.post("/:roomCode/category-pack", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const { hostId, pack } = req.body as { hostId: string; pack: "standard" | "crazy" | "mix" };
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }
  if (rooms[0].hostId !== hostId) { res.status(403).json({ error: "Not host" }); return; }
  if (!["standard", "crazy", "mix"].includes(pack)) { res.status(400).json({ error: "Invalid pack" }); return; }
  roomCategoryPacks.set(code, pack);
  // 🚀 Notify all players the host changed the category pack
  try { broadcastAndFormat(rooms[0]); } catch {}
  res.json({ ok: true, categoryPack: pack });
});

// POST /rooms/:roomCode/use-card — player activates their power card
router.post("/:roomCode/use-card", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const { playerId } = req.body as { playerId: string };
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  const players: any[] = parsePlayers(room.playersJson);
  const me = players.find(p => p.playerId === playerId);
  if (!me || me.powerCardUsed || !me.powerCard) {
    res.status(400).json({ error: "Card not available" }); return;
  }

  let updatedPlayers = players.map(p =>
    p.playerId === playerId ? { ...p, powerCardUsed: true } : p
  );

  // Apply server-side effects
  const card = me.powerCard as string;
  if (card === "sabotage" || card === "steal") {
    // Steal 10 pts from the current leader (not self)
    const sorted = [...updatedPlayers].filter(p => p.playerId !== playerId).sort((a, b) => (b.score ?? 0) - (a.score ?? 0));
    if (sorted.length > 0) {
      const leaderId = sorted[0].playerId;
      updatedPlayers = updatedPlayers.map(p =>
        p.playerId === leaderId ? { ...p, score: Math.max(0, (p.score ?? 0) - 10) } : p
      );
    }
  } else if (card === "shield") {
    updatedPlayers = updatedPlayers.map(p =>
      p.playerId === playerId ? { ...p, bluffImmune: true } : p
    );
  }
  // lightning and double_or_nothing are handled client-side (time bonus / score multiplier)

  const [updated] = await db.update(roomsTable)
    .set({ playersJson: JSON.stringify(updatedPlayers), updatedAt: new Date() })
    .where(eq(roomsTable.roomCode, code))
    .returning();

  // 🚀 Notify all players when a power card is used (sabotage/steal/shield affect everyone)
  const formatted = broadcastAndFormat(updated);
  res.json({ ok: true, card, room: formatted });
});

// GET /rooms/:roomCode/events — SSE stream for real-time room state
router.get("/:roomCode/events", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const playerId = (req.query["playerId"] as string) || "";

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Send current state immediately
  const [roomRow] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (roomRow) {
    res.write(`data: ${JSON.stringify(formatRoom(roomRow))}\n\n`);
  }

  const client: SseClient = { res, playerId };
  if (!sseClients.has(code)) sseClients.set(code, new Set());
  sseClients.get(code)!.add(client);

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    sseClients.get(code)?.delete(client);
  });
});

// POST /rooms/:roomCode/phrase — quick phrase (social chat)
// POST /rooms/:roomCode/typing — heartbeat: this player is currently typing.
// Throttled by the client to once every ~1.5s. Stale entries auto-expire after 3s.
router.post("/:roomCode/typing", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const { playerId, playerName, responses } = req.body as {
    playerId: string;
    playerName: string;
    responses?: Record<string, string>;
  };
  if (!playerId) { res.status(400).json({ error: "Missing playerId" }); return; }

  let m = roomTyping.get(code);
  if (!m) { m = new Map(); roomTyping.set(code, m); }
  m.set(playerId, { name: String(playerName ?? "?").slice(0, 30), ts: Date.now() });

  // 🕵️ Stash live responses so /spy can peek at them. Stale after 5 s.
  if (responses && typeof responses === "object") {
    let lr = roomLiveResponses.get(code);
    if (!lr) { lr = new Map(); roomLiveResponses.set(code, lr); }
    // Sanitize: only keep non-empty string values, cap length
    const safe: Record<string, string> = {};
    for (const [k, v] of Object.entries(responses)) {
      if (typeof v === "string" && v.trim().length > 0) {
        safe[String(k).slice(0, 60)] = v.trim().slice(0, 80);
      }
    }
    lr.set(playerId, { name: String(playerName ?? "?").slice(0, 30), responses: safe, ts: Date.now() });
  }

  // Lightweight broadcast — re-fetch room and broadcast formatted state
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (rooms.length > 0) broadcastAndFormat(rooms[0]);
  res.json({ ok: true });
});

// 🕵️ POST /rooms/:roomCode/spy — peek at one rival's in-progress answer.
// 1 use per round per player. Client should apply -10 pts at submission time.
router.post("/:roomCode/spy", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const { playerId } = req.body as { playerId: string };
  if (!playerId) { res.status(400).json({ error: "Missing playerId" }); return; }

  // Auth: caller must actually be in the room AND the round must be live
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }
  const room = rooms[0];
  if (room.status !== "playing") {
    res.status(409).json({ error: "El espionaje sólo está activo durante la ronda" });
    return;
  }
  const players = parsePlayers(room.playersJson);
  if (!players.some((p: any) => p.playerId === playerId)) {
    res.status(403).json({ error: "No estás en esta sala" });
    return;
  }

  // Enforce per-round usage limit (premium gets 2x)
  let used = roomSpyUsage.get(code);
  if (!used) { used = new Map(); roomSpyUsage.set(code, used); }
  const callerPremium = await isPlayerPremium(playerId);
  const limit = callerPremium ? SPY_LIMIT_PREMIUM : SPY_LIMIT_FREE;
  const current = used.get(playerId) ?? 0;
  if (current >= limit) {
    res.status(429).json({
      error: callerPremium
        ? "Ya usaste tus 2 espías esta ronda"
        : "Ya espiaste esta ronda. Hazte Premium para 2 usos por ronda.",
    });
    return;
  }

  // Find rivals with at least one fresh non-empty response
  const lr = roomLiveResponses.get(code);
  if (!lr || lr.size === 0) {
    res.status(404).json({ error: "Nadie ha empezado a escribir todavía" });
    return;
  }
  const cutoff = Date.now() - 5000;
  const candidates: Array<{ pid: string; name: string; cat: string; word: string }> = [];
  for (const [pid, info] of lr.entries()) {
    if (pid === playerId) continue;
    if (info.ts < cutoff) continue;
    for (const [cat, word] of Object.entries(info.responses)) {
      if (word && word.length > 0) candidates.push({ pid, name: info.name, cat, word });
    }
  }
  if (candidates.length === 0) {
    res.status(404).json({ error: "Tus rivales aún no escribieron nada 🤷" });
    return;
  }
  const pick = candidates[Math.floor(Math.random() * candidates.length)];
  used.set(playerId, current + 1);
  res.json({
    rivalName: pick.name,
    category: pick.cat,
    word: pick.word,
    usesLeft: limit - (current + 1),
    limit,
  });
});

// 👏 POST /rooms/:roomCode/funvote — vote for the funniest answer of the round.
// 1 vote per round per voter. Voting again replaces the previous vote.
router.post("/:roomCode/funvote", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const { playerId, votedPlayerId, category, round, answer } = req.body as {
    playerId?: string;
    votedPlayerId?: string;
    category?: string;
    round?: number;
    answer?: string;
  };
  if (!playerId || !votedPlayerId || !category || typeof round !== "number") {
    res.status(400).json({ error: "Missing fields" }); return;
  }
  if (playerId === votedPlayerId) {
    res.status(400).json({ error: "No puedes votarte a ti mismo" }); return;
  }

  // Membership check + round must be revealing/finished
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }
  const room = rooms[0];
  const players = parsePlayers(room.playersJson);
  if (!players.some((p: any) => p.playerId === playerId)) {
    res.status(403).json({ error: "No estás en esta sala" }); return;
  }
  if (!players.some((p: any) => p.playerId === votedPlayerId)) {
    res.status(404).json({ error: "Ese jugador no está en la sala" }); return;
  }

  let votes = roomFunVotes.get(code);
  if (!votes) { votes = new Map(); roomFunVotes.set(code, votes); }
  const key = `${round}:${playerId}`;
  votes.set(key, {
    round,
    voterId: playerId,
    votedPlayerId,
    category: String(category).slice(0, 60),
    answer: String(answer ?? "").slice(0, 80),
  });

  broadcastAndFormat(room);
  res.json({ ok: true });
});

// POST /rooms/:roomCode/rematch — first caller creates a new room with same settings,
// the new code is broadcast to everyone in the original room so they can jump in with one tap.
router.post("/:roomCode/rematch", async (req, res) => {
  const oldCode = req.params.roomCode.toUpperCase();
  const { playerId, playerName, avatarColor } = req.body as { playerId: string; playerName: string; avatarColor?: string };

  // Already created by another player → just return it
  const existingNew = roomRematch.get(oldCode);
  if (existingNew) { res.json({ rematchCode: existingNew }); return; }

  const oldRooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, oldCode)).limit(1);
  if (oldRooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }
  const oldRoom = oldRooms[0];

  // New room = same settings, this player as host
  let newCode = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const exists = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, newCode)).limit(1);
    if (exists.length === 0) break;
    newCode = generateRoomCode();
  }

  const players = [{
    playerId,
    playerName: playerName ?? "?",
    avatarColor: avatarColor ?? "#e53e3e",
    score: 0,
    roundScore: 0,
    isHost: true,
    isReady: false,
  }];

  await db.insert(roomsTable).values({
    roomCode: newCode,
    hostId: playerId,
    hostName: playerName ?? "",
    status: "waiting",
    currentRound: 0,
    maxRounds: oldRoom.maxRounds,
    maxPlayers: oldRoom.maxPlayers ?? 8,
    gameMode: oldRoom.gameMode ?? "classic",
    language: oldRoom.language,
    playersJson: JSON.stringify(players),
    stopperJson: null,
    isPublic: false,
  });

  roomRematch.set(oldCode, newCode);
  // Auto-clear after 5 minutes so the link doesn't linger forever
  setTimeout(() => roomRematch.delete(oldCode), 5 * 60 * 1000);

  // Broadcast the rematchCode to everyone still subscribed to the old room
  broadcastAndFormat(oldRoom);

  res.json({ rematchCode: newCode });
});

router.post("/:roomCode/phrase", async (req, res) => {
  const code = req.params.roomCode.toUpperCase();
  const { playerName, phraseIndex } = req.body as { playerName: string; phraseIndex: number };
  if (phraseIndex < 0 || phraseIndex >= QUICK_PHRASES.length) {
    res.status(400).json({ error: "Invalid phrase" }); return;
  }
  const phrase: QuickPhrase = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    playerName: String(playerName ?? "?").slice(0, 30),
    text: QUICK_PHRASES[phraseIndex],
    ts: Date.now(),
  };
  const existing = getPhrases(code);
  roomPhrases.set(code, [...existing, phrase].slice(-30));
  // 🚀 Push phrases to all clients in real time
  try {
    const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
    if (rooms.length > 0) broadcastAndFormat(rooms[0]);
  } catch {}
  res.json({ ok: true });
});

// POST /rooms/:roomCode/stop — ANY player calls this to stop the round globally
router.post("/:roomCode/stop", async (req, res) => {
  const { roomCode } = req.params;
  const { playerId, playerName } = req.body;

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];

  // Only stop if currently playing (ignore duplicate stops)
  if (room.status !== "playing") {
    res.json(formatRoom(room));
    return;
  }

  const stopper = { id: playerId, name: playerName, stopTimestamp: Date.now() };

  const [updated] = await db.update(roomsTable)
    .set({
      status: "stopped",
      stopperJson: JSON.stringify(stopper),
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(broadcastAndFormat(updated));
});

// POST /rooms/:roomCode/results — each player submits their answers after STOP
// Hard cap on category submissions per round to prevent score inflation via fake category keys.
// Standard Scattergories decks across all supported languages have ≤12 categories; 15 gives margin.
const MAX_CATEGORIES_PER_ROUND = 15;

router.post("/:roomCode/results", async (req, res) => {
  const { roomCode } = req.params;
  const body = SubmitRoomResultsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  if (room.status !== "stopped" && room.status !== "playing") {
    res.json(formatRoom(room));
    return;
  }

  // ── Idempotency guard ─────────────────────────────────────────────────────
  // If this player already submitted for the current round (isReady === true),
  // return the current room state without re-applying score — prevents double-submit cheats.
  const existingPlayers = parsePlayers(room.playersJson);
  const me = existingPlayers.find((p: any) => p.playerId === body.data.playerId);
  if (me?.isReady === true) {
    res.json(formatRoom(room));
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  // ── Timing exploit guard ──────────────────────────────────────────────────
  // Players have at most 20 s after STOP is called to submit their answers.
  // (Freeze countdown is 8 s + 12 s network grace.)
  const SUBMIT_GRACE_MS = 20_000;
  const stopMeta = parseBluffMeta(room.stopperJson);
  const stopTimestamp: number | undefined =
    stopMeta?.stopTimestamp ?? stopMeta?.stopper?.stopTimestamp;
  if (stopTimestamp && Date.now() - stopTimestamp > SUBMIT_GRACE_MS) {
    // Too late — accept the submission but zero out the score to prevent cheating
    // (we still need to mark them ready so the round can proceed)
    const latePlayers = existingPlayers.map((p: any) =>
      p.playerId === body.data.playerId ? { ...p, isReady: true, roundScore: 0 } : p
    );
    const allReady = latePlayers.every((p: any) => p.isReady);
    const lateUpdate = await db.update(roomsTable)
      .set({ playersJson: JSON.stringify(latePlayers), status: allReady ? "waiting" : room.status, updatedAt: new Date() })
      .where(and(eq(roomsTable.roomCode, roomCode.toUpperCase()), eq(roomsTable.updatedAt, room.updatedAt)))
      .returning();
    if (lateUpdate.length === 0) {
      // Concurrent write — return latest state
      const [refreshed] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
      res.json(formatRoom(refreshed));
      return;
    }
    res.json(formatRoom(lateUpdate[0]));
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const players = existingPlayers;
  const { playerId, roundScore, bluffedCategories, bluffedWords } = body.data;

  // Update this player's score and mark as ready; store bluff data
  const { answers } = body.data;

  // ── T002: Letter validation — strip answers that don't start with the correct letter
  const letter = (room.currentLetter ?? "A").toUpperCase();
  const safeAnswers: Record<string, string> = {};
  let validAnswerCount = 0;
  if (answers && typeof answers === "object") {
    const entries = Object.entries(answers).slice(0, MAX_CATEGORIES_PER_ROUND);
    for (const [cat, val] of entries) {
      if (typeof val === "string" && val.trim().length > 0) {
        const word = val.trim().slice(0, 80);
        if (word.toUpperCase().startsWith(letter)) {
          safeAnswers[cat] = word;
          validAnswerCount++;
        }
        // Answers starting with wrong letter are silently dropped
      }
    }
  }
  // Hard cap valid count to prevent score inflation via fake category keys
  validAnswerCount = Math.min(validAnswerCount, MAX_CATEGORIES_PER_ROUND);
  // Cap roundScore to prevent client-side inflation: max 10 pts per valid answer + 20 bluff bonus each
  let cappedRoundScore = Math.min(Math.max(0, roundScore), validAnswerCount * 30);
  // 🕵️ Authoritative spy penalty: -10 pts if the server registered a spy use this round
  const spies = roomSpyUsage.get(roomCode.toUpperCase());
  if (spies?.has(playerId)) {
    cappedRoundScore = Math.max(0, cappedRoundScore - 10);
  }

  const updatedPlayers = players.map((p: any) => {
    if (p.playerId === playerId) {
      return {
        ...p,
        score: (p.score || 0) + cappedRoundScore,
        roundScore: cappedRoundScore,
        isReady: true,
        answers: safeAnswers,
        bluffedCategories: bluffedCategories ?? [],
        bluffedWords: bluffedWords ?? {},
      };
    }
    return p;
  });

  const allReady = updatedPlayers.every((p: any) => p.isReady);

  let newStatus = room.status;
  let newLetter = room.currentLetter;
  let newRound = room.currentRound;
  let newStopperJson = room.stopperJson;

  if (allReady) {
    // Check if any player bluffed
    const bluffers = updatedPlayers.filter((p: any) => p.bluffedCategories?.length > 0);
    const nonBluffers = updatedPlayers.filter((p: any) => !p.bluffedCategories?.length);

    if (bluffers.length > 0 && nonBluffers.length > 0) {
      // Enter bluff-voting phase: give opponents 15 seconds to vote
      const bluffDeadline = new Date(Date.now() + 15_000).toISOString();
      const bluffVotes: Record<string, any> = {};
      for (const b of bluffers) {
        bluffVotes[b.playerId] = {};
        for (const cat of b.bluffedCategories) {
          bluffVotes[b.playerId][cat] = {}; // { voterId: "lie"|"real" }
        }
      }
      const existingMeta = parseBluffMeta(room.stopperJson);
      newStopperJson = JSON.stringify({
        stopper: existingMeta?.stopper ?? existingMeta,
        bluffVotes,
        bluffDeadline,
      });
      newStatus = "bluffvoting";
    } else {
      // No bluffs — advance normally
      newRound = room.currentRound + 1;
      const isGameOver = newRound > room.maxRounds;
      if (isGameOver) {
        newStatus = "finished";
        newRound = room.maxRounds;
        submitAllScoresToLeaderboard(updatedPlayers, room.currentLetter || "A").catch(() => {});
      } else {
        newStatus = "waiting";
        newLetter = randomLetter();
      }
      // 🕵️ Reset spy budgets and stale live responses for the new round
      roomSpyUsage.delete(roomCode.toUpperCase());
      roomLiveResponses.delete(roomCode.toUpperCase());
    }
  }

  // Optimistic concurrency: only update if the room hasn't changed since we read it.
  // If a concurrent /results submission won the race, return the latest state instead.
  const updateResult = await db.update(roomsTable)
    .set({
      playersJson: JSON.stringify(updatedPlayers),
      currentRound: newRound,
      currentLetter: newLetter,
      status: newStatus,
      stopperJson: newStopperJson,
      updatedAt: new Date(),
    })
    .where(and(eq(roomsTable.roomCode, roomCode.toUpperCase()), eq(roomsTable.updatedAt, room.updatedAt)))
    .returning();

  if (updateResult.length === 0) {
    // Lost the race — return latest authoritative state without re-applying score
    const [refreshed] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
    res.json(formatRoom(refreshed));
    return;
  }

  res.json(broadcastAndFormat(updateResult[0]));
});

// POST /rooms/:roomCode/bluff-vote — opponent casts "lie" or "real" for a bluffed category
router.post("/:roomCode/bluff-vote", async (req, res) => {
  const { roomCode } = req.params;
  const { voterId, accusedPlayerId, category, vote } = req.body as {
    voterId: string;
    accusedPlayerId: string;
    category: string;
    vote: "lie" | "real";
  };

  if (!voterId || !accusedPlayerId || !category || !["lie","real"].includes(vote)) {
    res.status(400).json({ error: "Invalid vote data" });
    return;
  }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  if (room.status !== "bluffvoting") { res.json(formatRoom(room)); return; }

  const meta = parseBluffMeta(room.stopperJson) ?? {};
  const bluffVotes = meta.bluffVotes ?? {};
  const bluffDeadline = meta.bluffDeadline ?? new Date().toISOString();

  // Store this player's vote
  if (bluffVotes[accusedPlayerId]?.[category] !== undefined) {
    bluffVotes[accusedPlayerId][category][voterId] = vote;
  }

  const players = parsePlayers(room.playersJson);
  const nonBlufferIds = players.filter((p: any) => !p.bluffedCategories?.length).map((p: any) => p.playerId);

  // Check if all non-bluffers have voted on all categories
  let allVoted = true;
  for (const [pid, cats] of Object.entries(bluffVotes)) {
    for (const [, votes] of Object.entries(cats as Record<string, any>)) {
      for (const nbId of nonBlufferIds) {
        if (!(votes as any)[nbId]) { allVoted = false; break; }
      }
      if (!allVoted) break;
    }
    if (!allVoted) break;
  }

  // Also auto-resolve if deadline has passed
  const deadlinePassed = Date.now() > new Date(bluffDeadline).getTime();

  if (allVoted || deadlinePassed) {
    // Resolve bluffs
    const resolved = resolveBluffs(players, bluffVotes);
    const newRound = room.currentRound + 1;
    const isGameOver = newRound > room.maxRounds;
    const newStatus = isGameOver ? "finished" : "waiting";
    if (isGameOver) {
      submitAllScoresToLeaderboard(resolved, room.currentLetter || "A").catch(() => {});
    }
    const [updated] = await db.update(roomsTable)
      .set({
        playersJson: JSON.stringify(resolved),
        currentRound: isGameOver ? room.maxRounds : newRound,
        currentLetter: isGameOver ? room.currentLetter : randomLetter(),
        status: newStatus,
        stopperJson: JSON.stringify({ stopper: meta.stopper, bluffResults: bluffVotes }),
        updatedAt: new Date(),
      })
      .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
      .returning();
    // 🚀 Broadcast resolution to all players (was waiting for polling — main lag in bluff phase)
    res.json(broadcastAndFormat(updated));
    return;
  }

  // Save partial votes and return updated room
  const newMeta = { ...meta, bluffVotes };
  const [updated] = await db.update(roomsTable)
    .set({ stopperJson: JSON.stringify(newMeta), updatedAt: new Date() })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  // 🚀 Broadcast partial vote progress so everyone sees votes coming in live
  res.json(broadcastAndFormat(updated));
});

// POST /rooms/:roomCode/resolve-bluffs — force-resolve after deadline (called by any client polling)
router.post("/:roomCode/resolve-bluffs", async (req, res) => {
  const { roomCode } = req.params;

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  if (room.status !== "bluffvoting") { res.json(formatRoom(room)); return; }

  const meta = parseBluffMeta(room.stopperJson) ?? {};
  const bluffDeadline = meta.bluffDeadline;
  if (bluffDeadline && Date.now() < new Date(bluffDeadline).getTime()) {
    // Deadline hasn't passed yet
    res.json(formatRoom(room));
    return;
  }

  const players = parsePlayers(room.playersJson);
  const bluffVotes = meta.bluffVotes ?? {};
  const resolved = resolveBluffs(players, bluffVotes);

  const newRound = room.currentRound + 1;
  const isGameOver = newRound > room.maxRounds;
  const newStatus = isGameOver ? "finished" : "waiting";
  if (isGameOver) {
    submitAllScoresToLeaderboard(resolved, room.currentLetter || "A").catch(() => {});
  }

  const [updated] = await db.update(roomsTable)
    .set({
      playersJson: JSON.stringify(resolved),
      currentRound: isGameOver ? room.maxRounds : newRound,
      currentLetter: isGameOver ? room.currentLetter : randomLetter(),
      status: newStatus,
      stopperJson: JSON.stringify({ stopper: meta.stopper, bluffResults: bluffVotes }),
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(broadcastAndFormat(updated));
});

export default router;
