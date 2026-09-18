import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { tournamentsTable, roomsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { requirePlayerIdentity, verifyClaimedIdentity, type AuthedRequest } from "../lib/playerAuth.js";

const router: IRouter = Router();

function randomCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase();
}

function randomRoomCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) code += chars.charAt(Math.floor(Math.random() * chars.length));
  return code;
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
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  const numPlayers = shuffled.length;
  const numRounds = Math.log2(numPlayers);

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
      status: "pending",
    });
  }
  rounds.push(firstRound);

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

function advanceBracket(bracket: any): any {
  const { rounds, currentRound } = bracket;
  const round = rounds[currentRound];
  const allDone = round.every((m: any) => m.status === "done");
  if (!allDone) return bracket;

  const nextRoundIdx = currentRound + 1;
  if (nextRoundIdx >= rounds.length) {
    const finalMatch = round[0];
    return { ...bracket, champion: { id: finalMatch.winnerId, name: finalMatch.winnerName } };
  }

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

router.post("/", async (req, res) => {
  const { hostId, hostName, name, size, isPublic } = req.body as {
    hostId: string; hostName: string; name: string; size: number; isPublic?: boolean;
  };
  if (!hostId || !name) { res.status(400).json({ error: "Missing fields" }); return; }
  if (!verifyClaimedIdentity(req, hostId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }
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

router.get("/public", async (_req, res) => {
  const rows = await db.select().from(tournamentsTable)
    .where(and(eq(tournamentsTable.isPublic, true), eq(tournamentsTable.status, "waiting")))
    .orderBy(desc(tournamentsTable.createdAt))
    .limit(30);
  res.json(rows.map(formatTournament).filter(t => t.players.length < t.size));
});

router.get("/:code", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const rows = await db.select().from(tournamentsTable).where(eq(tournamentsTable.code, code)).limit(1);
  if (!rows.length) { res.status(404).json({ error: "Not found" }); return; }
  res.json(formatTournament(rows[0]));
});

router.post("/:code/join", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { playerId, playerName } = req.body as { playerId: string; playerName: string };
  if (!playerId || !verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }
  const joined = await db.transaction(async (tx) => {
    const rows = await tx.select().from(tournamentsTable)
      .where(eq(tournamentsTable.code, code))
      .for("update");
    if (!rows.length) return { error: "NOT_FOUND" as const };
    const t = rows[0];
    if (t.status !== "waiting") return { error: "STARTED" as const };

    const players = parsePlayers(t.playersJson);
    if (players.some(p => p.playerId === playerId)) return { tournament: t };
    if (players.length >= t.size) return { error: "FULL" as const };

    players.push({ playerId, playerName });
    const [updated] = await tx.update(tournamentsTable)
      .set({ playersJson: JSON.stringify(players), updatedAt: new Date() })
      .where(eq(tournamentsTable.id, t.id))
      .returning();
    return { tournament: updated };
  });

  if ("error" in joined) {
    if (joined.error === "NOT_FOUND") { res.status(404).json({ error: "Not found" }); return; }
    if (joined.error === "STARTED") { res.status(400).json({ error: "Tournament already started" }); return; }
    res.status(400).json({ error: "Tournament full" }); return;
  }

  res.json(formatTournament(joined.tournament));
});

router.post("/:code/start", async (req, res) => {
  const code = req.params.code.toUpperCase();
  const { hostId } = req.body as { hostId: string };
  if (!hostId || !verifyClaimedIdentity(req, hostId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }

  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(tournamentsTable)
      .where(eq(tournamentsTable.code, code))
      .for("update");
    if (!rows.length) return { error: "NOT_FOUND" as const };
    const t = rows[0];
    if (t.hostId !== hostId) return { error: "NOT_HOST" as const };
    if (t.status !== "waiting") return { error: "STARTED" as const };

    const players = parsePlayers(t.playersJson);
    if (players.length < 4 || (players.length !== 4 && players.length !== 8)) {
      return { error: "BAD_SIZE" as const };
    }

    const bracket = buildBracket(players);
    const [updated] = await tx.update(tournamentsTable)
      .set({ status: "active", bracketJson: JSON.stringify(bracket), updatedAt: new Date() })
      .where(eq(tournamentsTable.id, t.id))
      .returning();
    return { tournament: updated };
  });

  if ("error" in result) {
    if (result.error === "NOT_FOUND") { res.status(404).json({ error: "Not found" }); return; }
    if (result.error === "NOT_HOST") { res.status(403).json({ error: "Not host" }); return; }
    if (result.error === "STARTED") { res.status(400).json({ error: "Already started" }); return; }
    res.status(400).json({ error: "Need exactly 4 or 8 players" }); return;
  }
  res.json(formatTournament(result.tournament));
});

router.post("/:code/start-match", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const code = req.params.code.toUpperCase();
  const { matchId } = req.body as { matchId: string };
  const callerId = req.playerId!;

  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(tournamentsTable)
      .where(eq(tournamentsTable.code, code))
      .for("update");
    if (!rows.length) return { error: "NOT_FOUND" as const };
    const t = rows[0];
    const bracket = parseBracket(t.bracketJson);
    if (!bracket) return { error: "NO_BRACKET" as const };

    const currentRound = bracket.rounds?.[bracket.currentRound];
    if (!Array.isArray(currentRound)) return { error: "BAD_BRACKET" as const };
    const matchIdx = currentRound.findIndex((m: any) => m.id === matchId);
    if (matchIdx === -1) return { error: "MATCH_NOT_FOUND" as const };

    const match = currentRound[matchIdx];
    const isParticipant = callerId === match.p1Id || callerId === match.p2Id;
    const isHost = callerId === t.hostId;
    if (!isParticipant && !isHost) return { error: "NOT_AUTHORIZED" as const };

    if (match.status === "playing" && match.roomCode) {
      return { tournament: t, roomCode: match.roomCode };
    }
    if (match.status !== "pending") return { error: "MATCH_NOT_PENDING" as const };
    if (!match.p1Id || !match.p2Id || match.p1Id === match.p2Id) return { error: "INVALID_MATCH" as const };

    const roomPlayers = [
      { playerId: match.p1Id, playerName: match.p1Name ?? "Player 1" },
      { playerId: match.p2Id, playerName: match.p2Name ?? "Player 2" },
    ];

    let room: any | undefined;
    for (let attempt = 0; attempt < 10; attempt++) {
      try {
        const roomCode = randomRoomCode();
        const inserted = await tx.insert(roomsTable).values({
          roomCode,
          hostId: match.p1Id,
          hostName: match.p1Name ?? "Player 1",
          status: "waiting",
          currentLetter: null,
          currentRound: 0,
          maxRounds: 3,
          maxPlayers: 2,
          gameMode: "classic",
          language: "es",
          playersJson: JSON.stringify(roomPlayers),
          stopperJson: null,
          isPublic: false,
          tournamentId: t.id,
          tournamentMatchId: match.id,
        }).returning();
        room = inserted[0];
        break;
      } catch (err: any) {
        if (!/unique/i.test(err?.message ?? "") || attempt === 9) throw err;
      }
    }
    if (!room) throw new Error("Unable to create tournament room");

    currentRound[matchIdx] = { ...match, roomCode: room.roomCode, status: "playing" };
    bracket.rounds[bracket.currentRound] = currentRound;
    const [updated] = await tx.update(tournamentsTable)
      .set({ bracketJson: JSON.stringify(bracket), updatedAt: new Date() })
      .where(eq(tournamentsTable.id, t.id))
      .returning();

    return { tournament: updated, roomCode: room.roomCode };
  });

  if ("error" in result) {
    const status: Record<string, number> = {
      NOT_FOUND: 404, NO_BRACKET: 400, BAD_BRACKET: 400, MATCH_NOT_FOUND: 404,
      NOT_AUTHORIZED: 403, MATCH_NOT_PENDING: 409, INVALID_MATCH: 400,
    };
    res.status(status[result.error] ?? 400).json({ error: result.error });
    return;
  }

  res.json({ ...formatTournament(result.tournament), roomCode: result.roomCode });
});

