import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, desc, sql } from "drizzle-orm";
import { SubmitScoreBody, GetLeaderboardQueryParams } from "@workspace/api-zod";

const router: IRouter = Router();

router.get("/scores", async (req, res) => {
  const query = GetLeaderboardQueryParams.safeParse(req.query);
  const limit = query.success ? (query.data.limit ?? 20) : 20;

  // Deduplicate by player_name: keep each player's highest-score row only
  const rows = await db.execute(sql`
    SELECT * FROM (
      SELECT DISTINCT ON (player_name) *
      FROM player_scores
      ORDER BY player_name, total_score DESC
    ) AS deduped
    ORDER BY total_score DESC
    LIMIT ${limit}
  `);

  const players = rows.rows as Array<Record<string, unknown>>;

  const totalRows = await db.execute(sql`
    SELECT COUNT(DISTINCT player_name) AS count FROM player_scores
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

  let player;
  if (existing.length > 0) {
    const [updated] = await db
      .update(playerScoresTable)
      .set({
        playerName,
        avatarColor: avatarColor ?? existing[0].avatarColor,
        totalScore: existing[0].totalScore + score,
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
