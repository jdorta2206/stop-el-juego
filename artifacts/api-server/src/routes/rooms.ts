import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { roomsTable, playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, and, or, lt, inArray, sql } from "drizzle-orm";
import { CreateRoomBody, JoinRoomBody, SubmitRoomResultsBody } from "@workspace/api-zod";
import { calculateStreak, appendStreakDay } from "./ranking";
import { writeLimiter } from "../middlewares/rateLimit";
import { verifyClaimedIdentity, verifyPlayerToken, readPlayerId, isLoggedInId, isAuthConfigured } from "../lib/playerAuth";
import {
  pickBotIdentity,
  makeBotPlayer,
  scheduleBotsForRound,
  resolveCategoriesForRound,
  rushBotSubmits,
  clearBotTimers,
} from "../lib/multiplayerBot";

const router: IRouter = Router();

// ── Round duration model ─────────────────────────────────────────────────
// Mirrors the client's RANDOM_MIN/MAX so deadlines computed on the server
// match what the client expects when it falls back to local rendering.
const ROUND_TIME_DEFAULT = 60;
const RANDOM_MIN = 15;
const RANDOM_MAX = 55;
function randomRoundDuration(roomCode: string, round: number, letter: string): number {
  const seed = `${roomCode}|${round}|${letter}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash);
  const range = RANDOM_MAX - RANDOM_MIN + 1;
  return RANDOM_MIN + (positive % range);
}
function roundDurationSecs(room: any): number {
  if (room.gameMode === "blitz") return 30;
  if (room.gameMode === "random") {
    return randomRoundDuration(room.roomCode, room.currentRound ?? 1, room.currentLetter ?? "A");
  }
  return ROUND_TIME_DEFAULT;
}

// Mirror of client normalizeForScore — strip accents, lower, keep a-z + ñ + spaces.
function normalizeWord(word: string): string {
  return word.trim().toLowerCase()
    .replace(/ñ/g, "~")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/~/g, "ñ")
    .replace(/[^a-zñ\s]/g, "")
    .trim();
}

/**
 * Authoritative server-side score calculator. Mirrors client `calcScore` so
 * scores can never be tampered with: 10 pts per unique valid answer that
 * starts with the round letter. Returns score and the count of valid answers.
 */
function calcServerScore(answers: Record<string, string>, letter: string): { score: number; validCount: number } {
  const usedNorm = new Set<string>();
  const normLetter = normalizeWord(letter);
  let score = 0;
  let validCount = 0;
  for (const val of Object.values(answers)) {
    if (typeof val !== "string") continue;
    const norm = normalizeWord(val);
    if (norm.length >= 2 && norm.startsWith(normLetter) && !usedNorm.has(norm)) {
      score += 10;
      usedNorm.add(norm);
      validCount++;
    }
  }
  return { score, validCount };
}

const ALPHABET_ES = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("").filter(l => !["Q","X"].includes(l));

// 🪪 Shared name-normalization helper. Lower-cased + trimmed so that
// "Jaime", "jaime " and "JAIME" all collide. Used by /join (and any future
// endpoint that adds players to a room) so the unique-name guarantee can
// never drift between code paths.
function normalizePlayerName(name: unknown): string {
  return String(name ?? "").trim().toLowerCase();
}

// Express's `req.params[K]` is typed `string | string[]` because the same
// route param can repeat. All STOP routes use single segments, so this helper
// narrows the value safely and keeps every `.toUpperCase()` call type-clean.
function paramStr(value: unknown): string {
  if (Array.isArray(value)) return String(value[0] ?? "");
  return String(value ?? "");
}

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

// 🛰️ Presence: a player is "online" if they currently have an open SSE
// connection to this room. Used by the stuck-sweep in /results so a player
// who closed the tab is auto-skipped immediately instead of stalling the
// round for the whole grace window.
function isPlayerOnline(code: string, playerId: string): boolean {
  const set = sseClients.get(code);
  if (!set || set.size === 0) return false;
  for (const c of set) if (c.playerId === playerId) return true;
  return false;
}

// ⏱️ Round-advance grace windows (module-level so the in-handler sweep AND the
// background sweepStuckRooms() failsafe share identical timings).
// SUBMIT_GRACE_MS: after STOP, how long we wait before zeroing non-submitters.
// PRESENCE_GRACE_MS: buffer before treating an SSE drop as "offline".
const SUBMIT_GRACE_MS = 15_000;
const PRESENCE_GRACE_MS = 4_000;

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

// Deps bundle passed to the bot module so it can broadcast room updates
// after it submits / advances rounds. Defined as a getter so it captures
// the latest reference to the local functions above.
const botDeps = {
  broadcast: (code: string, payload: object) => broadcastRoom(code, payload),
  formatRoom: (room: any) => formatRoom(room),
  // Persists final scores to the global leaderboard when the bot's submission
  // happens to be the one that ends the match.
  submitFinalScores: (players: any[], letter: string) =>
    submitAllScoresToLeaderboard(players, letter).catch(() => {}),
};

// ── In-memory stores (ephemeral, no DB needed) ─────────────────────────────
type Reaction = { id: string; emoji: string; playerName: string; ts: number };
const roomReactions = new Map<string, Reaction[]>();
// Pack selection for each room. "custom" requires a premium host and carries
// the actual categories list + a human label (so all clients see the same
// set without needing to load the host's private custom pack collection).
type RoomPackConfig = {
  pack: "standard" | "crazy" | "mix" | "custom";
  customCategories?: string[];
  customLabel?: string;
};
const roomCategoryPacks = new Map<string, RoomPackConfig>();

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
  const durationSecs = roundDurationSecs(room);
  // Server-authoritative round deadline. The client uses this to compute the
  // visible countdown so all players see the SAME remaining time, regardless
  // of polling jitter, SSE reconnects or local clock drift.
  const startedAtRaw = meta?.roundStartedAt;
  const roundStartedAt = typeof startedAtRaw === "number" ? startedAtRaw : null;
  const roundEndsAt = roundStartedAt ? roundStartedAt + durationSecs * 1000 : null;
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
    categoryPack: (roomCategoryPacks.get(code)?.pack) ?? "standard",
    customCategories: roomCategoryPacks.get(code)?.customCategories ?? null,
    customPackLabel: roomCategoryPacks.get(code)?.customLabel ?? null,
    language: room.language,
    isPublic: room.isPublic ?? false,
    players: parsePlayers(room.playersJson),
    stopper: meta?.stopper ?? null,
    bluffData: meta?.bluffVotes ?? null,
    bluffVoteDeadline: meta?.bluffDeadline ?? null,
    // ⏱️ Server-authoritative round timing (the only source of truth)
    roundStartedAt,
    roundEndsAt,
    roundDurationSecs: durationSecs,
    serverNow: Date.now(),
    reactions: getReactions(code),
    phrases: getPhrases(code),
    typing: getTyping(code),
    rematchCode: roomRematch.get(code) ?? null,
    funVotes: getFunVotes(code),
    createdAt: room.createdAt,
  };
}

// Minimal, non-identifying view of a private room for non-members. Carries just
// enough for the client to validate existence/joinability (and for the resume
// banner to detect "I'm not a member" — players is empty so membership is false)
// without leaking who is inside, their scores, or in-round answers.
function sanitizedRoomPreview(full: any) {
  return {
    id: full.id,
    roomCode: full.roomCode,
    status: full.status,
    isPublic: full.isPublic,
    gameMode: full.gameMode,
    language: full.language,
    currentRound: full.currentRound,
    maxRounds: full.maxRounds,
    maxPlayers: full.maxPlayers,
    playerCount: Array.isArray(full.players) ? full.players.length : 0,
    players: [],
    hostId: null,
    restricted: true,
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
  // ⚖️ Deterministic tie-breaker — must match the client's winner display:
  //   1) higher final score
  //   2) was the stopper in the LAST round (rewards the player who triggered STOP)
  //   3) earlier finishedAt timestamp (faster typer wins ties)
  //   4) playerId (stable, alphabetical) so we never produce duplicate winners
  const sorted = [...players].sort((a, b) => {
    const ds = (b.score || 0) - (a.score || 0);
    if (ds !== 0) return ds;
    const sa = a.wasStopper ? 1 : 0;
    const sb = b.wasStopper ? 1 : 0;
    if (sa !== sb) return sb - sa;
    const fa = typeof a.finishedAt === "number" ? a.finishedAt : Number.MAX_SAFE_INTEGER;
    const fb = typeof b.finishedAt === "number" ? b.finishedAt : Number.MAX_SAFE_INTEGER;
    if (fa !== fb) return fa - fb;
    return String(a.playerId || "").localeCompare(String(b.playerId || ""));
  });
  const winner = sorted[0];
  const today = new Date().toISOString().split("T")[0];

  await Promise.allSettled(players.map(async (p: any) => {
    // Skip guests and players with 0 or no score
    if (!p.playerId || p.loginMethod === "guest") return;

    const rawScore = p.score || 0;
    // Apply 1.5x multiplier for multiplayer
    const score = Math.round(rawScore * 1.5);
    const won = winner?.playerId === p.playerId;

    // 🔒 Atomic upsert: avoids the read-modify-write race that lost
    // concurrent finishers' totals under heavy multiplayer load.
    // Streak still needs the prior `lastPlayedDate`, so we read it once,
    // but every counter increment is delegated to SQL in a single statement.
    const existing = await db
      .select({
        lastPlayedDate: playerScoresTable.lastPlayedDate,
        currentStreak: playerScoresTable.currentStreak,
        longestStreak: playerScoresTable.longestStreak,
        avatarColor: playerScoresTable.avatarColor,
        streakDaysJson: playerScoresTable.streakDaysJson,
      })
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, p.playerId))
      .limit(1);

    const { newStreak, updatedToday } = calculateStreak(
      existing[0]?.lastPlayedDate ?? null,
      existing[0]?.currentStreak ?? 0
    );
    const newLongest = Math.max(existing[0]?.longestStreak ?? 0, newStreak);
    // Append today to the rolling 30-day streak-days list using the same
    // shared helper as the solo /ranking/scores path so the streak calendar
    // is consistent regardless of which mode the player progressed through.
    const newStreakDaysJson = updatedToday
      ? appendStreakDay(existing[0]?.streakDaysJson, today)
      : undefined;

    if (existing.length > 0) {
      await db.update(playerScoresTable)
        .set({
          playerName: p.playerName,
          avatarColor: p.avatarColor ?? existing[0].avatarColor,
          totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
          gamesPlayed: sql`${playerScoresTable.gamesPlayed} + 1`,
          wins: sql`${playerScoresTable.wins} + ${won ? 1 : 0}`,
          ...(updatedToday ? {
            currentStreak: newStreak,
            longestStreak: newLongest,
            lastPlayedDate: today,
            streakDaysJson: newStreakDaysJson,
          } : {}),
          updatedAt: new Date(),
        })
        .where(eq(playerScoresTable.playerId, p.playerId));
    } else {
      // Use INSERT … ON CONFLICT to be safe under simultaneous first-time inserts.
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
        streakDaysJson: JSON.stringify([today]),
      }).onConflictDoUpdate({
        target: playerScoresTable.playerId,
        set: {
          playerName: p.playerName,
          totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
          gamesPlayed: sql`${playerScoresTable.gamesPlayed} + 1`,
          wins: sql`${playerScoresTable.wins} + ${won ? 1 : 0}`,
          updatedAt: new Date(),
        },
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

// Run the stuck-player sweep and, if everyone is ready, compute the next
// round state. Extracted so BOTH the /results handler and the background
// sweepStuckRooms() failsafe use identical logic — otherwise the round could
// only ever advance when a /results POST physically arrives, which deadlocks
// the whole table if the last pending player's submission is lost on the wire.
// The instant a round "ended" for grace-window math: an explicit STOP if one
// was pressed, otherwise the natural timer deadline (roundStartedAt + duration).
// This lets the failsafe sweep advance BOTH rounds that were STOPped AND rounds
// that simply ran out of time without anyone pressing STOP — both can otherwise
// deadlock if a player's /results never reaches the server.
function roundEndTimestamp(room: any): number | undefined {
  const meta = parseBluffMeta(room.stopperJson);
  const explicitStop: number | undefined =
    meta?.stopTimestamp ?? meta?.stopper?.stopTimestamp;
  if (typeof explicitStop === "number") return explicitStop;
  const startedAt = meta?.roundStartedAt;
  if (typeof startedAt === "number") return startedAt + roundDurationSecs(room) * 1000;
  return undefined;
}

function finalizeRoundState(room: any, players: any[]): {
  sweptPlayers: any[];
  newStatus: string;
  newLetter: string | null;
  newRound: number;
  newStopperJson: string | null;
} {
  const codeUpper = (room.roomCode as string).toUpperCase();
  const endTs = roundEndTimestamp(room);

  const sweptPlayers = (() => {
    if (!endTs) return players;
    const sinceStop = Date.now() - endTs;
    const gracePassed = sinceStop > SUBMIT_GRACE_MS;
    // Only treat "offline" as fatal AFTER the presence buffer: a one-second
    // SSE blip on a 4G network shouldn't zero a player whose /results is
    // already on the wire.
    const presenceArmed = sinceStop > PRESENCE_GRACE_MS;
    return players.map((p: any) => {
      if (p.isReady) return p;
      if (gracePassed) {
        return { ...p, isReady: true, roundScore: 0, finishedAt: Date.now() };
      }
      if (presenceArmed && !isPlayerOnline(codeUpper, p.playerId)) {
        return { ...p, isReady: true, roundScore: 0, finishedAt: Date.now() };
      }
      return p;
    });
  })();

  const allReady = sweptPlayers.every((p: any) => p.isReady);

  let newStatus = room.status;
  let newLetter = room.currentLetter;
  let newRound = room.currentRound;
  let newStopperJson = room.stopperJson;

  if (allReady) {
    // Check if any player bluffed
    const bluffers = sweptPlayers.filter((p: any) => p.bluffedCategories?.length > 0);
    const nonBluffers = sweptPlayers.filter((p: any) => !p.bluffedCategories?.length);

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
      } else {
        newStatus = "waiting";
        newLetter = randomLetter();
      }
      // 🧹 Clear stopperJson so the next /start gets a fresh roundStartedAt
      // (otherwise the old timestamp lingers and the next round's deadline
      // would start in the past on slow clients).
      newStopperJson = null;
      // NOTE: side effects (leaderboard submit on game-over, spy/live map
      // cleanup) are intentionally NOT done here. They run in the CALLER via
      // applyRoundAdvanceSideEffects() and ONLY after the optimistic-concurrency
      // DB write WINS — otherwise a /results POST and the background sweeper
      // racing the same round would BOTH fire the side effects (the loser would
      // still have submitted scores to the leaderboard twice).
    }
  }

  return { sweptPlayers, newStatus, newLetter, newRound, newStopperJson };
}

// Side effects that must happen EXACTLY ONCE per round transition — only call
// this after the optimistic-concurrency update succeeded (the caller won the
// race), passing the players/state that were actually persisted.
function applyRoundAdvanceSideEffects(room: any, sweptPlayers: any[], newStatus: string) {
  if (newStatus === "waiting" || newStatus === "finished") {
    const codeUpper = (room.roomCode as string).toUpperCase();
    // 🕵️ Reset spy budgets and stale live responses for the new round.
    roomSpyUsage.delete(codeUpper);
    roomLiveResponses.delete(codeUpper);
  }
  if (newStatus === "finished") {
    // 🏆 Persist final scores to the global leaderboard exactly once.
    submitAllScoresToLeaderboard(sweptPlayers, room.currentLetter || "A").catch(() => {});
  }
}

// 🚑 Background failsafe: advance rounds stuck in "stopped" past the submit
// grace window even when NO further /results POST arrives. Without this a
// round deadlocks forever if the last pending player's submission never
// reaches the server (their SSE stays "online" so the in-handler sweep never
// fires for them, and there's no other player left to trigger it).
async function sweepStuckRooms() {
  try {
    // Scan BOTH "stopped" (someone pressed STOP) and "playing" (the round timer
    // ran out with no STOP) — either can deadlock if a submission is lost.
    const stuck = await db.select().from(roomsTable)
      .where(or(eq(roomsTable.status, "stopped"), eq(roomsTable.status, "playing")));
    for (const room of stuck) {
      const endTs = roundEndTimestamp(room);
      // Before the grace window elapses the normal /results path still advances
      // the round; only step in once it has fully passed. A fresh/in-progress
      // "playing" round has its deadline in the future, so it's skipped here.
      if (!endTs || Date.now() - endTs <= SUBMIT_GRACE_MS) continue;

      const players = parsePlayers(room.playersJson);
      const { sweptPlayers, newStatus, newLetter, newRound, newStopperJson } =
        finalizeRoundState(room, players);

      // Nothing to persist if the sweep didn't actually move the room forward.
      if (newStatus === room.status && newRound === room.currentRound) continue;

      // Optimistic concurrency: a concurrent /results may have just advanced
      // it — guard on updatedAt so only one writer wins; retry next tick.
      const updateResult = await db.update(roomsTable)
        .set({
          playersJson: JSON.stringify(sweptPlayers),
          currentRound: newRound,
          currentLetter: newLetter,
          status: newStatus,
          stopperJson: newStopperJson,
          updatedAt: new Date(),
        })
        .where(and(eq(roomsTable.roomCode, room.roomCode), eq(roomsTable.updatedAt, room.updatedAt)))
        .returning();

      if (updateResult.length === 0) continue;

      // We won the write — now (and only now) run one-shot side effects.
      applyRoundAdvanceSideEffects(room, sweptPlayers, newStatus);
      // Push the unstuck state to every connected client (incl. the player
      // who was frozen on "Enviando…") via SSE.
      broadcastAndFormat(updateResult[0]);
    }

    // 🃏 Also rescue rooms stuck in "bluffvoting": resolution only happens when
    // a client polls /vote or /resolve-bluffs. If everyone closes the tab the
    // round would hang until the 6h purge. Force-resolve once the bluff deadline
    // plus the submit grace window has passed. Same CAS guard as the endpoints
    // so we never double-submit final scores.
    const stuckBluff = await db.select().from(roomsTable)
      .where(eq(roomsTable.status, "bluffvoting"));
    for (const room of stuckBluff) {
      const meta = parseBluffMeta(room.stopperJson) ?? {};
      const deadline = meta.bluffDeadline ? new Date(meta.bluffDeadline).getTime() : 0;
      if (!deadline || Date.now() - deadline <= SUBMIT_GRACE_MS) continue;

      const players = parsePlayers(room.playersJson);
      const bluffVotes = meta.bluffVotes ?? {};
      const resolved = resolveBluffs(players, bluffVotes);
      const newRound = room.currentRound + 1;
      const isGameOver = newRound > room.maxRounds;
      const newStatus = isGameOver ? "finished" : "waiting";

      const [updated] = await db.update(roomsTable)
        .set({
          playersJson: JSON.stringify(resolved),
          currentRound: isGameOver ? room.maxRounds : newRound,
          currentLetter: isGameOver ? room.currentLetter : randomLetter(),
          status: newStatus,
          stopperJson: JSON.stringify({ stopper: meta.stopper, bluffResults: bluffVotes }),
          updatedAt: new Date(),
        })
        .where(and(eq(roomsTable.roomCode, room.roomCode), eq(roomsTable.status, "bluffvoting")))
        .returning();
      if (!updated) continue;
      if (isGameOver) {
        submitAllScoresToLeaderboard(resolved, room.currentLetter || "A").catch(() => {});
      }
      broadcastAndFormat(updated);
    }
  } catch (err) {
    console.error("[sweepStuckRooms] failed:", (err as Error).message);
  }
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

    // 🧹 In-memory map cleanup: drop entries for any room code that no
    // longer exists in the DB. Without this, sseClients/roomReactions/
    // roomPhrases/roomTyping grow unbounded as games end and rooms get
    // purged. We compare against the live set of codes rather than
    // selecting "stale" codes upfront (which was throwing at boot).
    const liveCodesSet = new Set<string>();
    try {
      const live = await db.select({ code: roomsTable.roomCode }).from(roomsTable);
      for (const r of live) if (r?.code) liveCodesSet.add(r.code);
    } catch {
      // If the live-codes query fails we conservatively skip in-memory
      // cleanup this cycle rather than risk dropping active rooms.
      return;
    }
    const dropOrphans = (m: Map<string, unknown>) => {
      for (const code of m.keys()) if (!liveCodesSet.has(code)) m.delete(code);
    };
    // SSE: close leftover client connections before dropping the set.
    for (const code of sseClients.keys()) {
      if (liveCodesSet.has(code)) continue;
      const set = sseClients.get(code);
      if (set) for (const c of set) { try { c.res.end(); } catch { /* already closed */ } }
      sseClients.delete(code);
    }
    dropOrphans(roomReactions as Map<string, unknown>);
    dropOrphans(roomPhrases as Map<string, unknown>);
    dropOrphans(roomTyping as Map<string, unknown>);
    dropOrphans(roomCategoryPacks as Map<string, unknown>);
    dropOrphans(roomLiveResponses as Map<string, unknown>);
    dropOrphans(roomSpyUsage as Map<string, unknown>);
    dropOrphans(roomRematch as Map<string, unknown>);
    dropOrphans(roomFunVotes as Map<string, unknown>);
  } catch (err) {
    console.error("[purgeStaleRooms] failed:", (err as Error).message);
  }
}

// 🧹 Background cleanup: run once at boot and every 30 min thereafter. The
// /public endpoint also calls this opportunistically, but private rooms
// never hit /public — without this interval the `rooms` table would grow
// unbounded on instances that only serve invited games.
// 🔁 Guard against tsx hot-reload duplicating intervals across module re-evals.
const PURGE_TIMER_KEY = "__stopPurgeRoomsTimer";
const g = globalThis as any;
if (g[PURGE_TIMER_KEY]) clearInterval(g[PURGE_TIMER_KEY]);
purgeStaleRooms().catch(() => {});
g[PURGE_TIMER_KEY] = setInterval(() => { purgeStaleRooms().catch(() => {}); }, 30 * 60 * 1000);

// 🚑 Stuck-room failsafe: every 3s, force-advance any round deadlocked in
// "stopped" past the submit grace window. This is what guarantees a table can
// never hang forever on "Esperando a los demás jugadores" when a player's
// submission is lost. Guarded against tsx hot-reload duplicating the timer.
const SWEEP_TIMER_KEY = "__stopSweepStuckRoomsTimer";
if (g[SWEEP_TIMER_KEY]) clearInterval(g[SWEEP_TIMER_KEY]);
g[SWEEP_TIMER_KEY] = setInterval(() => { sweepStuckRooms().catch(() => {}); }, 3_000);

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
  const roomCode = paramStr(req.params.roomCode).toUpperCase();
  const rows = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode));
  if (!rows.length) { res.status(404).json({ error: "Room not found" }); return; }
  const room = rows[0];
  if (!room.isPublic) { res.status(403).json({ error: "Room is private" }); return; }
  res.json(sanitizeRoomForSpectator(formatRoom(room)));
});

// PATCH /rooms/:code/visibility — host toggles streamer mode (isPublic)
router.patch("/:roomCode/visibility", async (req, res) => {
  const roomCode = paramStr(req.params.roomCode).toUpperCase();
  const { hostId, isPublic } = req.body ?? {};
  if (typeof isPublic !== "boolean" || !hostId) {
    res.status(400).json({ error: "Missing hostId or isPublic" }); return;
  }
  // 🔒 Bind to the token first so a leaked hostId can't be replayed by a third party.
  if (!verifyClaimedIdentity(req, hostId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
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
  // 🔒 A logged-in account can only create a room AS ITSELF. Guests (UUID ids) pass.
  if (!verifyClaimedIdentity(req, hostId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }
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

  // Defensive: room codes are recycled (6-char alphanumeric, collision-checked
  // against DB but not against in-memory state). Clear any leftover ephemeral
  // state for this code so a new host can't inherit a previous host's custom
  // pack or transient reactions/typing.
  roomCategoryPacks.delete(roomCode);
  roomReactions.delete(roomCode);
  roomPhrases.delete(roomCode);
  roomTyping.delete(roomCode);

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
  const roomCode = paramStr(req.params.roomCode);
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }
  const full = formatRoom(rooms[0]);

  // 🔒 Private-room privacy. Public (streamer-mode) rooms are spectatable by
  // design, so they keep returning the full payload. For a PRIVATE room we only
  // hand the full roster (every player's id/name/score/answers + hostId) to
  // people who are actually in it; a stranger who merely knows the code gets a
  // minimal preview. This closes the info leak AND removes the main way an
  // attacker learned a guest's id (from this very response) to impersonate them.
  if (full.isPublic !== true) {
    // Identity resolution. A cryptographically verified token (logged-in users
    // send x-stop-token / cookie globally) is always trusted. A *self-asserted*
    // id (?viewerId= or x-viewer-id header) is only trusted when it is a GUEST
    // id: guest ids aren't discoverable once this gate hides the roster, so they
    // act as a weak bearer secret. A LOGGED-IN id must NOT be self-assertable —
    // those ids are public (e.g. the leaderboard), so trusting an unverified
    // logged-in assertion would let a stranger read any private room that
    // contains a known account. Logged-in membership therefore requires a real
    // token match (mirrors verifyClaimedIdentity); no downgrade to assertion.
    const verified = readPlayerId(req);
    const asserted =
      paramStr(req.query["viewerId"]) || paramStr(req.headers["x-viewer-id"]);
    const viewerId = verified || (asserted && !isLoggedInId(asserted) ? asserted : "");
    const players = Array.isArray(full.players) ? (full.players as any[]) : [];
    const isMember =
      !!viewerId &&
      (full.hostId === viewerId || players.some((p) => p?.playerId === viewerId));
    if (!isMember) {
      res.json(sanitizedRoomPreview(full));
      return;
    }
  }

  res.json(full);
});

// POST /rooms/:roomCode/join
router.post("/:roomCode/join", async (req, res) => {
  const roomCode = paramStr(req.params.roomCode);
  const body = JoinRoomBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  const code = roomCode.toUpperCase();
  const { playerId, playerName, avatarColor, loginMethod } = body.data;
  // 🔒 A logged-in account can only join AS ITSELF. Guests (UUID ids) pass.
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }
  const joinerPremium = await isPlayerPremium(playerId);

  const myNorm = normalizePlayerName(playerName);
  if (myNorm.length === 0) {
    res.status(400).json({ error: "Name cannot be empty" });
    return;
  }

  // 🛡️ Concurrency-safe join via transaction + SELECT … FOR UPDATE.
  // The previous optimistic-concurrency loop compared `updatedAt` (microsecond
  // in Postgres) against a JS Date (millisecond) — the WHERE clause never
  // matched, every join failed with 503. Row-level locking removes both the
  // precision pitfall and the "two players joining at once" race.
  type JoinOutcome =
    | { kind: "ok"; row: any }
    | { kind: "notFound" }
    | { kind: "nameTaken" }
    | { kind: "started" }
    | { kind: "full" };

  const outcome: JoinOutcome = await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM rooms WHERE room_code = ${code} FOR UPDATE`,
    );
    const list = (rows as any).rows ?? rows;
    if (!list || list.length === 0) return { kind: "notFound" } as const;

    // pg returns snake_case; map the two columns we need.
    const raw = list[0];
    const playersJson = raw.players_json ?? raw.playersJson;
    const players = parsePlayers(playersJson);

    const collision = players.find(
      (p: any) => p.playerId !== playerId && normalizePlayerName(p.playerName) === myNorm,
    );
    if (collision) return { kind: "nameTaken" } as const;

    const existing = players.find((p: any) => p.playerId === playerId);
    if (!existing) {
      // 🔒 New joiners only (existing players always reconnect): the lobby must
      // still be open ("waiting") and not full. Without this, a stranger could
      // jump into a game already in progress or push the room past its cap.
      const status = raw.status;
      if (status && status !== "waiting") return { kind: "started" } as const;
      const maxPlayers = raw.max_players ?? raw.maxPlayers ?? 8;
      if (players.length >= maxPlayers) return { kind: "full" } as const;
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
    }

    const updated = await tx
      .update(roomsTable)
      .set({ playersJson: JSON.stringify(players), updatedAt: new Date() })
      .where(eq(roomsTable.roomCode, code))
      .returning();

    return { kind: "ok", row: updated[0] } as const;
  });

  if (outcome.kind === "notFound") { res.status(404).json({ error: "Room not found" }); return; }
  if (outcome.kind === "nameTaken") {
    res.status(409).json({
      error: "name_taken",
      message: "Ese nombre ya está en uso en esta sala. Prueba con otro o añade un número.",
    });
    return;
  }
  if (outcome.kind === "started") {
    res.status(409).json({
      error: "in_progress",
      message: "La partida ya ha empezado. No puedes unirte hasta que termine.",
    });
    return;
  }
  if (outcome.kind === "full") {
    res.status(409).json({
      error: "room_full",
      message: "La sala está llena.",
    });
    return;
  }

  // 🚀 Notifica a todos en la sala que entró un nuevo jugador
  res.json(broadcastAndFormat(outcome.row));
});

