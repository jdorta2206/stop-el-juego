import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
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

function parseRoomPlayers(json: string): any[] {
  try { return JSON.parse(json); } catch { return []; }
}

function randomLetter(): string {
  return ALPHABET_ES[Math.floor(Math.random() * ALPHABET_ES.length)];
}

function formatRoom(room: any) {
  return {
    id: room.id,
    roomCode: room.roomCode,
    hostId: room.hostId,
    status: room.status,
    currentLetter: room.currentLetter,
    currentRound: room.currentRound,
    maxRounds: room.maxRounds,
    language: room.language,
    players: parseRoomPlayers(room.playersJson),
    createdAt: room.createdAt,
  };
}

// POST /rooms — create room
router.post("/", async (req, res) => {
  const body = CreateRoomBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const { hostId, hostName, avatarColor, maxRounds, language } = body.data;

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
    score: 0,
    roundScore: 0,
    isHost: true,
    isReady: false,
  }];

  const [room] = await db.insert(roomsTable).values({
    roomCode,
    hostId,
    status: "waiting",
    currentRound: 0,
    maxRounds: maxRounds ?? 3,
    language: language ?? "es",
    playersJson: JSON.stringify(players),
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
  const players = parseRoomPlayers(room.playersJson);
  const { playerId, playerName, avatarColor } = body.data;

  if (!players.find((p: any) => p.playerId === playerId)) {
    players.push({
      playerId,
      playerName,
      avatarColor: avatarColor ?? "#3182ce",
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

// POST /rooms/:roomCode/start — host starts the game / next round
router.post("/:roomCode/start", async (req, res) => {
  const { roomCode } = req.params;
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  const players = parseRoomPlayers(room.playersJson);

  // Reset all isReady and roundScore
  const resetPlayers = players.map((p: any) => ({ ...p, isReady: false, roundScore: 0 }));
  const newRound = room.currentRound === 0 ? 1 : room.currentRound;
  const letter = randomLetter();

  const [updated] = await db.update(roomsTable)
    .set({
      status: "playing",
      currentRound: newRound,
      currentLetter: letter,
      playersJson: JSON.stringify(resetPlayers),
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
});

// POST /rooms/:roomCode/results — player submits their round answers
router.post("/:roomCode/results", async (req, res) => {
  const { roomCode } = req.params;
  const body = SubmitRoomResultsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  const players = parseRoomPlayers(room.playersJson);
  const { playerId, roundScore } = body.data;

  // Update player score and mark ready
  const updatedPlayers = players.map((p: any) => {
    if (p.playerId === playerId) {
      return { ...p, score: (p.score || 0) + roundScore, roundScore, isReady: true };
    }
    return p;
  });

  const allReady = updatedPlayers.every((p: any) => p.isReady);
  const newRound = allReady ? room.currentRound + 1 : room.currentRound;
  const isGameOver = newRound > room.maxRounds;

  let newStatus = room.status;
  let newLetter = room.currentLetter;
  let finalPlayers = updatedPlayers;

  if (allReady) {
    if (isGameOver) {
      newStatus = "finished";
    } else {
      // Auto-advance to next round immediately
      newStatus = "playing";
      newLetter = randomLetter();
      // Reset isReady and roundScore for new round
      finalPlayers = updatedPlayers.map((p: any) => ({ ...p, isReady: false, roundScore: 0 }));
    }
  }

  const [updated] = await db.update(roomsTable)
    .set({
      playersJson: JSON.stringify(finalPlayers),
      currentRound: newRound > room.maxRounds ? room.maxRounds : newRound,
      currentLetter: newLetter,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
});

export default router;
