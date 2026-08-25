import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable, pushSubscriptionsTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { sendPushToPlayer } from "../lib/pushHelper";
import { SubmitScoreBody, GetLeaderboardQueryParams } from "@workspace/api-zod";
import { scoreLimiter } from "../middlewares/rateLimit";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { sumVerifiedBase, ceilingFromBase, absoluteCeiling, maxRoundsForMode } from "../lib/scoreToken";
import {
  isHappyHourActiveForTzOffset,
  HAPPY_HOUR_MULTIPLIER,
} from "../lib/happyHour";

function calcCoinGain(score: number, won: boolean, mode: string, isBonus: boolean): number {
  if (isBonus) return 0;
  const base = Math.max(1, Math.floor(score / 30));
  const winBonus = won ? 3 : 0;
  const modeBonus = mode === "multiplayer" ? 2 : mode === "daily" ? 1 : 0;
  return base + winBonus + modeBonus;
}

async function lookupPlayerTzOffset(playerId: string): Promise<number | null> {
  try {
    const rows = await db
      .select({ tz: pushSubscriptionsTable.tzOffsetMinutes })
      .from(pushSubscriptionsTable)
      .where(sql`${pushSubscriptionsTable.playerId} = ${playerId}
              AND ${pushSubscriptionsTable.enabled} = TRUE`)
      .orderBy(desc(pushSubscriptionsTable.id))
      .limit(1);
    return rows[0]?.tz ?? null;
  } catch {
    return null;
  }
}

const router: IRouter = Router();

const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
  4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000,
];

export function calcLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function calcXpGain(score: number, won: boolean, mode: string): number {
  const base = Math.max(0, Math.floor(score / 5));
  const winBonus = won ? 30 : 0;
  const modeBonus = mode === "multiplayer" ? 20 : mode === "daily" ? 15 : 0;
  return base + winBonus + modeBonus;
}

export function getTitle(rank: number): string {
  if (rank === 1) return "👑 Leyenda";
  if (rank <= 3) return "🏆 Campeón";
  if (rank <= 10) return "⭐ Estrella";
  if (rank <= 25) return "🔥 Experto";
  if (rank <= 50) return "💪 Veterano";
  if (rank <= 100) return "🎯 Aspirante";
  return "🌱 Novato";
}

export function appendStreakDay(prevJson: string | null | undefined, today: string): string {
  let days: string[] = [];
  try { days = JSON.parse(prevJson ?? "[]"); } catch {}
  if (!days.includes(today)) days.push(today);
  days = [...new Set(days)].sort().slice(-30);
  return JSON.stringify(days);
}

export function calculateStreak(
  lastPlayedDate: string | null,
  currentStreak: number
): { newStreak: number; updatedToday: boolean } {
  const today = new Date().toISOString().split("T")[0];
  if (lastPlayedDate === today) {
    return { newStreak: currentStreak, updatedToday: false };
  }
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const newStreak = lastPlayedDate === yesterday ? currentStreak + 1 : 1;
  return { newStreak, updatedToday: true };
}