// POST /rooms/:roomCode/start — host starts / continues the game
router.post("/:roomCode/start", async (req, res) => {
  const roomCode = paramStr(req.params.roomCode);
  const { hostId } = (req.body ?? {}) as { hostId?: string };
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];
  // 🔐 Authorization: only the host can start / continue rounds. We accept the
  // hostId from the body to keep this stateless (no auth session). Missing or
  // mismatched hostId returns 403 — prevents griefers from forcing rounds.
  if (!hostId || room.hostId !== hostId) {
    res.status(403).json({ error: "Only the host can start the game" });
    return;
  }
  // 🔒 Bind a logged-in host to its real identity (guests pass through).
  if (!verifyClaimedIdentity(req, hostId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }
  // 🔁 Idempotency: /start is only valid from the lobby ("waiting") state.
  // While "playing" or "stopped", a duplicate /start (host double-tap, retry
  // after a flaky network) must NOT re-randomize the letter, wipe scores, or
  // reset finishedAt timestamps. We just echo the current state back.
  // "finished" rooms cannot be restarted — players use the rematch flow.
  if (room.status === "playing" || room.status === "stopped") {
    res.json(broadcastAndFormat(room));
    return;
  }
  if (room.status === "finished") {
    res.status(409).json({ error: "Match already finished — use rematch" });
    return;
  }
  const players = parsePlayers(room.playersJson);

  const newRound = room.currentRound === 0 ? 1 : room.currentRound;
  const MP_CARDS = ["lightning", "shield", "sabotage", "double_or_nothing", "steal"] as const;

  // Reset all ready flags, round scores AND finishedAt; assign power cards on round 1 only
  const resetPlayers = players.map((p: any) => ({
    ...p,
    isReady: false,
    roundScore: 0,
    finishedAt: undefined,
    // Assign 1 random card at game start (round 1); keep it for subsequent rounds until used
    powerCard: newRound === 1
      ? MP_CARDS[Math.floor(Math.random() * MP_CARDS.length)]
      : (p.powerCard ?? null),
    powerCardUsed: newRound === 1 ? false : (p.powerCardUsed ?? false),
    bluffImmune: false,
  }));

  // ⏱️ Stamp the authoritative round-start timestamp so every client computes
  // the same deadline regardless of when their poll/SSE picks up the change.
  const newLetter = randomLetter();
  const startMeta = { roundStartedAt: Date.now() };
  // 🔒 Atomic transition: only flip to "playing" if the row is STILL in
  // "waiting". If two requests race past the early guard above (host
  // double-tap from two devices), only one update will succeed; the other
  // returns 0 rows and we echo back the post-race state.
  const updateResult = await db.update(roomsTable)
    .set({
      status: "playing",
      currentRound: newRound,
      currentLetter: newLetter,
      playersJson: JSON.stringify(resetPlayers),
      stopperJson: JSON.stringify(startMeta),
      updatedAt: new Date(),
    })
    .where(and(
      eq(roomsTable.roomCode, roomCode.toUpperCase()),
      eq(roomsTable.status, "waiting"),
    ))
    .returning();

  if (updateResult.length === 0) {
    // Lost the race — read the winner's state and return it.
    const [latest] = await db.select().from(roomsTable)
      .where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
    res.json(broadcastAndFormat(latest ?? room));
    return;
  }

  // 🚀 Empuja el cambio a TODOS los jugadores por SSE de inmediato
  // (antes solo el host recibía la respuesta y los demás esperaban polling).
  res.json(broadcastAndFormat(updateResult[0]));

  // 🤖 Schedule bot STOPs/submits for this round. Done after the broadcast
  // so humans see the round start immediately, then bots act on their own
  // realistic delay (25-50s).
  const botsInRoom = resetPlayers.filter((p: any) => p.isBot);
  if (botsInRoom.length > 0) {
    const updatedRoom = updateResult[0];
    const packCfg = roomCategoryPacks.get(roomCode.toUpperCase());
    const pack = packCfg?.pack ?? "standard";
    const letterForRound = (updatedRoom.currentLetter ?? "A").toUpperCase();
    const roundForRound = updatedRoom.currentRound ?? newRound;
    const categories = resolveCategoriesForRound(pack, letterForRound, roundForRound, packCfg?.customCategories);
    scheduleBotsForRound({
      roomCode: roomCode.toUpperCase(),
      bots: botsInRoom.map((b: any) => ({ playerId: b.playerId })),
      letter: letterForRound,
      categories,
      round: roundForRound,
      deps: botDeps,
    });
  }
});

