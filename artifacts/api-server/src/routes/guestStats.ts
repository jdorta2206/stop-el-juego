import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { guestStatsTable } from "@workspace/db";
import { sql, gte, desc } from "drizzle-orm";
import { writeLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

function todayUtc(): string {
  return new Date().toISOString().split("T")[0];
}

// Atomic daily upsert: increment `games` or `conversions` for today by 1.
async function bump(column: "games" | "conversions") {
  const day = todayUtc();
  await db
    .insert(guestStatsTable)
    .values({
      day,
      games: column === "games" ? 1 : 0,
      conversions: column === "conversions" ? 1 : 0,
    })
    .onConflictDoUpdate({
      target: guestStatsTable.day,
      set:
        column === "games"
          ? { games: sql`${guestStatsTable.games} + 1` }
          : { conversions: sql`${guestStatsTable.conversions} + 1` },
    });
}

// POST /guest-stats/game — a guest finished a game.
router.post("/game", writeLimiter, async (_req, res) => {
  try {
    await bump("games");
  } catch (err) {
    // Never let analytics break the game — log and still return 204 so the
    // client fire-and-forget call never surfaces an error to the player.
    console.error("[guest-stats] failed to record game:", err);
  }
  res.status(204).end();
});

// POST /guest-stats/conversion — a guest tapped the "sign in" CTA.
router.post("/conversion", writeLimiter, async (_req, res) => {
  try {
    await bump("conversions");
  } catch (err) {
    console.error("[guest-stats] failed to record conversion:", err);
  }
  res.status(204).end();
});

// GET /guest-stats/summary — aggregate guest activity for this week + recent days.
router.get("/summary", async (_req, res) => {
  const weekRows = await db.execute(sql`
    SELECT
      COALESCE(SUM(games), 0)       AS "games",
      COALESCE(SUM(conversions), 0) AS "conversions"
    FROM guest_stats
    WHERE day >= to_char(date_trunc('week', NOW() AT TIME ZONE 'UTC'), 'YYYY-MM-DD')
  `);

  const recent = await db
    .select()
    .from(guestStatsTable)
    .orderBy(desc(guestStatsTable.day))
    .limit(14);

  const w = (weekRows.rows?.[0] ?? {}) as Record<string, unknown>;
  res.json({
    week: {
      guestGames: Number(w.games ?? 0),
      conversions: Number(w.conversions ?? 0),
    },
    recent: recent.map((r) => ({
      day: r.day,
      guestGames: r.games,
      conversions: r.conversions,
    })),
  });
});

export default router;
