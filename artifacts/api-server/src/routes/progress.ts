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
  if (!await verifyClaimedIdentity(req, playerId)) {
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
  if (!await verifyClaimedIdentity(req, playerId)) {
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
  if (!await verifyClaimedIdentity(req, playerId)) {
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
  const collectedWords = body.collectedWords;

  // Ignore client-supplied achievements/stats entirely. In particular, never
  // persist arbitrary achievement ids, counters or booleans supplied by the
  // caller, even when the caller is authenticated.
  const hasPersonalBests = personalBests && typeof personalBests === "object" && !Array.isArray(personalBests);
  const hasCollectedWords = collectedWords && typeof collectedWords === "object" && !Array.isArray(collectedWords);

  if (!hasPersonalBests && !hasCollectedWords) {
    res.json({ ok: true });
    return;
  }

  const incoming = hasPersonalBests ? personalBests as JsonRecord : {};
  const collectionIncoming = hasCollectedWords ? collectedWords as JsonRecord : {};
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
  // Older solo games were stored under the generic "solo" mode. Preserve
  // those scores as evidence for the new explicit "normal" personal-best key.
  const legacySoloMax = authoritativeMax.get("solo");
  if (legacySoloMax !== undefined) {
    authoritativeMax.set("normal", Math.max(authoritativeMax.get("normal") ?? 0, legacySoloMax));
  }

  // Serialize the read/merge/write itself. Without the row lock, two devices
  // can both read the same JSON, merge different modes, and the second UPDATE
  // silently discard the first device's legitimate progress.
  await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT personal_bests_json, collected_words_json
      FROM player_scores
      WHERE player_id = ${playerId}
      FOR UPDATE
    `);
    const lockedRow = (locked.rows as Array<{ personal_bests_json: string | null; collected_words_json: string | null }>)[0];
    if (!lockedRow) throw new Error("Player not found");

    const current = parseJson<JsonRecord>(lockedRow.personal_bests_json, {});
    const merged: JsonRecord = { ...current };
    const currentCollection = parseJson<JsonRecord>(lockedRow.collected_words_json, {});
    const mergedCollection: JsonRecord = { ...currentCollection };

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

    for (const [key, value] of Object.entries(collectionIncoming)) {
      if (Object.keys(mergedCollection).length >= 5000) break;
      if (mergedCollection[key] !== undefined) continue;
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      mergedCollection[key] = value;
    }

    if (JSON.stringify(merged) !== JSON.stringify(current) || JSON.stringify(mergedCollection) !== JSON.stringify(currentCollection)) {
      await tx
        .update(playerScoresTable)
        .set({ personalBestsJson: JSON.stringify(merged), collectedWordsJson: JSON.stringify(mergedCollection) })
        .where(eq(playerScoresTable.playerId, playerId));
    }
  });

  res.json({ ok: true });
});

export default router;
