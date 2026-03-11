import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { CreateRoomBody, JoinRoomBody, SubmitRoomResultsBody } from "@workspace/api-zod";

const router: IRouter = Router();

function generateRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

function parseRoomPlayers(json: string): any[] {
  try {
    return JSON.parse(json);
  } catch {
    return [];
  }
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

router.post("/", async (req, res) => {
  const body = CreateRoomBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { hostId, hostName, avatarColor, maxRounds, language } = body.data;
  
  let roomCode = generateRoomCode();
  let attempts = 0;
  while (attempts < 5) {
    const existing = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode)).limit(1);
    if (existing.length === 0) break;
    roomCode = generateRoomCode();
    attempts++;
  }

  const players = [{
    playerId: hostId,
    playerName: hostName,
    avatarColor: avatarColor ?? "#e53e3e",
    score: 0,
    isHost: true,
    isReady: true,
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

router.get("/:roomCode", async (req, res) => {
  const { roomCode } = req.params;
  
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  
  if (rooms.length === 0) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  res.json(formatRoom(rooms[0]));
});

router.post("/:roomCode/join", async (req, res) => {
  const { roomCode } = req.params;
  const body = JoinRoomBody.safeParse(req.body);
  
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  
  if (rooms.length === 0) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const room = rooms[0];
  const players = parseRoomPlayers(room.playersJson);
  
  const { playerId, playerName, avatarColor } = body.data;
  
  const existing = players.find((p: any) => p.playerId === playerId);
  if (!existing) {
    players.push({
      playerId,
      playerName,
      avatarColor: avatarColor ?? "#3182ce",
      score: 0,
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

router.post("/:roomCode/results", async (req, res) => {
  const { roomCode } = req.params;
  const body = SubmitRoomResultsBody.safeParse(req.body);
  
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  
  if (rooms.length === 0) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const room = rooms[0];
  const players = parseRoomPlayers(room.playersJson);
  const { playerId, roundScore } = body.data;
  
  const updatedPlayers = players.map((p: any) => {
    if (p.playerId === playerId) {
      return { ...p, score: (p.score || 0) + roundScore, isReady: true };
    }
    return p;
  });

  // Check if all players submitted - advance round
  const allReady = updatedPlayers.every((p: any) => p.isReady);
  const newRound = allReady ? room.currentRound + 1 : room.currentRound;
  const newStatus = newRound >= room.maxRounds ? "finished" : (allReady ? "waiting" : "playing");
  
  // Generate random letter for next round
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const newLetter = allReady ? alphabet[Math.floor(Math.random() * alphabet.length)] : room.currentLetter;

  const resetPlayers = allReady ? updatedPlayers.map((p: any) => ({ ...p, isReady: false })) : updatedPlayers;

  const [updated] = await db.update(roomsTable)
    .set({ 
      playersJson: JSON.stringify(resetPlayers), 
      currentRound: newRound,
      currentLetter: newLetter,
      status: newStatus,
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
});

// Start game endpoint (host only)
router.post("/:roomCode/start", async (req, res) => {
  const { roomCode } = req.params;
  
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  
  if (rooms.length === 0) {
    res.status(404).json({ error: "Room not found" });
    return;
  }

  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  const letter = alphabet[Math.floor(Math.random() * alphabet.length)];

  const [updated] = await db.update(roomsTable)
    .set({ status: "playing", currentRound: 1, currentLetter: letter, updatedAt: new Date() })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
});

export default router;
