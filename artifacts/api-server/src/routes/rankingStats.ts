import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";

const router: IRouter = Router();

function parseStreakDays(value: unknown): string[] {
  try {
    const parsed = JSON.parse(String(value ?? "[]"));
    return Array.isArray(parsed) ? parsed.filter((d): d is string => typeof d === "string") : [];
  } catch {
    return [];
  }
}

function isoDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/**
 * Authoritative streak calendar used by the web client.
 * The player_scores row is the source of truth; this endpoint only reads it.
 */
router.get("/streak/calendar/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const [player] = await db
    .select({
      currentStreak: playerScoresTable.currentStreak,
      longestStreak: playerScoresTable.longestStreak,
      lastPlayedDate: playerScoresTable.lastPlayedDate,
      streakDaysJson: playerScoresTable.streakDaysJson,
    })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const playedDays = new Set(parseStreakDays(player.streakDaysJson));
  const today = new Date();
  const days = Array.from({ length: 30 }, (_, index) => {
    const date = new Date(today);
    date.setUTCDate(today.getUTCDate() - (29 - index));
    const dateString = isoDate(date);
    return {
      date: dateString,
      played: playedDays.has(dateString),
      isToday: dateString === isoDate(today),
    };
  });

  res.json({
    currentStreak: player.currentStreak ?? 0,
    longestStreak: player.longestStreak ?? 0,
    lastPlayedDate: player.lastPlayedDate ?? null,
    days,
  });
});

/**
 * Player progression endpoint kept separate from /scores/:playerId so it can
 * evolve without changing the existing ranking contract.
 */
router.get("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const [player] = await db
    .select({
      xp: playerScoresTable.xp,
      level: playerScoresTable.level,
      coins: playerScoresTable.coins,
      gamesPlayed: playerScoresTable.gamesPlayed,
      wins: playerScoresTable.wins,
      totalScore: playerScoresTable.totalScore,
      currentStreak: playerScoresTable.currentStreak,
      longestStreak: playerScoresTable.longestStreak,
    })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!player) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const xp = Number(player.xp ?? 0);
  const level = Number(player.level ?? 1);
  const thresholds = [0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200, 4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000];
  const currentThreshold = thresholds[Math.max(0, Math.min(level - 1, thresholds.length - 1))] ?? 0;
  const nextThreshold = thresholds[level] ?? (thresholds[thresholds.length - 1] + 2000);
  const xpIntoLevel = Math.max(0, xp - currentThreshold);
  const xpForLevel = Math.max(1, nextThreshold - currentThreshold);

  const [recent] = await db
    .select({ lastPlayedDate: playerScoresTable.lastPlayedDate })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  res.json({
    playerId,
    xp,
    level,
    coins: Number(player.coins ?? 0),
    totalScore: Number(player.totalScore ?? 0),
    gamesPlayed: Number(player.gamesPlayed ?? 0),
    wins: Number(player.wins ?? 0),
    currentStreak: Number(player.currentStreak ?? 0),
    longestStreak: Number(player.longestStreak ?? 0),
    currentLevelXp: currentThreshold,
    nextLevelXp: nextThreshold,
    xpIntoLevel,
    xpForLevel,
    progress: Math.min(1, xpIntoLevel / xpForLevel),
    lastPlayedDate: recent?.lastPlayedDate ?? null,
  });
});

export default router;
