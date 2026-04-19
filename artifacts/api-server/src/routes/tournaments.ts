import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tournamentsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

const router: IRouter = Router();

function randomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function parsePlayers(json: string | null): any[] {
  try { return JSON.parse(json ?? "[]"); } catch { return []; }
}

function parseBracket(json: string | null): any {
  try { return JSON.parse(json ?? "null"); } catch { return null; }
}

function formatTournament(t: any) {
  return {
    id: t.id,
    code: t.code,
    hostId: t.hostId,
    hostName: t.hostName,
    name: t.name,
    status: t.status,
    size: t.size,
    isPublic: !!t.isPublic,
    players: parsePlayers(t.playersJson),
    bracket: parseBracket(t.bracketJson),
    createdAt: t.createdAt,
    updatedAt: t.updatedAt,
  };
}

function buildBracket(players: any[]): any {
  // Shuffle players randomly
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const numPlayers = shuffled.length; // 4 or 8
  const numRounds = Math.log2(numPlayers); // 2 rounds for 4, 3 rounds for 8

  const rounds: any[][] = [];
  const firstRound: any[] = [];
  for (let i = 0; i < shuffled.length; i += 2) {
    firstRound.push({
      id: `r1m${i / 2 + 1}`,
      p1Id: shuffled[i].playerId,
      p1Name: shuffled[i].playerName,
      p2Id: shuffled[i + 1].playerId,
      p2Name: shuffled[i + 1].playerName,
      winnerId: null,
      winnerName: null,
      roomCode: null,
      status: "pending", // pending | playing | done
    });
  }
  rounds.push(firstRound);

  // Build empty subsequent rounds
  for (let r = 1; r < numRounds; r++) {
    const matchCount = Math.pow(2, numRounds - r - 1);
    const emptyRound: any[] = [];
    for (let m = 0; m < matchCount; m++) {
      emptyRound.push({
        id: `r${r + 1}m${m + 1}`,
        p1Id: null, p1Name: "TBD",
        p2Id: null, p2Name: "TBD",
        winnerId: null, winnerName: null,
        roomCode: null,
        status: "pending",
      });
    }
    rounds.push(emptyRound);
  }

  return { rounds, currentRound: 0, champion: null };
}

// Advance winners to next round
function advanceBracket(bracket: any): any {
  const { rounds, currentRound } = bracket;
  const round = rounds[currentRound];
  const allDone = round.every((m: any) => m.status === "done");
  if (!allDone) return bracket;

  const nextRoundIdx = currentRound + 1;
  if (nextRoundIdx >= rounds.length) {
    // Final match done → champion
    const finalMatch = round[0];
    return { ...bracket, champion: { id: finalMatch.winnerId, name: finalMatch.winnerName } };
  }

  // Advance winners to next round
  const nextRound = [...rounds[nextRoundIdx]];
  const winners = round.map((m: any) => ({ id: m.winnerId, name: m.winnerName }));
  for (let i = 0; i < winners.length; i += 2) {
    const matchIdx = Math.floor(i / 2);
    nextRound[matchIdx] = {
      ...nextRound[matchIdx],
      p1Id: winners[i].id, p1Name: winners[i].name,
      p2Id: winners[i + 1].id, p2Name: winners[i + 1].name,
    };
  }

  const updatedRounds = [...rounds];
  updatedRounds[nextRoundIdx] = nextRound;
  return { ...bracket, rounds: updatedRounds, currentRound: nextRoundIdx };
}

// POST /api/tournaments — create
router.post("/", async (req, res) => {
  const { hostId, hostName, name, size, isPublic } = req.body as {
    hostId: string; hostName: string; name: string; size: number; isPublic?: boolean;
  };
  if (!hostId || !name) { res.status(400).json({ error: "Missing fields" }); return; }
  const safeSize = [4, 8].includes(size) ? size : 4;
  const code = randomCode();

  const players = [{ playerId: hostId, playerName: hostName ?? "Host" }];

  const [t] = await db.insert(tournamentsTable).values({
    code,
    hostId,
    hostName: hostName ?? "Host",
    name,
    status: "waiting",
    size: safeSize,
    isPublic: !!isPublic,
    playersJson: JSON.stringify(players),
    bracketJson: null,
  }).returning();

  res.json(formatTournament(t));
});

// GET /api/tournaments/public — list open public tournaments waiting for players
router.get("/public", async (_req, res) => {
  const rows = await db.select().from(tournamentsTable)
    .where(and(eq(tournamentsTable.isPublic, true), eq(tournamentsTable.status, "waiting")))
    .orderBy(desc(tournamentsTable.createdAt))
    .limit(30);
  res.json(rows.map(formatTournament).filter(t => t.players.length < t.size));
});

