import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

type JsonRecord = Record<string, unknown>;
const MAX_ACHIEVEMENTS = 200;
const MAX_STATS = 200;
const MAX_PERSONAL_BESTS = 20;
const MAX_KEY_LENGTH = 80;
const MAX_WORD_LENGTH = 80;
const MAX_JSON_VALUE_LENGTH = 200;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value ?? "") as T;
  } catch {
    return fallback;
  }
}

function mergeStats(local: JsonRecord, remote: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...local };
  let accepted = 0;
  for (const [key, value] of Object.entries(remote)) {
    if (accepted >= MAX_STATS || key.length > MAX_KEY_LENGTH) break;
    const old = out[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      const previous = typeof old === "number" && Number.isFinite(old) ? old : 0;
      out[key] = Math.max(previous, value);
      accepted++;
    } else if (typeof value === "boolean") {
      out[key] = (typeof old === "boolean" ? old : false) || value;
      accepted++;
    } else if (typeof value === "string" && value.length <= MAX_JSON_VALUE_LENGTH) {
      out[key] = value;
      accepted++;
    }
  }
  return out;
}

// Authoritative player progress used by streak, collection, achievements and
// personal-best UIs. All four are persisted on player_scores.
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

// Partial monotonic updates. A feature can save its own progress without
// overwriting another feature's data.
router.post("/progress/:playerId", async (req, res) => {
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
  const body = (req.body ?? {}) as JsonRecord;
  const updates: JsonRecord = {};

  // Achievements and achievement stats are derived from gameplay and must not
  // be client-authoritative. The old endpoint accepted arbitrary achievement
  // ids/counters, allowing a player to grant themselves badges or inflate
  // progress. Those fields are intentionally ignored here; authoritative
  // server-side game events are responsible for them.
  //
  // Personal bests are also client-supplied for local-device sync, but each
  // value is bounded by the highest score that actually exists in server game
  // history for that player/mode. A client can therefore sync a legitimate
  // local best, but cannot create a best score that the server has never seen.
  if (body.personalBests && typeof body.personalBests === "object" && !Array.isArray(body.personalBests)) {
    const current = parseJson<JsonRecord>(player.personalBestsJson, {});
    const incoming = body.personalBests as JsonRecord;
    const modes = Object.keys(incoming).slice(0, MAX_PERSONAL_BESTS);

    if (modes.length > 0) {
      const rows = await db
        .select({
          mode: gameHistoryTable.mode,
          maxScore: sql<number>`MAX(${gameHistoryTable.score})`,
        })
        .from(gameHistoryTable)
        .where(eq(gameHistoryTable.playerId, playerId))
        .groupBy(gameHistoryTable.mode);

      const authoritativeMax = new Map(
        rows.map(row => [String(row.mode), Number(row.maxScore ?? 0)])
      );
      const merged: JsonRecord = { ...current };
      for (const mode of modes) {
        if (mode.length > MAX_KEY_LENGTH) continue;
        const score = incoming[mode];
        if (typeof score !== "number" || !Number.isFinite(score)) continue;

        const safeScore = Math.max(0, Math.min(Math.floor(score), 100_000));
        const serverMax = authoritativeMax.get(mode);
        if (serverMax === undefined || safeScore > serverMax) continue;

        merged[mode] = Math.max(Number(current[mode] ?? 0), safeScore);
      }
      updates.personalBestsJson = JSON.stringify(merged);
    }
  }

  if (Object.keys(updates).length > 0) {
    await db
      .update(playerScoresTable)
      .set(updates as any)
      .where(eq(playerScoresTable.playerId, playerId));
  }

  res.json({ ok: true });
});

export default router;