function parseAchievementStats(json: unknown): Record<string, unknown> {
  try {
    const parsed = JSON.parse((json as string) ?? "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

function updateAiDifficultyStats(raw: string | null | undefined, easyCount: number, expertCount: number): string {
  const stats = parseAchievementStats(raw);
  const currentEasy = Number(stats.aiEasyGames ?? 0);
  const currentExpert = Number(stats.aiExpertGames ?? 0);
  return JSON.stringify({
    ...stats,
    aiEasyGames: Math.max(0, Math.floor(currentEasy)) + Math.max(0, Math.floor(easyCount)),
    aiExpertGames: Math.max(0, Math.floor(currentExpert)) + Math.max(0, Math.floor(expertCount)),
  });
}

function parseAchievementCount(json: unknown): number {
  try {
    const parsed = JSON.parse((json as string) ?? "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}

// ============================================================
// RANKING GLOBAL
// ============================================================
router.get("/scores", async (req, res) => {
  const query = GetLeaderboardQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;

  const rows = await db.execute(sql`
    SELECT *
    FROM player_scores
    ORDER BY total_score DESC
    LIMIT ${limit}
  `);

  const players = rows.rows as Array<Record<string, unknown>>;

  const totalRows = await db.execute(sql`
    SELECT COUNT(*) AS count FROM player_scores
  `);
  const total = Number((totalRows.rows[0] as any)?.count ?? 0);

  res.json({
    players: players.map((p, i) => ({
      id: p.id,
      playerId: p.player_id,
      playerName: p.player_name,
      avatarColor: p.avatar_color,
      totalScore: p.total_score,
      gamesPlayed: p.games_played,
      wins: p.wins,
      currentStreak: p.current_streak ?? 0,
      longestStreak: p.longest_streak ?? 0,
      isPremium: p.is_premium ?? false,
      achievementCount: parseAchievementCount(p.achievements_json),
      aiEasyGames: Math.max(0, Math.floor(Number(p.ai_easy_games ?? 0))),
      aiExpertGames: Math.max(0, Math.floor(Number(p.ai_expert_games ?? 0))),
      title: getTitle(i + 1),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      rank: i + 1,
    })),
    total,
  });
});

// ============================================================
// RANKING SEMANAL
// ============================================================
router.get("/weekly", async (req, res) => {
  const rows = await db.execute(sql`
    SELECT
      gh.player_id        AS "playerId",
      ps.player_name      AS "playerName",
      ps.avatar_color     AS "avatarColor",
      ps.current_streak   AS "currentStreak",
      ps.is_premium       AS "isPremium",
      ps.achievements_json AS "achievementsJson",
      ps.ai_easy_games    AS "aiEasyGames",
      ps.ai_expert_games  AS "aiExpertGames",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.current_streak, ps.is_premium, ps.achievements_json, ps.ai_easy_games, ps.ai_expert_games
    ORDER BY SUM(gh.score) DESC
    LIMIT 100
  `);

  const players = (rows.rows as Array<Record<string, unknown>>).map((p, i) => ({
    playerId:      p.playerId,
    playerName:    p.playerName ?? "—",
    avatarColor:   p.avatarColor ?? "#e53e3e",
    totalScore:    Number(p.totalScore ?? 0),
    gamesPlayed:   Number(p.gamesPlayed ?? 0),
    wins:          Number(p.wins ?? 0),
    currentStreak: Number(p.currentStreak ?? 0),
    isPremium:     p.isPremium ?? false,
    achievementCount: parseAchievementCount(p.achievementsJson),
    aiEasyGames:   Math.max(0, Math.floor(Number(p.aiEasyGames ?? 0))),
    aiExpertGames: Math.max(0, Math.floor(Number(p.aiExpertGames ?? 0))),
    title:         getTitle(i + 1),
    rank:          i + 1,
  }));

  const now = new Date();
  const day = now.getUTCDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday
  ));

  res.json({ players, nextReset: nextReset.toISOString() });
});

// ============================================================
// RANKING MENSUAL
// ============================================================
router.get("/monthly", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT
      gh.player_id        AS "playerId",
      ps.player_name      AS "playerName",
      ps.avatar_color     AS "avatarColor",
      ps.current_streak   AS "currentStreak",
      ps.is_premium       AS "isPremium",
      ps.achievements_json AS "achievementsJson",
      ps.ai_easy_games    AS "aiEasyGames",
      ps.ai_expert_games  AS "aiExpertGames",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.current_streak, ps.is_premium, ps.achievements_json, ps.ai_easy_games, ps.ai_expert_games
    ORDER BY SUM(gh.score) DESC
    LIMIT 100
  `);

  const players = (rows.rows as Array<Record<string, unknown>>).map((p, i) => ({
    playerId:      p.playerId,
    playerName:    p.playerName ?? "—",
    avatarColor:   p.avatarColor ?? "#e53e3e",
    totalScore:    Number(p.totalScore ?? 0),
    gamesPlayed:   Number(p.gamesPlayed ?? 0),
    wins:          Number(p.wins ?? 0),
    currentStreak: Number(p.currentStreak ?? 0),
    isPremium:     p.isPremium ?? false,
    achievementCount: parseAchievementCount(p.achievementsJson),
    aiEasyGames:   Math.max(0, Math.floor(Number(p.aiEasyGames ?? 0))),
    aiExpertGames: Math.max(0, Math.floor(Number(p.aiExpertGames ?? 0))),
    title:         getTitle(i + 1),
    rank:          i + 1,
  }));

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  res.json({ players, nextReset: nextReset.toISOString() });
});

// ============================================================
// PERFIL DE JUGADOR
// ============================================================
router.get("/profile/:playerId", async (req, res) => {
  const { playerId } = req.params;

  const scoreRows = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (scoreRows.length === 0) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const ps = scoreRows[0];

  const [rankRow, monthlyRow, modeRows, recentRows] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM player_scores WHERE total_score > ${ps.totalScore}
    `),
    db.execute(sql`
      SELECT COALESCE(SUM(score), 0) AS monthly_score
      FROM game_history
      WHERE player_id = ${playerId}
        AND created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    `),
    db.execute(sql`
      SELECT
        mode,
        COUNT(*)                                      AS games,
        COALESCE(SUM(score), 0)                       AS total_score,
        COALESCE(MAX(score), 0)                       AS best_score,
        SUM(CASE WHEN won THEN 1 ELSE 0 END)          AS wins
      FROM game_history
      WHERE player_id = ${playerId}
      GROUP BY mode
    `),
    db.execute(sql`
      SELECT id, score, letter, mode, won, created_at
      FROM game_history
      WHERE player_id = ${playerId}
      ORDER BY created_at DESC
      LIMIT 20
    `),
  ]);

  const globalRank = Number((rankRow.rows[0] as any)?.cnt ?? 0) + 1;
  const monthlyScore = Number((monthlyRow.rows[0] as any)?.monthly_score ?? 0);

  const modeStats: Record<string, any> = {};
  for (const row of modeRows.rows as any[]) {
    modeStats[row.mode] = {
      games: Number(row.games),
      totalScore: Number(row.total_score),
      bestScore: Number(row.best_score),
      wins: Number(row.wins),
    };
  }

  const recentGames = (recentRows.rows as any[]).map(r => ({
    id: r.id,
    score: Number(r.score),
    letter: r.letter,
    mode: r.mode,
    won: r.won,
    createdAt: r.created_at,
  }));

  res.json({
    playerId: ps.playerId,
    playerName: ps.playerName,
    avatarColor: ps.avatarColor,
    totalScore: ps.totalScore,
    gamesPlayed: ps.gamesPlayed,
    wins: ps.wins,
    currentStreak: ps.currentStreak ?? 0,
    longestStreak: ps.longestStreak ?? 0,
    isPremium: ps.isPremium ?? false,
    xp: ps.xp ?? 0,
    level: ps.level ?? 1,
    coins: ps.coins ?? 0,
    globalRank,
    monthlyScore,
    modeStats,
    recentGames,
  });
});

