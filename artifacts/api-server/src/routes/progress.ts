import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

type JsonRecord = Record<string, unknown>;
const MAX_PERSONAL_BESTS = 20;
const MAX_KEY_LENGTH = 80;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value ?? "") as T;
  } catch {
    return fallback;
  }
}

// Authoritative player progress used by streak, collection, achievements and
// personal-best UIs. Gameplay-derived values are never accepted from the
// client as achievements/stats; only a local personal-best can be synced when
// the server already has an equal-or-higher score for that mode.
router.get("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const rows = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const player = rows[0];
  res.json({
    achievements: parseJson<string[]>(player.achievementsJson, []),
    stats: parseJson<JsonRecord>(player.achievementStatsJson, {}),
    personalBests: parseJson<JsonRecord>(player.personalBestsJson, {}),
    collectedWords: parseJson<JsonRecord>(player.collectedWordsJson, {}),
    currentStreak: player.currentStreak ?? 0,
    longestStreak: player.longestStreak ?? 0,
    lastPlayedDate: player.lastPlayedDate ?? null,
  });
});

router.get("/streak/calendar/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const rows = await db
    .select({
      currentStreak: playerScoresTable.currentStreak,
      longestStreak: playerScoresTable.longestStreak,
      lastPlayedDate: playerScoresTable.lastPlayedDate,
      streakDaysJson: playerScoresTable.streakDaysJson,
    })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const player = rows[0];
  const storedDays = parseJson<string[]>(player.streakDaysJson, []);
  const days = [...new Set(storedDays)].sort().slice(-30);
  const today = new Date().toISOString().slice(0, 10);

  res.json({
    currentStreak: player.currentStreak ?? 0,
    longestStreak: player.longestStreak ?? 0,
    lastPlayedDate: player.lastPlayedDate ?? null,
    days: days.map(date => ({ date, played: true, isToday: date === today })),
  });
});

// Client progress is not authoritative. Achievements and achievement stats
// are derived from server gameplay and are therefore ignored here. A client
// may only synchronize a personal-best value when that value is already
// backed by game_history for the same player and mode.
router.post("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const rows = await db
    .select({ personalBestsJson: playerScoresTable.personalBestsJson })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const body = (req.body ?? {}) as JsonRecord;
  const personalBests = body.personalBests;

  // Ignore client-supplied achievements/stats entirely. In particular, never
  // persist arbitrary achievement ids, counters or booleans supplied by the
  // caller, even when the caller is authenticated.
  if (!personalBests || typeof personalBests !== "object" || Array.isArray(personalBests)) {
    res.json({ ok: true });
    return;
  }

  const incoming = personalBests as JsonRecord;
  const modes = Object.keys(incoming)
    .filter(mode => mode.length <= MAX_KEY_LENGTH)
    .slice(0, MAX_PERSONAL_BESTS);

  if (modes.length === 0) {
    res.json({ ok: true });
    return;
  }

  const historyRows = await db
    .select({
      mode: gameHistoryTable.mode,
      maxScore: sql<number>`MAX(${gameHistoryTable.score})`,
    })
    .from(gameHistoryTable)
    .where(eq(gameHistoryTable.playerId, playerId))
    .groupBy(gameHistoryTable.mode);

  const authoritativeMax = new Map(
    historyRows.map(row => [String(row.mode), Number(row.maxScore ?? 0)])
  );

  const current = parseJson<JsonRecord>(rows[0].personalBestsJson, {});
  const merged: JsonRecord = { ...current };

  for (const mode of modes) {
    const score = incoming[mode];
    if (typeof score !== "number" || !Number.isFinite(score)) continue;

    const safeScore = Math.max(0, Math.min(Math.floor(score), 100_000));
    const serverMax = authoritativeMax.get(mode);

    // A local device may report a legitimate score the server already knows,
    // but it can never manufacture a higher personal best.
    if (serverMax === undefined || safeScore > serverMax) continue;

    merged[mode] = Math.max(Number(current[mode] ?? 0), safeScore);
  }

  if (JSON.stringify(merged) !== JSON.stringify(current)) {
    await db
      .update(playerScoresTable)
      .set({ personalBestsJson: JSON.stringify(merged) })
      .where(eq(playerScoresTable.playerId, playerId));
  }

  res.json({ ok: true });
});

export default router;