// POST /rooms/:roomCode/add-bot — host-only, adds a CPU player to the lobby
router.post("/:roomCode/add-bot", async (req, res) => {
  const roomCode = paramStr(req.params.roomCode);
  const { hostId } = (req.body ?? {}) as { hostId?: string };
  const code = roomCode.toUpperCase();
  // 🔒 Bind a logged-in host to its real identity (guests pass through).
  if (!verifyClaimedIdentity(req, hostId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }

  // 🔒 Row-locked transaction so concurrent /join + /add-bot can't trample
  // each other (last-write-wins on playersJson would silently lose a player).
  type Outcome =
    | { kind: "ok"; row: any }
    | { kind: "notFound" }
    | { kind: "forbidden" }
    | { kind: "badState" }
    | { kind: "full" }
    | { kind: "botCap" }
    | { kind: "noName" };

  const outcome: Outcome = await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM rooms WHERE room_code = ${code} FOR UPDATE`,
    );
    const list = (rows as any).rows ?? rows;
    if (!list || list.length === 0) return { kind: "notFound" };
    const raw = list[0];
    const rHostId = raw.host_id ?? raw.hostId;
    const rStatus = raw.status;
    const rMaxPlayers = raw.max_players ?? raw.maxPlayers ?? 8;
    const playersJson = raw.players_json ?? raw.playersJson;
    if (!hostId || rHostId !== hostId) return { kind: "forbidden" };
    if (rStatus !== "waiting") return { kind: "badState" };
    const players = parsePlayers(playersJson);
    if (players.length >= rMaxPlayers) return { kind: "full" };
    const existingBots = players.filter((p: any) => p.isBot).length;
    if (existingBots >= 3) return { kind: "botCap" };
    const identity = pickBotIdentity(players.map((p: any) => p.playerName));
    if (!identity) return { kind: "noName" };
    players.push(makeBotPlayer(identity));
    const updated = await tx.update(roomsTable)
      .set({ playersJson: JSON.stringify(players), updatedAt: new Date() })
      .where(eq(roomsTable.roomCode, code))
      .returning();
    return { kind: "ok", row: updated[0] };
  });

  switch (outcome.kind) {
    case "notFound": res.status(404).json({ error: "Room not found" }); return;
    case "forbidden": res.status(403).json({ error: "Only the host can add bots" }); return;
    case "badState": res.status(409).json({ error: "Bots can only be added in the lobby" }); return;
    case "full": res.status(409).json({ error: "Room is full" }); return;
    case "botCap": res.status(409).json({ error: "Max 3 bots per room" }); return;
    case "noName": res.status(409).json({ error: "No bot names available" }); return;
    case "ok": res.json(broadcastAndFormat(outcome.row)); return;
  }
});

// POST /rooms/:roomCode/leave — player leaves the room
//
// 👑 Host migration: when the host leaves the lobby we no longer nuke the
// whole room. Instead we promote the next player in arrival order to host
// (sets `isHost: true`, copies `playerId` to `room.hostId` / `hostName`) and
// broadcast the updated room. Only when the room would become empty do we
// delete the row + drop in-memory ephemeral state. This is what users expect
// when someone closes a tab by accident — the party doesn't die.
router.post("/:roomCode/leave", async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
  const { playerId } = req.body as { playerId: string };

  if (!playerId) { res.status(400).json({ error: "playerId required" }); return; }
  // 🔒 Only the player themselves (or a guest) can trigger a leave — stops a
  // third party who knows a member's id from force-removing them or hijacking
  // the host migration. Token rides via the auth cookie (sendBeacon/keepalive)
  // or x-stop-token header. Fails open for guests / unconfigured auth.
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }

  // Use a transaction with row-locking so that two simultaneous /leave calls
  // (or a /leave racing with a /join) can't both decide they are the last
  // person in the room and corrupt the player list.
  type LeaveOutcome =
    | { kind: "noop" }
    | { kind: "deleted" }
    | { kind: "updated"; row: any; newHostId: string | null };

  const outcome: LeaveOutcome = await db.transaction(async (tx) => {
    const rows = await tx.execute(
      sql`SELECT * FROM rooms WHERE room_code = ${code} FOR UPDATE`,
    );
    const list = (rows as any).rows ?? rows;
    if (!list || list.length === 0) return { kind: "noop" } as const;

    const raw = list[0];
    const playersJson = raw.players_json ?? raw.playersJson;
    const status = raw.status;
    const players = parsePlayers(playersJson);
    const leaving = players.find((p: any) => p.playerId === playerId);
    if (!leaving) return { kind: "noop" } as const;

    // 👑 Mid-game host migration: if the host leaves while a round is in
    // flight, we can't safely rewrite `playersJson` (would desync scores),
    // but we MUST move the host badge to someone else — otherwise the room
    // becomes a zombie that nobody can restart, rematch, or close. We do a
    // minimal mutation: only `hostId`/`hostName` change, and we flip the
    // `isHost` flag inside playersJson without touching scores or answers.
    if (status !== "waiting") {
      if (!leaving.isHost) return { kind: "noop" } as const;
      const others = players.filter((p: any) => p.playerId !== playerId);
      if (others.length === 0) return { kind: "noop" } as const;
      const newHost = others[0];
      const migrated = players.map((p: any) => ({
        ...p,
        isHost: p.playerId === newHost.playerId,
      }));
      const updated = await tx
        .update(roomsTable)
        .set({
          playersJson: JSON.stringify(migrated),
          hostId: newHost.playerId,
          hostName: newHost.playerName ?? "",
          updatedAt: new Date(),
        } as any)
        .where(eq(roomsTable.roomCode, code))
        .returning();
      return { kind: "updated", row: updated[0], newHostId: newHost.playerId } as const;
    }

    const remaining = players.filter((p: any) => p.playerId !== playerId);

    // Empty lobby → delete the row and free ephemeral state.
    if (remaining.length === 0) {
      await tx.delete(roomsTable).where(eq(roomsTable.roomCode, code));
      return { kind: "deleted" } as const;
    }

    // 👑 If the host is the one leaving, promote the next player in arrival
    // order. Otherwise the existing host stays.
    // Defensive: explicitly normalise the `isHost` flag across every
    // remaining player so the invariant "exactly one host" can never drift,
    // even if a previous code path forgot to clear it.
    let newHostId: string | null = null;
    if (leaving.isHost) {
      remaining.forEach((p: any, idx: number) => { p.isHost = idx === 0; });
      newHostId = remaining[0].playerId;
    }

    const setPayload: Record<string, unknown> = {
      playersJson: JSON.stringify(remaining),
      updatedAt: new Date(),
    };
    if (newHostId) {
      setPayload.hostId = newHostId;
      setPayload.hostName = remaining[0].playerName ?? "";
    }

    const updated = await tx
      .update(roomsTable)
      .set(setPayload as any)
      .where(eq(roomsTable.roomCode, code))
      .returning();

    return { kind: "updated", row: updated[0], newHostId } as const;
  });

  if (outcome.kind === "deleted") {
    roomTyping.delete(code);
    roomLiveResponses.delete(code);
    roomSpyUsage.delete(code);
    roomRematch.delete(code);
    roomFunVotes.delete(code);
    roomReactions.delete(code);
    roomPhrases.delete(code);
    roomCategoryPacks.delete(code);
    // 🤖 Cancel pending bot timers so they don't fire against a deleted room.
    clearBotTimers(code);
    res.json({ ok: true, deleted: true });
    return;
  }

  if (outcome.kind === "updated") {
    try {
      const formatted = broadcastAndFormat(outcome.row);
      // The room snapshot we just broadcast already carries the new `hostId`
      // and `hostName`, so every connected SSE client (including the new
      // host) will reconcile via `queryClient.setQueryData`. The client can
      // detect the migration by comparing the previous host with the
      // incoming snapshot — no side-channel SSE event needed (and adding one
      // would clobber the room query cache because the EventSource listener
      // uses the default `onmessage` handler).
      res.json({ ok: true, ...(outcome.newHostId ? { hostMigratedTo: outcome.newHostId } : {}), room: formatted });
      return;
    } catch {
      res.json({ ok: true });
      return;
    }
  }

  res.json({ ok: true });
});

// POST /rooms/:roomCode/react — player sends an emoji reaction (in-memory, ephemeral)
router.post("/:roomCode/react", writeLimiter, async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
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

// POST /rooms/:roomCode/category-pack — host sets category pack
// (standard/crazy/mix, or "custom" with categories+label for premium hosts)
router.post("/:roomCode/category-pack", async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
  const body = req.body as {
    hostId: string;
    pack: "standard" | "crazy" | "mix" | "custom";
    customCategories?: string[];
    customLabel?: string;
  };
  const { hostId, pack } = body;
  // 🔒 Bind to the token first so a leaked hostId can't be replayed by a third party.
  if (!verifyClaimedIdentity(req, hostId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }
  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }
  if (rooms[0].hostId !== hostId) { res.status(403).json({ error: "Not host" }); return; }
  if (!["standard", "crazy", "mix", "custom"].includes(pack)) { res.status(400).json({ error: "Invalid pack" }); return; }

  if (pack === "custom") {
    // Gate behind premium server-side — client UI hides it but never trust the client.
    const hostPremium = await isPlayerPremium(hostId);
    if (!hostPremium) { res.status(403).json({ error: "Premium required for custom packs" }); return; }
    const cats = Array.isArray(body.customCategories) ? body.customCategories : [];
    const clean = cats
      .map(c => typeof c === "string" ? c.trim() : "")
      .filter(c => c.length > 0 && c.length <= 60)
      .slice(0, 12);
    if (clean.length < 3) { res.status(400).json({ error: "Need at least 3 categories" }); return; }
    const label = (typeof body.customLabel === "string" ? body.customLabel.trim() : "").slice(0, 40) || "Personalizado";
    roomCategoryPacks.set(code, { pack: "custom", customCategories: clean, customLabel: label });
  } else {
    roomCategoryPacks.set(code, { pack });
  }
  // 🚀 Notify all players the host changed the category pack
  try { broadcastAndFormat(rooms[0]); } catch {}
  res.json({ ok: true, categoryPack: pack });
});

// POST /rooms/:roomCode/use-card — player activates their power card
router.post("/:roomCode/use-card", async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
  const { playerId } = req.body as { playerId: string };

  // 🔒 A logged-in account can only use a card AS ITSELF (guests pass through).
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }

  // 🔒 Optimistic-concurrency loop. The card effect is a read-modify-write on
  // the players JSON blob; a naive version could (a) be clobbered by a
  // concurrent /results write (lost answers) or (b) let a double-click apply the
  // card twice. We CAS on `updatedAt`: re-read fresh state each attempt and only
  // commit if nothing else wrote in between, otherwise retry with the new state.
  for (let attempt = 0; attempt < 5; attempt++) {
    const [room] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
    if (!room) { res.status(404).json({ error: "Room not found" }); return; }

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
      .where(and(eq(roomsTable.roomCode, code), eq(roomsTable.updatedAt, room.updatedAt)))
      .returning();

    if (!updated) continue; // someone else wrote first — retry with fresh state

    // 🚀 Notify all players when a power card is used (sabotage/steal/shield affect everyone)
    const formatted = broadcastAndFormat(updated);
    res.json({ ok: true, card, room: formatted });
    return;
  }

  // Lost the race 5 times in a row (extreme contention) — let the client retry.
  res.status(409).json({ error: "Room busy, try again" });
});

// GET /rooms/:roomCode/events — SSE stream for real-time room state
//
// 🔒 Hardened against three abuse vectors that mattered at scale:
//   1. Subscribing to non-existent room codes (memory DoS via the sseClients map).
//   2. Subscribing to private rooms without being a member (info disclosure).
//   3. Unbounded fan-out per room (single noisy room could exhaust sockets).
const MAX_SSE_CLIENTS_PER_ROOM = 200;
router.get("/:roomCode/events", async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
  const playerId = (req.query["playerId"] as string) || "";

  // 1. Room must exist before we ever touch the in-memory map.
  const [roomRow] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (!roomRow) { res.status(404).json({ error: "Room not found" }); return; }

  // 2. Private rooms require the caller to be a real member of the room.
  if ((roomRow as any).isPublic === false) {
    const members = parsePlayers(roomRow.playersJson);
    const isMember = !!playerId && members.some((p: any) => p.playerId === playerId);
    if (!isMember) { res.status(403).json({ error: "Not a member of this room" }); return; }
    // 🔒 If the claimed member is a logged-in account, prove ownership. EventSource
    // cannot send custom headers, so accept the signed token via the `token` query
    // param (falls back to the auth cookie). Guests (UUID ids) carry no token and
    // are gated only by knowing their own random id. Fails open when auth is unset.
    if (isLoggedInId(playerId) && isAuthConfigured()) {
      const queryToken = typeof req.query["token"] === "string" ? (req.query["token"] as string) : undefined;
      const verified = verifyPlayerToken(queryToken) ?? readPlayerId(req);
      if (verified !== playerId) {
        res.status(403).json({ error: "Identity verification failed" }); return;
      }
    }
  }

  // 3. Bound the per-room subscription set so a single hot room can't drown the box.
  const existing = sseClients.get(code);
  if (existing && existing.size >= MAX_SSE_CLIENTS_PER_ROOM) {
    res.status(429).json({ error: "Too many active subscribers for this room" });
    return;
  }

  res.setHeader("Content-Type", "text/event-stream");
  res.setHeader("Cache-Control", "no-cache");
  res.setHeader("Connection", "keep-alive");
  res.setHeader("X-Accel-Buffering", "no");
  res.flushHeaders?.();

  // Send current state immediately
  res.write(`data: ${JSON.stringify(formatRoom(roomRow))}\n\n`);

  const client: SseClient = { res, playerId };
  if (!sseClients.has(code)) sseClients.set(code, new Set());
  sseClients.get(code)!.add(client);

  // Heartbeat every 25s to keep connection alive
  const heartbeat = setInterval(() => {
    try { res.write(": heartbeat\n\n"); } catch { clearInterval(heartbeat); }
  }, 25_000);

  req.on("close", () => {
    clearInterval(heartbeat);
    const set = sseClients.get(code);
    set?.delete(client);
    // Free the map slot when the room is empty so we don't leak entries
    // for short-lived rooms over time.
    if (set && set.size === 0) sseClients.delete(code);
  });
});

// POST /rooms/:roomCode/phrase — quick phrase (social chat)
// POST /rooms/:roomCode/typing — heartbeat: this player is currently typing.
// Throttled by the client to once every ~1.5s. Stale entries auto-expire after 3s.
router.post("/:roomCode/typing", writeLimiter, async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
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

// GET /rooms/:roomCode/draft — recover this player's own in-flight responses
// after a reconnect (closed app, lost network, browser crash). Reads from
// the in-memory `roomLiveResponses` map which is refreshed by /typing.
// Returns whatever the server last received for this player in the current
// round; client can decide whether to apply it based on round/letter match.
router.get("/:roomCode/draft", async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
  const playerId = (req.query["playerId"] as string) || "";
  if (!playerId) { res.status(400).json({ error: "playerId required" }); return; }

  // Auth: caller must actually be in the room (private rooms expose nothing).
  const [roomRow] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, code)).limit(1);
  if (!roomRow) { res.status(404).json({ error: "Room not found" }); return; }
  const members = parsePlayers(roomRow.playersJson);
  if (!members.some((p: any) => p.playerId === playerId)) {
    res.status(403).json({ error: "Not a member of this room" });
    return;
  }

  const lr = roomLiveResponses.get(code);
  const entry = lr?.get(playerId);
  if (!entry) { res.json({ responses: {}, ts: 0, age: null }); return; }
  res.json({
    responses: entry.responses,
    ts: entry.ts,
    age: Date.now() - entry.ts,
    round: roomRow.currentRound,
    letter: roomRow.currentLetter,
  });
});

// 🕵️ POST /rooms/:roomCode/spy — peek at one rival's in-progress answer.
// 1 use per round per player. Client should apply -10 pts at submission time.
router.post("/:roomCode/spy", writeLimiter, async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
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
router.post("/:roomCode/funvote", writeLimiter, async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
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
  const oldCode = paramStr(req.params.roomCode).toUpperCase();
  const { playerId, playerName, avatarColor } = req.body as { playerId: string; playerName: string; avatarColor?: string };
  // 🔒 A logged-in account can only request a rematch AS ITSELF (guests pass).
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }

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

router.post("/:roomCode/phrase", writeLimiter, async (req, res) => {
  const code = paramStr(req.params.roomCode).toUpperCase();
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

// POST /rooms/:roomCode/stop — ANY player IN THE ROOM can stop the round globally
router.post("/:roomCode/stop", async (req, res) => {
  const roomCode = paramStr(req.params.roomCode);
  const { playerId, playerName } = req.body;

  if (!playerId) { res.status(400).json({ error: "playerId required" }); return; }
  // 🔒 A logged-in account can only call STOP AS ITSELF (guests pass through).
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }

  const rooms = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
  if (rooms.length === 0) { res.status(404).json({ error: "Room not found" }); return; }

  const room = rooms[0];

  // 🔐 Authorization: caller must actually be in the room. Without this, any
  // process knowing the room code could remotely freeze the round for griefing.
  const roomPlayers = parsePlayers(room.playersJson);
  const isMember = roomPlayers.some((p: any) => p.playerId === playerId);
  if (!isMember) {
    res.status(403).json({ error: "Only players in the room can call STOP" });
    return;
  }

  // Only stop if currently playing (ignore duplicate stops)
  if (room.status !== "playing") {
    res.json(formatRoom(room));
    return;
  }

  const stopper = { id: playerId, name: playerName, stopTimestamp: Date.now() };

  // Preserve the authoritative round-start timestamp so clients keep seeing
  // a consistent deadline through STOP → freeze → submit transitions.
  const prevMeta = parseBluffMeta(room.stopperJson) ?? {};
  const newMeta = {
    ...prevMeta,
    stopper,
    stopTimestamp: stopper.stopTimestamp,
    roundStartedAt: prevMeta.roundStartedAt ?? Date.now(),
  };

  const [updated] = await db.update(roomsTable)
    .set({
      status: "stopped",
      stopperJson: JSON.stringify(newMeta),
      updatedAt: new Date(),
    })
    .where(eq(roomsTable.roomCode, roomCode.toUpperCase()))
    .returning();

  res.json(broadcastAndFormat(updated));

  // 🤖 If bots are in this room and haven't submitted yet, rush them so the
  // round can advance ~3s after STOP (mimics a human freezing then submitting).
  const updatedPlayers = parsePlayers(updated.playersJson);
  const pendingBots = updatedPlayers.filter((p: any) => p.isBot && !p.isReady);
  if (pendingBots.length > 0) {
    rushBotSubmits({
      roomCode: roomCode.toUpperCase(),
      bots: pendingBots.map((b: any) => ({ playerId: b.playerId })),
      deps: botDeps,
    });
  }
});

// POST /rooms/:roomCode/results — each player submits their answers after STOP
// Hard cap on category submissions per round to prevent score inflation via fake category keys.
// Standard Scattergories decks across all supported languages have ≤12 categories; 15 gives margin.
const MAX_CATEGORIES_PER_ROUND = 15;

router.post("/:roomCode/results", writeLimiter, async (req, res) => {
  const roomCode = paramStr(req.params.roomCode);
  const body = SubmitRoomResultsBody.safeParse(req.body);
  if (!body.success) { res.status(400).json({ error: "Invalid request body" }); return; }

  // 🔒 A logged-in account can only submit results AS ITSELF — blocks score
  // injection under another account's id. Guests (UUID ids) pass through.
  if (!verifyClaimedIdentity(req, body.data.playerId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
  }

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

  // ── Stuck-player grace window ─────────────────────────────────────────────
  // After STOP we wait this long before considering non-submitters as
  // truly disconnected. A player who DID submit (even late) gets their
  // answers scored normally — we never zero out an honest submission just
  // because their request was slow. Only the sweep below zeros players
  // who never sent anything.
  // 🛡️ Anti-cheat: bounded window. Honest client freezes 3s after STOP and
  // submits immediately. 15s is generous enough for mobile networks with
  // multi-second hiccups but still short enough that a tampered client can't
  // keep typing words for 30+ seconds. Any /results that arrives after this
  // cutoff is accepted but scored ZERO (see hard cutoff below) — the player
  // can't gain points by stalling.
  // (SUBMIT_GRACE_MS / PRESENCE_GRACE_MS are module-level constants now so the
  // background sweeper can reuse the exact same windows.)
  const stopMeta = parseBluffMeta(room.stopperJson);
  const stopTimestamp: number | undefined =
    stopMeta?.stopTimestamp ?? stopMeta?.stopper?.stopTimestamp;
  // ─────────────────────────────────────────────────────────────────────────

  const players = existingPlayers;
  const { playerId, bluffedCategories, bluffedWords } = body.data;

  // Update this player's score and mark as ready; store bluff data
  const { answers } = body.data;

  // ── T002: Letter validation — strip answers that don't start with the correct letter
  const letter = (room.currentLetter ?? "A").toUpperCase();
  const safeAnswers: Record<string, string> = {};
  if (answers && typeof answers === "object") {
    const entries = Object.entries(answers).slice(0, MAX_CATEGORIES_PER_ROUND);
    for (const [cat, val] of entries) {
      if (typeof val === "string" && val.trim().length > 0) {
        const word = val.trim().slice(0, 80);
        if (word.toUpperCase().startsWith(letter)) {
          safeAnswers[cat] = word;
        }
        // Answers starting with wrong letter are silently dropped
      }
    }
  }

  // ── 🛡️ Server-AUTHORITATIVE score recalculation ─────────────────────────
  // Client `roundScore` is IGNORED. We recompute everything from `answers`
  // so a tampered request (e.g. devtools) cannot inflate points. We also
  // cap valid answers at AUTHORITATIVE_CATEGORY_CAP — even if the client
  // injects fake category keys, only this many can score (defends against
  // category-key injection padding the score with extra +10s).
  const AUTHORITATIVE_CATEGORY_CAP = 8; // largest pack across ES/EN/PT/FR
  const { score: baseScoreRaw, validCount: validAnswerCountRaw } = calcServerScore(safeAnswers, letter);
  const validAnswerCount = Math.min(validAnswerCountRaw, AUTHORITATIVE_CATEGORY_CAP);
  const baseScore = Math.min(baseScoreRaw, validAnswerCount * 10);

  // ⏱️ Stopper +5 speed bonus — only if THIS player called STOP and filled
  // (almost) every category. Threshold 7 matches the real standard pack
  // (Nombre/Lugar/Animal/Objeto/Color/Fruta/Marca → 7 categories) across
  // every supported language. Computed server-side from stopperJson, never
  // trusting the client.
  const stopMetaForScore = parseBluffMeta(room.stopperJson);
  const stopperId: string | undefined =
    stopMetaForScore?.stopper?.id ?? stopMetaForScore?.id;
  const isStopper = stopperId === playerId;
  const STOPPER_BONUS_THRESHOLD = 7;
  let cappedRoundScore = baseScore;
  if (isStopper && validAnswerCount >= STOPPER_BONUS_THRESHOLD) {
    cappedRoundScore += 5;
  }

  // 🕵️ Authoritative spy penalty: -10 pts if the server registered a spy use this round
  const spies = roomSpyUsage.get(roomCode.toUpperCase());
  if (spies?.has(playerId)) {
    cappedRoundScore = Math.max(0, cappedRoundScore - 10);
  }

  // 🛡️ Anti-cheat hard cutoff: submissions that arrive AFTER the grace window
  // score zero. A tampered client that buffered extra words past STOP can't
  // benefit because waiting past the cutoff zeroes them anyway. Honest clients
  // freeze for 3s and submit immediately, so they comfortably beat the 8s.
  if (stopTimestamp && Date.now() - stopTimestamp > SUBMIT_GRACE_MS) {
    cappedRoundScore = 0;
  }

  const finishedAt = Date.now();
  const updatedPlayers = players.map((p: any) => {
    if (p.playerId === playerId) {
      return {
        ...p,
        score: (p.score || 0) + cappedRoundScore,
        roundScore: cappedRoundScore,
        isReady: true,
        answers: safeAnswers,
        // ⏱️ Tie-breaker source-of-truth: who finished first wins ties
        finishedAt,
        wasStopper: isStopper,
        bluffedCategories: bluffedCategories ?? [],
        bluffedWords: bluffedWords ?? {},
      };
    }
    return p;
  });

  // 🧹 Stuck-player sweep + round advance — shared with the background
  // sweepStuckRooms() failsafe so a round can never deadlock waiting on a
  // submission that never physically arrives.
  const { sweptPlayers, newStatus, newLetter, newRound, newStopperJson } =
    finalizeRoundState(room, updatedPlayers);

  // Optimistic concurrency: only update if the room hasn't changed since we read it.
  // If a concurrent /results submission won the race, return the latest state instead.
  const updateResult = await db.update(roomsTable)
    .set({
      playersJson: JSON.stringify(sweptPlayers),
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

  // We won the write — run one-shot side effects (leaderboard + map cleanup).
  applyRoundAdvanceSideEffects(room, sweptPlayers, newStatus);
  res.json(broadcastAndFormat(updateResult[0]));
});

// POST /rooms/:roomCode/bluff-vote — opponent casts "lie" or "real" for a bluffed category
router.post("/:roomCode/bluff-vote", writeLimiter, async (req, res) => {
  const roomCode = paramStr(req.params.roomCode);
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
  // 🔒 A logged-in account can only vote AS ITSELF (guests pass through).
  if (!verifyClaimedIdentity(req, voterId)) {
    res.status(403).json({ error: "Identity verification failed" }); return;
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
    // 🔒 CAS on status="bluffvoting": only the request that actually flips the
    // room OUT of bluffvoting wins. Prevents this handler AND /resolve-bluffs
    // (or two concurrent voters) from BOTH submitting final scores — the old
    // code submitted to the leaderboard before the write, so a race double-paid.
    const [updated] = await db.update(roomsTable)
      .set({
        playersJson: JSON.stringify(resolved),
        currentRound: isGameOver ? room.maxRounds : newRound,
        currentLetter: isGameOver ? room.currentLetter : randomLetter(),
        status: newStatus,
        stopperJson: JSON.stringify({ stopper: meta.stopper, bluffResults: bluffVotes }),
        updatedAt: new Date(),
      })
      .where(and(eq(roomsTable.roomCode, roomCode.toUpperCase()), eq(roomsTable.status, "bluffvoting")))
      .returning();
    if (!updated) {
      // Someone else already resolved this round — return current state, no submit.
      const [cur] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
      res.json(formatRoom(cur));
      return;
    }
    if (isGameOver) {
      submitAllScoresToLeaderboard(resolved, room.currentLetter || "A").catch(() => {});
    }
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
  const roomCode = paramStr(req.params.roomCode);

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

  // 🔒 Same CAS guard as the vote handler: only submit scores if THIS request
  // is the one that transitions the room out of "bluffvoting".
  const [updated] = await db.update(roomsTable)
    .set({
      playersJson: JSON.stringify(resolved),
      currentRound: isGameOver ? room.maxRounds : newRound,
      currentLetter: isGameOver ? room.currentLetter : randomLetter(),
      status: newStatus,
      stopperJson: JSON.stringify({ stopper: meta.stopper, bluffResults: bluffVotes }),
      updatedAt: new Date(),
    })
    .where(and(eq(roomsTable.roomCode, roomCode.toUpperCase()), eq(roomsTable.status, "bluffvoting")))
    .returning();
  if (!updated) {
    const [cur] = await db.select().from(roomsTable).where(eq(roomsTable.roomCode, roomCode.toUpperCase())).limit(1);
    res.json(formatRoom(cur));
    return;
  }
  if (isGameOver) {
    submitAllScoresToLeaderboard(resolved, room.currentLetter || "A").catch(() => {});
  }

  res.json(broadcastAndFormat(updated));
});

export default router;