// ============================================================
// POST /scores
// ============================================================
router.post("/scores", scoreLimiter, async (req, res) => {
  const body = SubmitScoreBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { playerId, playerName, avatarColor, score: rawScore, letter, mode, won, bonus, scoreTokens } = body.data;

  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const isBonus = bonus === true;
  const maxRounds = maxRoundsForMode(mode);
  const { base: verifiedBase, verified, allExpert, easyCount, expertCount } = sumVerifiedBase(scoreTokens, maxRounds);
  const ceiling = verified > 0 ? ceilingFromBase(verifiedBase) : absoluteCeiling(mode);
  const cappedRaw = Math.max(0, Math.min(rawScore, ceiling));
  const score = mode === "multiplayer" ? Math.round(cappedRaw * 1.5) : cappedRaw;

  // Count exactly one AI game only when a complete solo submission is
  // cryptographically verified as one difficulty. Mixed/partial submissions
  // are deliberately not counted, so the client cannot manufacture stats.
  const aiEasyGame = !isBonus && mode === "solo" && verified === maxRounds && easyCount === maxRounds;
  const aiExpertGame = !isBonus && mode === "solo" && verified === maxRounds && allExpert && expertCount === maxRounds;

  const existing = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  // Difficulty counters are server-authoritative: only signed vouchers can increment them.
  const aiDifficultyStats = !isBonus && mode !== "multiplayer" && verified > 0
    ? updateAiDifficultyStats(existing[0]?.achievementStatsJson, easyCount, expertCount)
    : null;

  const oldTotal = existing.length > 0 ? existing[0].totalScore : 0;
  const newTotal = oldTotal + score;

  const today = new Date().toISOString().split("T")[0];
  const lastPlayedDate = existing[0]?.lastPlayedDate ?? null;
  const { newStreak, updatedToday } = calculateStreak(lastPlayedDate, existing[0]?.currentStreak ?? 0);
  const newLongest = Math.max(existing[0]?.longestStreak ?? 0, newStreak);

  const overtaken = score > 0 && newTotal > oldTotal
    ? await db
        .select({ playerId: playerScoresTable.playerId, playerName: playerScoresTable.playerName })
        .from(playerScoresTable)
        .where(
          sql`${playerScoresTable.totalScore} > ${oldTotal}
          AND ${playerScoresTable.totalScore} <= ${newTotal}
          AND ${playerScoresTable.playerId} != ${playerId}`
        )
    : [];

  const baseXpGain = calcXpGain(score, won ?? false, mode ?? "solo");
  const baseCoinGain = calcCoinGain(score, won ?? false, mode ?? "solo", isBonus);
  const tzOffset = await lookupPlayerTzOffset(playerId);
  const happyHourActive =
    tzOffset !== null && isHappyHourActiveForTzOffset(tzOffset);
  const xpMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const coinMultiplier = happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1;
  const xpGain = baseXpGain * xpMultiplier;
  const coinGain = baseCoinGain * coinMultiplier;
  const newXp = (existing[0]?.xp ?? 0) + xpGain;
  const newLevel = calcLevel(newXp);

  const newStreakDaysJson = (!isBonus && updatedToday)
    ? appendStreakDay(existing[0]?.streakDaysJson, today)
    : undefined;

  let player;
  if (existing.length > 0) {
    const [updated] = await db
      .update(playerScoresTable)
      .set({
        playerName,
        avatarColor: avatarColor ?? existing[0].avatarColor,
        totalScore: sql`${playerScoresTable.totalScore} + ${score}`,
        ...(isBonus ? {} : {
          gamesPlayed: sql`${playerScoresTable.gamesPlayed} + 1`,
          wins: sql`${playerScoresTable.wins} + ${won ? 1 : 0}`,
        }),
        ...(aiEasyGame ? { aiEasyGames: sql`${playerScoresTable.aiEasyGames} + 1` } : {}),
        ...(aiExpertGame ? { aiExpertGames: sql`${playerScoresTable.aiExpertGames} + 1` } : {}),
        xp: sql`${playerScoresTable.xp} + ${xpGain}`,
        level: newLevel,
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(aiDifficultyStats ? { achievementStatsJson: aiDifficultyStats } : {}),
        ...(coinGain > 0 ? { coins: sql`${playerScoresTable.coins} + ${coinGain}` } : {}),
        ...(!isBonus && updatedToday ? {
          currentStreak: newStreak,
          longestStreak: newLongest,
          lastPlayedDate: today,
          streakDaysJson: newStreakDaysJson,
        } : {}),
        updatedAt: new Date(),
      })
      .where(eq(playerScoresTable.playerId, playerId))
      .returning();
    player = updated;
  } else {
    const [created] = await db
      .insert(playerScoresTable)
      .values({
        playerId,
        playerName,
        avatarColor: avatarColor ?? "#e53e3e",
        totalScore: score,
        gamesPlayed: isBonus ? 0 : 1,
        wins: isBonus ? 0 : (won ? 1 : 0),
        aiEasyGames: aiEasyGame ? 1 : 0,
        aiExpertGames: aiExpertGame ? 1 : 0,
        currentStreak: isBonus ? 0 : 1,
        longestStreak: isBonus ? 0 : 1,
        lastPlayedDate: isBonus ? null : today,
        streakDaysJson: isBonus ? "[]" : JSON.stringify([today]),
        xp: xpGain,
        level: calcLevel(xpGain),
        coins: coinGain,
        achievementStatsJson: updateAiDifficultyStats(null, easyCount, expertCount),
      })
      .returning();
    player = created;
  }

  if (overtaken.length > 0) {
    await Promise.allSettled(
      overtaken.map(op =>
        sendPushToPlayer(op.playerId, {
          title: "¡Te han superado! 😤",
          body: `${playerName} acaba de quitarte el puesto en el ranking global. ¡Hora de vengarse!`,
          url: "/ranking",
        })
      )
    );
  }

  await db.insert(gameHistoryTable).values({
    playerId,
    score,
    letter,
    mode: mode ?? "solo",
    won: won ?? false,
  });

  res.status(201).json({
    ...player,
    rank: 0,
    rewards: {
      xpAwarded: xpGain,
      coinsAwarded: coinGain,
      happyHourActive,
      multiplier: happyHourActive ? HAPPY_HOUR_MULTIPLIER : 1,
      expertVerified: allExpert,
      aiEasyGamesAwarded: !isBonus && mode !== "multiplayer" ? easyCount : 0,
      aiExpertGamesAwarded: !isBonus && mode !== "multiplayer" ? expertCount : 0,
    },
  });
});

// ============================================================
// GET /scores/:playerId
// ============================================================
router.get("/scores/:playerId", async (req, res) => {
  const { playerId } = req.params;

  const scores = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (scores.length === 0) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const ps = scores[0];

  const [rankRow, bestRow, recentGames] = await Promise.all([
    db.execute(sql`
      SELECT COUNT(*) AS cnt FROM player_scores WHERE total_score > ${ps.totalScore}
    `),
    db.execute(sql`
      SELECT COALESCE(MAX(score), 0) AS best FROM game_history WHERE player_id = ${playerId}
    `),
    db
      .select()
      .from(gameHistoryTable)
      .where(eq(gameHistoryTable.playerId, playerId))
      .orderBy(desc(gameHistoryTable.createdAt))
      .limit(10),
  ]);

  const globalRank = Number((rankRow.rows[0] as any)?.cnt ?? 0) + 1;
  const bestScore = Number((bestRow.rows[0] as any)?.best ?? 0);

  res.json({
    score: { ...ps, rank: globalRank, globalRank, bestScore },
    recentGames,
  });
});

export default router;
