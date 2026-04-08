import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable, playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, and, lt } from "drizzle-orm";
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

function parseBluffMeta(json: string | null): any | null {
  if (!json) return null;
  try { return JSON.parse(json); } catch { return null; }
}

function formatRoom(room: any) {
  const meta = parseBluffMeta(room.stopperJson);
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
    stopper: meta?.stopper ?? meta,
    bluffData: meta?.bluffVotes ?? null,
    bluffVoteDeadline: meta?.bluffDeadline ?? null,
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

// Delete stale "waiting" rooms older than 2 hours (guests leave without cleanup)
async function purgeStaleRooms() {
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
  await db.delete(roomsTable).where(
    and(eq(roomsTable.status, "waiting"), lt(roomsTable.updatedAt, twoHoursAgo))
  );
}

// GET /rooms/public — list open public rooms (also purges stale rooms)
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
    res.json({ ok: true, deleted: true });
    return;
  }

  // Regular player leaves → remove from players list
  const remaining = players.filter((p: any) => p.playerId !== playerId);
  await db.update(roomsTable)
    .set({ playersJson: JSON.stringify(remaining), updatedAt: new Date() })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()));

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
  if (room.status !== "stopped" && room.status !== "playing") {
    res.json(formatRoom(room));
    return;
  }

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
    const latePlayers = parsePlayers(room.playersJson).map((p: any) =>
      p.playerId === body.data.playerId ? { ...p, isReady: true, roundScore: 0 } : p
    );
    const allReady = latePlayers.every((p: any) => p.isReady);
    await db.update(roomsTable)
      .set({ playersJson: JSON.stringify(latePlayers), status: allReady ? "waiting" : room.status, updatedAt: new Date() })
      .where(eq(roomsTable.roomCode, roomCode.toUpperCase()));
    const [refreshed] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
    res.json(formatRoom(refreshed));
    return;
  }
  // ─────────────────────────────────────────────────────────────────────────

  const players = parsePlayers(room.playersJson);
  const { playerId, roundScore, bluffedCategories, bluffedWords } = body.data;

  // Update this player's score and mark as ready; store bluff data
  const updatedPlayers = players.map((p: any) => {
    if (p.playerId === playerId) {
      return {
        ...p,
        score: (p.score || 0) + roundScore,
        roundScore,
        isReady: true,
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
    }
  }

  const [updated] = await db.update(roomsTable)
    .set({
      playersJson: JSON.stringify(updatedPlayers),
      currentRound: newRound,
      currentLetter: newLetter,
      status: newStatus,
      stopperJson: newStopperJson,
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
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
    res.json(formatRoom(updated));
    return;
  }

  // Save partial votes and return updated room
  const newMeta = { ...meta, bluffVotes };
  const [updated] = await db.update(roomsTable)
    .set({ stopperJson: JSON.stringify(newMeta), updatedAt: new Date() })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(formatRoom(updated));
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

  res.json(formatRoom(updated));
});

export default router;
