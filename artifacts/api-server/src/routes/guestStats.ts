import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { guestStatsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
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

export default router;
