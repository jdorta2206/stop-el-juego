import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

type JsonRecord = Record<string, unknown>;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value ?? "") as T;
  } catch {
    return fallback;
  }
}

function mergeStats(local: JsonRecord, remote: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...local };
  for (const [key, value] of Object.entries(remote)) {
    const old = out[key];
    if (typeof value === "number" && typeof old === "number") out[key] = Math.max(old, value);
    else if (typeof value === "boolean" && typeof old === "boolean") out[key] = old || value;
    else if (value !== undefined) out[key] = value;
  }
  return out;
}

function mergeCollectedWords(local: JsonRecord, remote: JsonRecord): JsonRecord {
  const out: JsonRecord = { ...local };
  for (const [word, value] of Object.entries(remote)) {
    if (!out[word]) out[word] = value;
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
    const incoming = body.achievements.filter((x): x is string => typeof x === "string");
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
    for (const [mode, score] of Object.entries(incoming)) {
      if (typeof score !== "number") continue;
      merged[mode] = Math.max(Number(current[mode] ?? 0), score);
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