// GET /api/tournaments/:code — poll
router.get("/:code", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const rows = await db.select().from(tournamentsTable).where(eq(tournamentsTable.code, code)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatTournament(rows[0]));
});

// POST /api/tournaments/:code/join
router.post("/:code/join", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId, playerName } = req.body as { playerId: string; playerName: string };
  const rows = await db.select().from(tournamentsTable).where(eq(tournamentsTable.code, code)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

  const t = rows[0];
  if (t.status !== "waiting") { res.status(400).json({ error: "Tournament already started" }); return; }

  const players = parsePlayers(t.playersJson);
  if (players.some(p => p.playerId === playerId)) {
    res.json(formatTournament(t)); return; // already joined
  }
  if (players.length >= t.size) { res.status(400).json({ error: "Tournament full" }); return; }

  players.push({ playerId, playerName });
  const [updated] = await db.update(tournamentsTable)
    .set({ playersJson: JSON.stringify(players), updatedAt: new Date() })
    .where(eq(tournamentsTable.code, code))
    .returning();

  res.json(formatTournament(updated));
});

// POST /api/tournaments/:code/start — host starts bracket
router.post("/:code/start", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { hostId } = req.body as { hostId: string };
  const rows = await db.select().from(tournamentsTable).where(eq(tournamentsTable.code, code)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

  const t = rows[0];
  if (t.hostId !== hostId) { res.status(403).json({ error: "Not host" }); return; }
  if (t.status !== "waiting") { res.status(400).json({ error: "Already started" }); return; }

  const players = parsePlayers(t.playersJson);
  if (players.length < 4 || (players.length !== 4 && players.length !== 8)) {
    res.status(400).json({ error: "Need exactly 4 or 8 players" }); return;
  }

  const bracket = buildBracket(players);

  const [updated] = await db.update(tournamentsTable)
    .set({ status: "active", bracketJson: JSON.stringify(bracket), updatedAt: new Date() })
    .where(eq(tournamentsTable.code, code))
    .returning();

  res.json(formatTournament(updated));
});

// POST /api/tournaments/:code/start-match — assign a room to a match
router.post("/:code/start-match", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { matchId, roomCode } = req.body as { matchId: string; roomCode: string };
  const rows = await db.select().from(tournamentsTable).where(eq(tournamentsTable.code, code)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

  const t = rows[0];
  const bracket = parseBracket(t.bracketJson);
  if (!bracket) { res.status(400).json({ error: "No bracket" }); return; }

  const currentRound = bracket.rounds[bracket.currentRound];
  const matchIdx = currentRound.findIndex((m: any) => m.id === matchId);
  if (matchIdx === -1) { res.status(404).json({ error: "Match not found" }); return; }

  currentRound[matchIdx] = { ...currentRound[matchIdx], roomCode, status: "playing" };
  bracket.rounds[bracket.currentRound] = currentRound;

  const [updated] = await db.update(tournamentsTable)
    .set({ bracketJson: JSON.stringify(bracket), updatedAt: new Date() })
    .where(eq(tournamentsTable.code, code))
    .returning();

  res.json(formatTournament(updated));
});

// POST /api/tournaments/:code/match-result — record winner, advance bracket
router.post("/:code/match-result", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { matchId, winnerId, winnerName } = req.body as {
    matchId: string; winnerId: string; winnerName: string;
  };
  const rows = await db.select().from(tournamentsTable).where(eq(tournamentsTable.code, code)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }

  const t = rows[0];
  let bracket = parseBracket(t.bracketJson);
  if (!bracket) { res.status(400).json({ error: "No bracket" }); return; }

  const currentRound = bracket.rounds[bracket.currentRound];
  const matchIdx = currentRound.findIndex((m: any) => m.id === matchId);
  if (matchIdx === -1) { res.status(404).json({ error: "Match not found" }); return; }

  currentRound[matchIdx] = { ...currentRound[matchIdx], winnerId, winnerName, status: "done" };
  bracket.rounds[bracket.currentRound] = currentRound;

  // Try to advance bracket
  bracket = advanceBracket(bracket);

  const newStatus = bracket.champion ? "completed" : "active";

  const [updated] = await db.update(tournamentsTable)
    .set({ bracketJson: JSON.stringify(bracket), status: newStatus, updatedAt: new Date() })
    .where(eq(tournamentsTable.code, code))
    .returning();

  res.json(formatTournament(updated));
});

export default router;