router.post("/:code/match-result", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const code = req.params.code.toUpperCase();
  const { matchId } = req.body as { matchId: string };
  const callerId = req.playerId!;

  const result = await db.transaction(async (tx) => {
    const rows = await tx.select().from(tournamentsTable)
      .where(eq(tournamentsTable.code, code))
      .for("update");
    if (!rows.length) return { error: "NOT_FOUND" as const };
    const t = rows[0];
    let bracket = parseBracket(t.bracketJson);
    if (!bracket) return { error: "NO_BRACKET" as const };

    const currentRound = bracket.rounds?.[bracket.currentRound];
    if (!Array.isArray(currentRound)) return { error: "BAD_BRACKET" as const };
    const matchIdx = currentRound.findIndex((m: any) => m.id === matchId);
    if (matchIdx === -1) return { error: "MATCH_NOT_FOUND" as const };

    const match = currentRound[matchIdx];
    const isParticipant = callerId === match.p1Id || callerId === match.p2Id;
    const isHost = callerId === t.hostId;
    if (!isParticipant && !isHost) return { error: "NOT_AUTHORIZED" as const };
    if (match.status === "done") return { tournament: t };

    if (match.status !== "playing" || !match.roomCode) return { error: "MATCH_NOT_PLAYING" as const };

    const roomRows = await tx.select().from(roomsTable)
      .where(and(eq(roomsTable.tournamentId, t.id), eq(roomsTable.tournamentMatchId, match.id)))
      .limit(1);
    if (!roomRows.length) return { error: "ROOM_NOT_FOUND" as const };

    const room = roomRows[0];
    if (room.roomCode !== match.roomCode) return { error: "ROOM_MISMATCH" as const };
    if (room.status !== "finished") return { error: "MATCH_NOT_FINISHED" as const };

    const roomPlayers = parsePlayers(room.playersJson);
    const participants = roomPlayers.filter((p: any) => p.playerId === match.p1Id || p.playerId === match.p2Id);
    if (participants.length !== 2) return { error: "ROOM_PARTICIPANTS_MISMATCH" as const };

    const winner = [...participants].sort((a: any, b: any) => {
      const ds = (b.score || 0) - (a.score || 0);
      if (ds !== 0) return ds;
      const sa = a.wasStopper ? 1 : 0;
      const sb = b.wasStopper ? 1 : 0;
      if (sa !== sb) return sb - sa;
      const fa = typeof a.finishedAt === "number" ? a.finishedAt : Number.MAX_SAFE_INTEGER;
      const fb = typeof b.finishedAt === "number" ? b.finishedAt : Number.MAX_SAFE_INTEGER;
      if (fa !== fb) return fa - fb;
      return String(a.playerId || "").localeCompare(String(b.playerId || ""));
    })[0];

    if (!winner?.playerId) return { error: "NO_WINNER" as const };

    currentRound[matchIdx] = {
      ...match,
      winnerId: winner.playerId,
      winnerName: winner.playerName ?? "",
      status: "done",
    };
    bracket.rounds[bracket.currentRound] = currentRound;
    bracket = advanceBracket(bracket);
    const newStatus = bracket.champion ? "completed" : "active";

    const [updated] = await tx.update(tournamentsTable)
      .set({ bracketJson: JSON.stringify(bracket), status: newStatus, updatedAt: new Date() })
      .where(eq(tournamentsTable.id, t.id))
      .returning();

    return { tournament: updated };
  });

  if ("error" in result) {
    const status: Record<string, number> = {
      NOT_FOUND: 404, NO_BRACKET: 400, BAD_BRACKET: 400, MATCH_NOT_FOUND: 404,
      NOT_AUTHORIZED: 403, MATCH_NOT_PLAYING: 409, ROOM_NOT_FOUND: 409,
      ROOM_MISMATCH: 409, MATCH_NOT_FINISHED: 409, ROOM_PARTICIPANTS_MISMATCH: 409,
      NO_WINNER: 409,
    };
    res.status(status[result.error] ?? 400).json({ error: result.error });
    return;
  }

  res.json(formatTournament(result.tournament));
});

export default router;
