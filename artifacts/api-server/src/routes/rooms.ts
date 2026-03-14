import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable, playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateRoomBody, JoinRoomBody, SubmitRoomResultsBody } from "@workspace/api-zod";

const router: IRouter = Router();

const ALPHABET_ES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(l => !["Q","X"].includes(l));

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

function formatRoom(room: any) {
  return {
    id: room.id,
    roomCode: room.roomCode,
    hostId: room.hostId,
    hostName: room.hostName || "",
    status: room.status,
    currentLetter: room.currentLetter,
    currentRound: room.currentRound,
    maxRounds: room.maxRounds,
    language: room.language,
    isPublic: room.isPublic ?? false,
    players: parsePlayers(room.playersJson),
    stopper: parseStopper(room.stopperJson),
    createdAt: room.createdAt,
  };
}

// Auto-submit all non-guest players' scores to the global leaderboard when the game ends
async function submitAllScoresToLeaderboard(players: any[], letter: string) {
  const winner = [...players].sort((a, b) => (b.score || 0) - (a.score || 0))[0];

  await Promise.allSettled(players.map(async (p: any) => {
    // Skip guests and players with 0 or no score
    if (!p.playerId || p.loginMethod === "guest") return;

    const score = p.score || 0;
    const won = winner?.playerId === p.playerId;

    const existing = await db
      .select()
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, p.playerId))
      .limit(1);

    if (existing.length > 0) {
      await db.update(playerScoresTable)
        .set({
          playerName: p.playerName,
          avatarColor: p.avatarColor ?? existing[0].avatarColor,
          totalScore: existing[0].totalScore + score,
          gamesPlayed: existing[0].gamesPlayed + 1,
          wins: existing[0].wins + (won ? 1 : 0),
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

// GET /rooms/public — list open public rooms
router.get("/public", async (_req, res) => {
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

  let roomCode = generateRoomCode();
  for (let i = 0; i < 5; i++) {
    const existing = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode)).limit(1);
    if (existing.length === 0) break;
    roomCode = generateRoomCode();
  }

  const players = [{
    playerId: hostId,
    playerName: hostName,
    avatarColor: avatarColor ?? "#e53e3e",
    loginMethod: loginMethod ?? null,
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

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  const players = parsePlayers(room.playersJson);
  const { playerId, playerName, avatarColor, loginMethod } = body.data;

  if (!players.find((p: any) => p.playerId === playerId)) {
    players.push({
      playerId,
      playerName,
      avatarColor: avatarColor ?? "#3182ce",
      loginMethod: loginMethod ?? null,
      score: 0,
      roundScore: 0,
      isHost: false,
      isReady: false,
    });
  }

  const [updated] = await db.update(roomsTable)
    .set({ playersJson: JSON.stringify(players), updatedAt: new Date() })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
});

// POST /rooms/:roomCode/start — host starts / continues the game
router.post("/:roomCode/start", async (req, res) => {
  const { roomCode } = req.params;
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  const players = parsePlayers(room.playersJson);

  // Reset all ready flags and round scores for new round
  const resetPlayers = players.map((p: any) => ({ ...p, isReady: false, roundScore: 0 }));
  const newRound = room.currentRound === 0 ? 1 : room.currentRound;

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

  res.json(formatRoom(updated));
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

  const stopper = { id: playerId, name: playerName };

  const [updated] = await db.update(roomsTable)
    .set({
      status: "stopped",
      stopperJson: JSON.stringify(stopper),
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
});

// POST /rooms/:roomCode/results — each player submits their answers after STOP
router.post("/:roomCode/results", async (req, res) => {
  const { roomCode } = req.params;
  const body = SubmitRoomResultsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];

  // Must be stopped or playing to submit
  if (room.status !== "stopped" && room.status !== "playing") {
    res.json(formatRoom(room));
    return;
  }

  const players = parsePlayers(room.playersJson);
  const { playerId, roundScore } = body.data;

  // Update this player's score and mark as ready
  const updatedPlayers = players.map((p: any) => {
    if (p.playerId === playerId) {
      return { ...p, score: (p.score || 0) + roundScore, roundScore, isReady: true };
    }
    return p;
  });

  const allReady = updatedPlayers.every((p: any) => p.isReady);

  let newStatus = room.status;
  let newLetter = room.currentLetter;
  let newRound = room.currentRound;
  let finalPlayers = updatedPlayers;

  if (allReady) {
    newRound = room.currentRound + 1;
    const isGameOver = newRound > room.maxRounds;

    if (isGameOver) {
      newStatus = "finished";
      newRound = room.maxRounds;

      // Auto-submit scores server-side for all non-guest players
      submitAllScoresToLeaderboard(updatedPlayers, room.currentLetter || "A").catch(() => {});
    } else {
      // Go back to waiting — host will click "Siguiente Ronda" to continue
      newStatus = "waiting";
      newLetter = randomLetter();
    }
  }

  const [updated] = await db.update(roomsTable)
    .set({
      playersJson: JSON.stringify(finalPlayers),
      currentRound: newRound,
      currentLetter: newLetter,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
});

export default router;
