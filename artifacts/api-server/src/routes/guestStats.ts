import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { guestStatsTable, guestStatsEventsTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { writeLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();
const EVENT_ID_PATTERN = /^[A-Za-z0-9._:-]{8,160}$/;

function playerTimeZone(req: { headers: Record<string, unknown> }): string {
  const raw = req.headers["x-stop-timezone"];
  const timeZone = typeof raw === "string" && raw.trim() ? raw.trim() : "UTC";
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return timeZone;
  } catch {
    return "UTC";
  }
}

function todayForPlayer(req: { headers: Record<string, unknown> }): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: playerTimeZone(req),
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function readEventId(body: unknown): string | undefined | null {
  if (!body || typeof body !== "object" || !("eventId" in body)) return undefined;
  const value = (body as { eventId?: unknown }).eventId;
  return typeof value === "string" && EVENT_ID_PATTERN.test(value) ? value : null;
}

// Older app versions omit eventId and retain the legacy aggregate behavior.
// Current clients provide it, allowing PostgreSQL to count each logical event once.
async function bump(
  req: { headers: Record<string, unknown> },
  column: "games" | "conversions",
  eventId?: string,
) {
  const day = todayForPlayer(req);
  const values = {
    day,
    games: column === "games" ? 1 : 0,
    conversions: column === "conversions" ? 1 : 0,
  };
  const upsert = (executor: any) => executor
    .insert(guestStatsTable)
    .values(values)
    .onConflictDoUpdate({
      target: guestStatsTable.day,
      set: column === "games"
        ? { games: sql`${guestStatsTable.games} + 1` }
        : { conversions: sql`${guestStatsTable.conversions} + 1` },
    });

  if (!eventId) {
    await upsert(db);
    return;
  }

  await db.transaction(async (tx) => {
    const [claimed] = await tx
      .insert(guestStatsEventsTable)
      .values({ eventId, day, kind: column })
      .onConflictDoNothing()
      .returning({ eventId: guestStatsEventsTable.eventId });
    if (!claimed) return;

    await upsert(tx);

    // Keep the deduplication ledger bounded; seven days exceeds normal retry windows.
    await tx.delete(guestStatsEventsTable)
      .where(sql`${guestStatsEventsTable.createdAt} < NOW() - INTERVAL '7 days'`);
  });
}

// POST /guest-stats/game — a guest finished a game.
router.post("/game", writeLimiter, async (req, res) => {
  const eventId = readEventId(req.body);
  if (eventId === null) {
    res.status(400).json({ error: "INVALID_EVENT_ID" });
    return;
  }
  try {
    await bump(req, "games", eventId);
  } catch (err) {
    console.error("[guest-stats] failed to record game:", err);
  }
  res.status(204).end();
});

// POST /guest-stats/conversion — a guest tapped the "sign in" CTA.
router.post("/conversion", writeLimiter, async (req, res) => {
  const eventId = readEventId(req.body);
  if (eventId === null) {
    res.status(400).json({ error: "INVALID_EVENT_ID" });
    return;
  }
  try {
    await bump(req, "conversions", eventId);
  } catch (err) {
    console.error("[guest-stats] failed to record conversion:", err);
  }
  res.status(204).end();
});

export default router;
