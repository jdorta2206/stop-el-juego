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

/**
 * Base coin reward per game submission (before any Happy Hour x2).
 * Coins also flow from Season Pass tier claims; this small per-game drip
 * gives every player a constant sense of wallet growth and gives Happy
 * Hour something concrete to double.
 */
function calcCoinGain(score: number, won: boolean, mode: string, isBonus: boolean): number {
  if (isBonus) return 0; // bonus submissions already double the base score; don't double-dip coins
  const base = Math.max(1, Math.floor(score / 30));   // ~1 coin per 30 pts
  const winBonus = won ? 3 : 0;
  const modeBonus = mode === "multiplayer" ? 2 : mode === "daily" ? 1 : 0;
  return base + winBonus + modeBonus;
}

/** Best-effort tz lookup — uses the player's MOST RECENT enabled push
 * subscription so a deterministic row wins and the result aligns with the
 * cron's notification-targeting filter (which also gates on enabled=true).
 *
 * Limitation acknowledged: tz_offset_minutes is client-supplied at subscribe
 * time, so a determined cheater could resubscribe with a fake offset to
 * trigger x2. The worst-case impact is they double their own progression in
 * a casual game — acceptable for v1. If abuse appears, fold in IP-geo
 * cross-check or a server-issued tz token. */
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

// ── XP / Level (mirrors useProgression.ts thresholds) ─────────────────────
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
  const base = Math.max(0, Math.floor(score / 5));         // 1 XP per 5 pts
  const winBonus = won ? 30 : 0;
  const modeBonus = mode === "multiplayer" ? 20 : mode === "daily" ? 15 : 0;
  return base + winBonus + modeBonus;
}

// Assign a display title based on global rank
export function getTitle(rank: number): string {
  if (rank === 1) return "👑 Leyenda";
  if (rank <= 3) return "🏆 Campeón";
  if (rank <= 10) return "⭐ Estrella";
  if (rank <= 25) return "🔥 Experto";
  if (rank <= 50) return "💪 Veterano";
  if (rank <= 100) return "🎯 Aspirante";
  return "🌱 Novato";
}

// Append today's date to a player's rolling 30-day streak-days JSON column
// in a deterministic, deduped, sorted manner. Centralized here so solo
// (`/ranking/scores`) and multiplayer (`rooms.ts`) persistence paths can't
// drift. Caller is responsible for gating on "first play of the day".
export function appendStreakDay(prevJson: string | null | undefined, today: string): string {
  let days: string[] = [];
  try { days = JSON.parse(prevJson ?? "[]"); } catch {}
  if (!days.includes(today)) days.push(today);
  // Keep only the most recent 30 unique dates (sorted ascending).
  days = [...new Set(days)].sort().slice(-30);
  return JSON.stringify(days);
}

export function calculateStreak(
  lastPlayedDate: string | null,
  currentStreak: number
): { newStreak: number; updatedToday: boolean } {
  const today = new Date().toISOString().split("T")[0]; // YYYY-MM-DD UTC
  if (lastPlayedDate === today) {
    // Already played today — don't change streak
    return { newStreak: currentStreak, updatedToday: false };
  }
  const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
  const newStreak = lastPlayedDate === yesterday ? currentStreak + 1 : 1;
  return { newStreak, updatedToday: true };
}

// ============================================================
// ENDPOINT: RANKING GLOBAL (all-time)
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
      title: getTitle(i + 1),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      rank: i + 1,
      // 🆕 COSMÉTICOS EQUIPADOS (para mostrar en el ranking)
      equippedAvatar: p.equipped_avatar ?? null,
      equippedFrame: p.equipped_frame ?? null,
      equippedBackground: p.equipped_background ?? null,
    })),
    total,
  });
});

// ============================================================
// ENDPOINT: RANKING SEMANAL
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
      -- 🆕 COSMÉTICOS EQUIPADOS
      ps.equipped_avatar  AS "equippedAvatar",
      ps.equipped_frame   AS "equippedFrame",
      ps.equipped_background AS "equippedBackground",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.current_streak, ps.is_premium, ps.achievements_json,
             ps.equipped_avatar, ps.equipped_frame, ps.equipped_background
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
    title:         getTitle(i + 1),
    rank:          i + 1,
    // 🆕 COSMÉTICOS EQUIPADOS
    equippedAvatar: p.equippedAvatar ?? null,
    equippedFrame: p.equippedFrame ?? null,
    equippedBackground: p.equippedBackground ?? null,
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
// ENDPOINT: RANKING MENSUAL
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
      -- 🆕 COSMÉTICOS EQUIPADOS
      ps.equipped_avatar  AS "equippedAvatar",
      ps.equipped_frame   AS "equippedFrame",
      ps.equipped_background AS "equippedBackground",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.current_streak, ps.is_premium, ps.achievements_json,
             ps.equipped_avatar, ps.equipped_frame, ps.equipped_background
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
    title:         getTitle(i + 1),
    rank:          i + 1,
    // 🆕 COSMÉTICOS EQUIPADOS
    equippedAvatar: p.equippedAvatar ?? null,
    equippedFrame: p.equippedFrame ?? null,
    equippedBackground: p.equippedBackground ?? null,
  }));

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  res.json({ players, nextReset: nextReset.toISOString() });
});

// ============================================================
// ENDPOINT: PERFIL DE JUGADOR
// ============================================================
router.get("/profile/:playerId", async (req, res) => {
  const { playerId } = req.params;

  // Base player stats
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

  // Run all queries in parallel
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
    // 🆕 COSMÉTICOS EQUIPADOS (para mostrar en el perfil público)
    equippedAvatar: ps.equippedAvatar ?? null,
    equippedFrame: ps.equippedFrame ?? null,
    equippedBackground: ps.equippedBackground ?? null,
  });
});

// Shared helper: derive achievement count from the JSON column.
function parseAchievementCount(json: unknown): number {
  try {
    const parsed = JSON.parse((json as string) ?? "[]");
    return Array.isArray(parsed) ? parsed.length : 0;
  } catch {
    return 0;
  }
}