import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
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
// overwriting another feature's data. The read/merge/write is serialized by
// a row lock so concurrent progress saves cannot lose each other's changes.
router.post("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  try {
    await db.transaction(async (tx) => {
      const locked = await tx.execute(sql`
        SELECT id, achievements_json, achievement_stats_json,
               personal_bests_json, collected_words_json
        FROM player_scores
        WHERE player_id = ${playerId}
        FOR UPDATE
      `) as unknown as { rows?: Array<{
        id: number;
        achievements_json: string | null;
        achievement_stats_json: string | null;
        personal_bests_json: string | null;
        collected_words_json: string | null;
      }> };

      const player = locked.rows?.[0];
      if (!player) {
        throw Object.assign(new Error("Player not found"), { statusCode: 404 });
      }

      const body = (req.body ?? {}) as JsonRecord;
      const updates: JsonRecord = {};

      if (Array.isArray(body.achievements)) {
        const current = parseJson<string[]>(player.achievements_json, []);
        const incoming = body.achievements.filter((x): x is string => typeof x === "string");
        updates.achievementsJson = JSON.stringify([...new Set([...current, ...incoming])]);
      }

      if (body.stats && typeof body.stats === "object" && !Array.isArray(body.stats)) {
        const current = parseJson<JsonRecord>(player.achievement_stats_json, {});
        updates.achievementStatsJson = JSON.stringify(mergeStats(current, body.stats as JsonRecord));
      }

      if (body.personalBests && typeof body.personalBests === "object" && !Array.isArray(body.personalBests)) {
        const current = parseJson<JsonRecord>(player.personal_bests_json, {});
        const incoming = body.personalBests as JsonRecord;
        const merged: JsonRecord = { ...current };
        for (const [mode, score] of Object.entries(incoming)) {
          if (typeof score !== "number") continue;
          merged[mode] = Math.max(Number(current[mode] ?? 0), score);
        }
        updates.personalBestsJson = JSON.stringify(merged);
      }

      if (body.collectedWords && typeof body.collectedWords === "object" && !Array.isArray(body.collectedWords)) {
        const current = parseJson<JsonRecord>(player.collected_words_json, {});
        updates.collectedWordsJson = JSON.stringify(
          mergeCollectedWords(current, body.collectedWords as JsonRecord),
        );
      }

      if (Object.keys(updates).length > 0) {
        await tx
          .update(playerScoresTable)
          .set(updates as any)
          .where(eq(playerScoresTable.id, player.id));
      }
    });

    res.json({ ok: true });
  } catch (e: unknown) {
    const statusCode = typeof e === "object" && e !== null && "statusCode" in e
      ? Number((e as { statusCode?: unknown }).statusCode)
      : 500;
    if (statusCode === 404) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    console.error("[progress/update] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to update progress" });
  }
});

export default router;
