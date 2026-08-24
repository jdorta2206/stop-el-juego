import { Router, type IRouter } from "express";
import { db, playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

// GET /api/ranking/streak/calendar/:playerId
// The streak calendar is derived exclusively from player_scores.streak_days_json.
// Returning an empty calendar for an unknown player keeps the display hook
// graceful while preserving the server as the source of truth for real users.
router.get("/streak/calendar/:playerId", async (req, res) => {
  const playerId = String(req.params.playerId ?? "").trim();
  if (!playerId) {
    res.status(400).json({ error: "Missing playerId" });
    return;
  }

  if (!verifyClaimedIdentity(req, playerId)) {
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

  const row = rows[0];
  if (!row) {
    res.json({ currentStreak: 0, longestStreak: 0, lastPlayedDate: null, days: [] });
    return;
  }

  let playedDates: string[] = [];
  try {
    const parsed = JSON.parse(row.streakDaysJson ?? "[]");
    if (Array.isArray(parsed)) {
      playedDates = parsed.filter((d): d is string => typeof d === "string");
    }
  } catch {
    playedDates = [];
  }

  const today = new Date().toISOString().split("T")[0];
  const days = playedDates.map((date) => ({
    date,
    played: true,
    isToday: date === today,
  }));

  res.json({
    currentStreak: row.currentStreak ?? 0,
    longestStreak: row.longestStreak ?? 0,
    lastPlayedDate: row.lastPlayedDate ?? null,
    days,
  });
});

export default router;
