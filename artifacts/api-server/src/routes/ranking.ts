import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { sendPushToPlayer } from "../lib/pushHelper";
import { SubmitScoreBody, GetLeaderboardQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/scores", async (req, res) => {
  const query = GetLeaderboardQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;

  // Each player_id already has exactly one row (scores are updated in place),
  // so no deduplication needed — just order by score descending.
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

  const { playerId, playerName, avatarColor, score, letter, mode, won } = body.data;

  // Upsert player score
  const existing = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  const oldTotal = existing.length > 0 ? existing[0].totalScore : 0;
  const newTotal = oldTotal + score;

  // ── Detect overtaken players BEFORE updating ─────────────────────────────
  // Anyone whose total is strictly between old and new total got overtaken.
  // (Skip the player themselves in case they have multiple rows — shouldn't happen.)
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
  // ─────────────────────────────────────────────────────────────────────────

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
      })
      .returning();
    player = created;
  }

  // ── Send "you've been overtaken" push notifications ──────────────────────
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
  // ─────────────────────────────────────────────────────────────────────────

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
  // Aggregate game_history for the current ISO week (Mon 00:00 UTC → Sun 23:59 UTC)
  // JOIN with player_scores to get player name + avatar
  const rows = await db.execute(sql`
    SELECT
      gh.player_id        AS "playerId",
      ps.player_name      AS "playerName",
      ps.avatar_color     AS "avatarColor",
      SUM(gh.score)       AS "totalScore",
      COUNT(*)            AS "gamesPlayed",
      SUM(CASE WHEN gh.won THEN 1 ELSE 0 END) AS "wins"
    FROM game_history gh
    LEFT JOIN player_scores ps ON gh.player_id = ps.player_id
    WHERE gh.created_at >= date_trunc('week', NOW() AT TIME ZONE 'UTC')
    GROUP BY gh.player_id, ps.player_name, ps.avatar_color
    ORDER BY SUM(gh.score) DESC
    LIMIT 100
  `);

  const players = (rows.rows as Array<Record<string, unknown>>).map((p, i) => ({
    playerId:    p.playerId,
    playerName:  p.playerName ?? "—",
    avatarColor: p.avatarColor ?? "#e53e3e",
    totalScore:  Number(p.totalScore ?? 0),
    gamesPlayed: Number(p.gamesPlayed ?? 0),
    wins:        Number(p.wins ?? 0),
    rank:        i + 1,
  }));

  // Next Monday at 00:00 UTC
  const now = new Date();
  const day = now.getUTCDay(); // 0=Sun … 6=Sat
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  const nextReset = new Date(Date.UTC(
    now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + daysUntilMonday
  ));

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

export default router;
