import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { sendPushToPlayer } from "../lib/pushHelper";
import { SubmitScoreBody, GetLeaderboardQueryParams } from "@workspace/api-zod";

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

// Calculate the new streak for a player given their last played date
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
      title: getTitle(i + 1),
      createdAt: p.created_at,
      updatedAt: p.updated_at,
      rank: i + 1,
    })),
    total,
  });
});

router.post("/scores", async (req, res) => {
  const body = SubmitScoreBody.safeParse(req.body);
  if (!body.success) {
    res.status(400).json({ error: "Invalid request body" });
    return;
  }

  const { playerId, playerName, avatarColor, score: rawScore, letter, mode, won } = body.data;

  // Apply 1.5x multiplier for multiplayer games
  const score = mode === "multiplayer" ? Math.round(rawScore * 1.5) : rawScore;

  const existing = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  const oldTotal = existing.length > 0 ? existing[0].totalScore : 0;
  const newTotal = oldTotal + score;

  // Streak calculation
  const today = new Date().toISOString().split("T")[0];
  const lastPlayedDate = existing[0]?.lastPlayedDate ?? null;
  const { newStreak, updatedToday } = calculateStreak(lastPlayedDate, existing[0]?.currentStreak ?? 0);
  const newLongest = Math.max(existing[0]?.longestStreak ?? 0, newStreak);

  // Detect overtaken players BEFORE updating
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

  // XP / Level
  const xpGain = calcXpGain(score, won ?? false, mode ?? "solo");
  const newXp = (existing[0]?.xp ?? 0) + xpGain;
  const newLevel = calcLevel(newXp);

  let player;
  if (existing.length > 0) {
    const [updated] = await db
      .update(playerScoresTable)
      .set({
        playerName,
        avatarColor: avatarColor ?? existing[0].avatarColor,
        totalScore: newTotal,
        gamesPlayed: existing[0].gamesPlayed + 1,
        wins: existing[0].wins + (won ? 1 : 0),
        xp: newXp,
        level: newLevel,
        ...(updatedToday ? {
          currentStreak: newStreak,
          longestStreak: newLongest,
          lastPlayedDate: today,
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
        gamesPlayed: 1,
        wins: won ? 1 : 0,
        currentStreak: 1,
        longestStreak: 1,
        lastPlayedDate: today,
        xp: xpGain,
        level: calcLevel(xpGain),
      })
      .returning();
    player = created;
  }

  // Send "you've been overtaken" push notifications
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

  // Record game history
  await db.insert(gameHistoryTable).values({
    playerId,
    score,
    letter,
    mode: mode ?? "solo",
    won: won ?? false,
  });

  res.status(201).json({ ...player, rank: 0 });
});

router.get("/weekly", async (req, res) => {
  const rows = await db.execute(sql`
    SELECT
      gh.player_id        AS "playerId",
      ps.player_name      AS "playerName",
      ps.avatar_color     AS "avatarColor",
      ps.current_streak   AS "currentStreak",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.current_streak
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

router.get("/monthly", async (_req, res) => {
  const rows = await db.execute(sql`
    SELECT
      gh.player_id        AS "playerId",
      ps.player_name      AS "playerName",
      ps.avatar_color     AS "avatarColor",
      ps.current_streak   AS "currentStreak",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('month', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color, ps.current_streak
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
    title:         getTitle(i + 1),
    rank:          i + 1,
  }));

  const now = new Date();
  const nextReset = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));

  res.json({ players, nextReset: nextReset.toISOString() });
});

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

  const recentGames = await db
    .select()
    .from(gameHistoryTable)
    .where(eq(gameHistoryTable.playerId, playerId))
    .orderBy(desc(gameHistoryTable.createdAt))
    .limit(10);

  res.json({ score: { ...scores[0], rank: 0 }, recentGames });
});

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
    lastPlayedDate: ps.lastPlayedDate ?? null,
    xp: ps.xp ?? 0,
    level: ps.level ?? 1,
    globalRank,
    monthlyScore,
    title: getTitle(globalRank),
    modeStats,
    recentGames,
  });
});

// ── GET /ranking/progress/:playerId — achievements + personal bests ────────
router.get("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const [ps] = await db
    .select({
      achievementsJson: playerScoresTable.achievementsJson,
      achievementStatsJson: playerScoresTable.achievementStatsJson,
      personalBestsJson: playerScoresTable.personalBestsJson,
    })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!ps) {
    res.json({ achievements: [], stats: {}, personalBests: {} });
    return;
  }
  let achievements: string[] = [];
  let stats: Record<string, unknown> = {};
  let personalBests: Record<string, number> = {};
  try { achievements = JSON.parse(ps.achievementsJson ?? "[]"); } catch {}
  try { stats = JSON.parse(ps.achievementStatsJson ?? "{}"); } catch {}
  try { personalBests = JSON.parse(ps.personalBestsJson ?? "{}"); } catch {}
  res.json({ achievements, stats, personalBests });
});

// ── POST /ranking/progress/:playerId — save achievements + stats + personal bests ──
router.post("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  const { achievements, stats, personalBests } = req.body as {
    achievements?: string[];
    stats?: Record<string, unknown>;
    personalBests?: Record<string, number>;
  };

  const [existing] = await db
    .select({
      achievementsJson: playerScoresTable.achievementsJson,
      achievementStatsJson: playerScoresTable.achievementStatsJson,
      personalBestsJson: playerScoresTable.personalBestsJson,
    })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!existing) { res.json({ ok: false, reason: "player_not_found" }); return; }

  // Merge achievements: never remove
  let curAch: string[] = [];
  let curStats: Record<string, unknown> = {};
  let curBests: Record<string, number> = {};
  try { curAch = JSON.parse(existing.achievementsJson ?? "[]"); } catch {}
  try { curStats = JSON.parse(existing.achievementStatsJson ?? "{}"); } catch {}
  try { curBests = JSON.parse(existing.personalBestsJson ?? "{}"); } catch {}

  const mergedAch = [...new Set([...curAch, ...(achievements ?? [])])];

  // Merge stats: take the higher numeric value, OR for booleans
  const mergedStats = { ...curStats };
  for (const [k, v] of Object.entries(stats ?? {})) {
    const cur = mergedStats[k];
    if (typeof v === "boolean") mergedStats[k] = Boolean(cur) || v;
    else if (typeof v === "number") mergedStats[k] = Math.max(Number(cur ?? 0), v);
  }

  // Merge personal bests: take max score per mode
  const mergedBests = { ...curBests };
  for (const [mode, score] of Object.entries(personalBests ?? {})) {
    if ((mergedBests[mode] ?? 0) < score) mergedBests[mode] = score;
  }

  await db
    .update(playerScoresTable)
    .set({
      achievementsJson: JSON.stringify(mergedAch),
      achievementStatsJson: JSON.stringify(mergedStats),
      personalBestsJson: JSON.stringify(mergedBests),
      updatedAt: new Date(),
    })
    .where(eq(playerScoresTable.playerId, playerId));

  res.json({ ok: true, achievements: mergedAch, stats: mergedStats, personalBests: mergedBests });
});

export default router;
