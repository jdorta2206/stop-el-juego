import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

type JsonRecord = Record<string, unknown>;
const MAX_ACHIEVEMENTS = 200;
const MAX_STATS = 200;
const MAX_PERSONAL_BESTS = 20;
const MAX_COLLECTED_WORDS = 500;
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
    if (typeof value === "number" && Number.isFinite(value) && typeof old === "number" && Number.isFinite(old)) {
      out[key] = Math.max(old, value);
      accepted++;
    } else if (typeof value === "boolean" && typeof old === "boolean") {
      out[key] = old || value;
      accepted++;
    } else if (typeof value === "string" && value.length <= MAX_JSON_VALUE_LENGTH) {
      out[key] = value;
      accepted++;
    }
  }
  return out;
}

function mergeCollectedWords(local: JsonRecord, remote: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...local };
  let accepted = 0;
  for (const [word, value] of Object.entries(remote)) {
    if (accepted >= MAX_COLLECTED_WORDS || word.length === 0 || word.length > MAX_WORD_LENGTH) break;
    if (!out[word] && (value === true || typeof value === "string" && value.length <= MAX_JSON_VALUE_LENGTH)) {
      out[word] = value;
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

  if (Array.isArray(body.achievements)) {
    const current = parseJson<string[]>(player.achievementsJson, []);
    const incoming = body.achievements
      .filter((x): x is string => typeof x === "string" && x.length > 0 && x.length <= MAX_KEY_LENGTH)
      .slice(0, MAX_ACHIEVEMENTS);
    updates.achievementsJson = JSON.stringify([...new Set([...current, ...incoming])]);
  }

  if (body.stats && typeof body.stats === "object" && !Array.isArray(body.stats)) {
    const current = parseJson<JsonRecord>(player.achievementStatsJson, {});
    updates.achievementStatsJson = JSON.stringify(mergeStats(current, body.stats as JsonRecord));
  }

  if (body.personalBests && typeof body.personalBests === "object" && !Array.isArray(body.personalBests)) {
    const current = parseJson<JsonRecord>(player.personalBestsJson, {});
    const incoming = body.personalBests as JsonRecord;
    const merged: JsonRecord = { ...current };
    let accepted = 0;
    for (const [mode, score] of Object.entries(incoming)) {
      if (accepted >= MAX_PERSONAL_BESTS || mode.length > MAX_KEY_LENGTH) break;
      if (typeof score !== "number" || !Number.isFinite(score)) continue;
      const safeScore = Math.max(0, Math.min(Math.floor(score), 100_000));
      merged[mode] = Math.max(Number(current[mode] ?? 0), safeScore);
      accepted++;
    }
    updates.personalBestsJson = JSON.stringify(merged);
  }

  if (body.collectedWords && typeof body.collectedWords === "object" && !Array.isArray(body.collectedWords)) {
    const current = parseJson<JsonRecord>(player.collectedWordsJson, {});
    updates.collectedWordsJson = JSON.stringify(
      mergeCollectedWords(current, body.collectedWords as JsonRecord),
    );
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