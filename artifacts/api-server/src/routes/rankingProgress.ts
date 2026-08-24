import { Router } from "express";
import { db, playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router = Router();
type JsonObject = Record<string, unknown>;

type AchievementStats = {
  totalWins: number;
  totalGames: number;
  maxCombo: number;
  wonSpeedRound: boolean;
  wonChaosRound: boolean;
  validWordsRecord: number;
  xpTotal: number;
  longestStreak: number;
  usedCustomPack: boolean;
  timesShared: number;
  aiZeroWin: boolean;
  // Server-authoritative counters populated only from signed score vouchers.
  aiEasyGames: number;
  aiExpertGames: number;
};

function parseJsonObject(raw: string | null | undefined): JsonObject {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as JsonObject : {};
  } catch {
    return {};
  }
}

function parseJsonArray(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((v): v is string => typeof v === "string") : [];
  } catch {
    return [];
  }
}

function finiteNumber(value: unknown, fallback = 0): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

function mergeAchievementStats(currentRaw: string | null | undefined, incoming: unknown): AchievementStats {
  const current = parseJsonObject(currentRaw);
  const incomingObj = incoming && typeof incoming === "object" && !Array.isArray(incoming)
    ? incoming as JsonObject
    : {};

  return {
    totalWins: Math.max(finiteNumber(current.totalWins), finiteNumber(incomingObj.totalWins)),
    totalGames: Math.max(finiteNumber(current.totalGames), finiteNumber(incomingObj.totalGames)),
    maxCombo: Math.max(finiteNumber(current.maxCombo), finiteNumber(incomingObj.maxCombo)),
    wonSpeedRound: Boolean(current.wonSpeedRound) || Boolean(incomingObj.wonSpeedRound),
    wonChaosRound: Boolean(current.wonChaosRound) || Boolean(incomingObj.wonChaosRound),
    validWordsRecord: Math.max(finiteNumber(current.validWordsRecord), finiteNumber(incomingObj.validWordsRecord)),
    xpTotal: Math.max(finiteNumber(current.xpTotal), finiteNumber(incomingObj.xpTotal)),
    longestStreak: Math.max(finiteNumber(current.longestStreak), finiteNumber(incomingObj.longestStreak)),
    usedCustomPack: Boolean(current.usedCustomPack) || Boolean(incomingObj.usedCustomPack),
    timesShared: Math.max(finiteNumber(current.timesShared), finiteNumber(incomingObj.timesShared)),
    aiZeroWin: Boolean(current.aiZeroWin) || Boolean(incomingObj.aiZeroWin),
    // NEVER accept these two from the browser. They are incremented only by
    // /ranking/scores after validating HMAC-signed AI-difficulty vouchers.
    aiEasyGames: Math.max(0, Math.floor(finiteNumber(current.aiEasyGames))),
    aiExpertGames: Math.max(0, Math.floor(finiteNumber(current.aiExpertGames))),
  };
}

// Compatibility endpoint for collection/achievement progress. A missing player
// row is intentionally represented as empty progress, never as a 404, because
// the web client treats progress as optional and must not crash on guests.
router.get("/progress/:playerId", async (req, res) => {
  const playerId = String(req.params.playerId || "").trim();
  if (!playerId) return res.status(400).json({ error: "Missing playerId", collectedWords: {}, achievements: [] });

  try {
    const rows = await db.select({
      collectedWordsJson: playerScoresTable.collectedWordsJson,
      achievementsJson: playerScoresTable.achievementsJson,
      achievementStatsJson: playerScoresTable.achievementStatsJson,
      coins: playerScoresTable.coins,
      xp: playerScoresTable.xp,
      level: playerScoresTable.level,
    }).from(playerScoresTable).where(eq(playerScoresTable.playerId, playerId)).limit(1);

    if (!rows.length) {
      return res.json({
        playerId,
        collectedWords: {},
        achievements: [],
        stats: { coins: 0, xp: 0, level: 1, aiEasyGames: 0, aiExpertGames: 0 },
      });
    }

    return res.json({
      playerId,
      collectedWords: parseJsonObject(rows[0].collectedWordsJson),
      achievements: parseJsonArray(rows[0].achievementsJson),
      stats: {
        ...parseJsonObject(rows[0].achievementStatsJson),
        coins: rows[0].coins ?? 0,
        xp: rows[0].xp ?? 0,
        level: rows[0].level ?? 1,
      },
    });
  } catch (error) {
    console.error("[ranking/progress] GET failed:", error);
    return res.status(500).json({ error: "Could not load progress", collectedWords: {}, achievements: [] });
  }
});

router.post("/progress/:playerId", async (req, res) => {
  const playerId = String(req.params.playerId || "").trim();
  if (!playerId) return res.status(400).json({ error: "Missing playerId" });
  if (!verifyClaimedIdentity(req, playerId)) return res.status(403).json({ error: "Identity verification failed" });

  const incomingCollection = req.body?.collectedWords;
  const incomingAchievements = Array.isArray(req.body?.achievements)
    ? req.body.achievements.filter((v: unknown): v is string => typeof v === "string")
    : [];
  const hasStats = req.body?.stats && typeof req.body.stats === "object" && !Array.isArray(req.body.stats);

  if (!incomingCollection || typeof incomingCollection !== "object" || Array.isArray(incomingCollection)) {
    return res.status(400).json({ error: "Invalid collectedWords" });
  }

  try {
    const rows = await db.select({
      id: playerScoresTable.id,
      collectedWordsJson: playerScoresTable.collectedWordsJson,
      achievementsJson: playerScoresTable.achievementsJson,
      achievementStatsJson: playerScoresTable.achievementStatsJson,
    }).from(playerScoresTable).where(eq(playerScoresTable.playerId, playerId)).limit(1);

    if (!rows.length) return res.status(404).json({ error: "Player not found" });

    const currentCollection = parseJsonObject(rows[0].collectedWordsJson);
    const mergedCollection: JsonObject = { ...currentCollection };
    for (const [key, value] of Object.entries(incomingCollection as JsonObject)) {
      if (!(key in mergedCollection)) mergedCollection[key] = value;
    }

    const currentAchievements = parseJsonArray(rows[0].achievementsJson);
    const mergedAchievements = [...new Set([...currentAchievements, ...incomingAchievements])];

    // Client-originated achievement stats are monotonic, but the two AI
    // difficulty counters are explicitly excluded from incoming data. Their
    // only authoritative writer is /ranking/scores after HMAC verification.
    const mergedStats = hasStats
      ? mergeAchievementStats(rows[0].achievementStatsJson, req.body.stats)
      : mergeAchievementStats(rows[0].achievementStatsJson, {});

    await db.update(playerScoresTable).set({
      collectedWordsJson: JSON.stringify(mergedCollection),
      achievementsJson: JSON.stringify(mergedAchievements),
      achievementStatsJson: JSON.stringify(mergedStats),
      updatedAt: new Date(),
    }).where(eq(playerScoresTable.id, rows[0].id));

    return res.json({
      ok: true,
      playerId,
      collectedWords: mergedCollection,
      achievements: mergedAchievements,
      stats: mergedStats,
    });
  } catch (error) {
    console.error("[ranking/progress] POST failed:", error);
    return res.status(500).json({ error: "Could not save progress" });
  }
});

export default router;