import { Router, type IRouter } from "express";
import { db } from "@workspace/db";
import { playerScoresTable, gameHistoryTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

type JsonRecord = Record<string, unknown>;
const MAX_PERSONAL_BESTS = 20;
const MAX_KEY_LENGTH = 80;

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  try {
    return JSON.parse(value ?? "") as T;
  } catch {
    return fallback;
  }
}

// Authoritative player progress used by streak, collection, achievements and
// personal-best UIs. Gameplay-derived values are never accepted from the
// client as achievements/stats; only a local personal-best can be synced when
// the server already has an equal-or-higher score for that mode.
router.get("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!await verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const rows = await db
    .select()
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);

  if (!rows.length) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const player = rows[0];
  res.json({
    achievements: parseJson<string[]>(player.achievementsJson, []),
    stats: parseJson<JsonRecord>(player.achievementStatsJson, {}),
    personalBests: parseJson<JsonRecord>(player.personalBestsJson, {}),
    collectedWords: parseJson<JsonRecord>(player.collectedWordsJson, {}),
    currentStreak: player.currentStreak ?? 0,
    longestStreak: player.longestStreak ?? 0,
    lastPlayedDate: player.lastPlayedDate ?? null,
  });
});

router.get("/streak/calendar/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!await verifyClaimedIdentity(req, playerId)) {
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

  if (!rows.length) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const player = rows[0];
  const storedDays = parseJson<string[]>(player.streakDaysJson, []);
  const days = [...new Set(storedDays)].sort().slice(-30);
  const requestedTimezone = typeof req.headers["x-stop-timezone"] === "string" ? req.headers["x-stop-timezone"] : "";
  const storedTimezone = await (async () => {
    try {
      const rows = await db.execute(sql`SELECT time_zone FROM push_subscriptions WHERE player_id = ${playerId} AND enabled = TRUE AND time_zone IS NOT NULL ORDER BY id DESC LIMIT 1`);
      return String((rows.rows?.[0] as any)?.time_zone ?? "UTC");
    } catch { return "UTC"; }
  })();
  let playerTimezone = requestedTimezone || storedTimezone;
  try { new Intl.DateTimeFormat("en-CA", { timeZone: playerTimezone }).format(new Date()); } catch { playerTimezone = storedTimezone; }
  const today = new Intl.DateTimeFormat("en-CA", { timeZone: playerTimezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date());

  res.json({
    currentStreak: player.currentStreak ?? 0,
    longestStreak: player.longestStreak ?? 0,
    lastPlayedDate: player.lastPlayedDate ?? null,
    days: days.map(date => ({ date, played: true, isToday: date === today })),
  });
});

// Client progress is not authoritative. Achievements and achievement stats
// are derived from server gameplay and are therefore ignored here. A client
// may only synchronize a personal-best value when that value is already
// backed by game_history for the same player and mode.
router.post("/progress/:playerId", async (req, res) => {
  const { playerId } = req.params;
  if (!await verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const body = (req.body ?? {}) as JsonRecord;
  const personalBests = body.personalBests;
  const incomingBests = personalBests && typeof personalBests === "object" && !Array.isArray(personalBests)
    ? personalBests as JsonRecord
    : null;
  const modes = incomingBests
    ? Object.keys(incomingBests).filter(mode => mode.length <= MAX_KEY_LENGTH).slice(0, MAX_PERSONAL_BESTS)
    : [];

  const playerRows = await db
    .select({ playerId: playerScoresTable.playerId })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);
  if (!playerRows.length) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  // Collection entries are append-only discoveries. Validate every field and
  // derive the key on the server; never trust arbitrary client object keys.
  const rawCollection = body.collectedWords;
  const incomingCollection = rawCollection && typeof rawCollection === "object" && !Array.isArray(rawCollection)
    ? rawCollection as JsonRecord
    : null;
  const normalizedCollection: JsonRecord = {};
  if (incomingCollection) {
    for (const value of Object.values(incomingCollection).slice(0, 5000)) {
      if (!value || typeof value !== "object" || Array.isArray(value)) continue;
      const entry = value as JsonRecord;
      if (typeof entry.name !== "string" || typeof entry.cat !== "string" ||
          typeof entry.r !== "string" || typeof entry.d !== "number" ||
          !Number.isFinite(entry.d)) continue;
      const name = entry.name.trim().slice(0, MAX_KEY_LENGTH);
      const category = entry.cat.trim().slice(0, MAX_KEY_LENGTH);
      const rarity = entry.r;
      if (!name || !category || !["common", "rare", "epic", "legendary"].includes(rarity)) continue;
      const key = name.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
      if (!key || key.length > MAX_KEY_LENGTH || normalizedCollection[key]) continue;
      normalizedCollection[key] = {
        name,
        cat: category,
        r: rarity,
        d: Math.max(0, Math.min(Math.floor(entry.d), Date.now())),
      };
    }
  }

  // Ignore client-supplied achievements/stats entirely. Only personal bests
  // backed by game_history and validated append-only collection discoveries
  // may be synchronized.
  if (modes.length === 0 && !incomingCollection) {
    res.json({ ok: true });
    return;
  }

  const authoritativeMax = new Map<string, number>();
  if (modes.length > 0) {
    const historyRows = await db
      .select({
        mode: gameHistoryTable.mode,
        maxScore: sql<number>`MAX(${gameHistoryTable.score})`,
      })
      .from(gameHistoryTable)
      .where(eq(gameHistoryTable.playerId, playerId))
      .groupBy(gameHistoryTable.mode);
    for (const row of historyRows) authoritativeMax.set(String(row.mode), Number(row.maxScore ?? 0));
  }

  // Lock the row while merging both JSON documents so concurrent devices
  // cannot overwrite one another's legitimate discoveries or personal bests.
  await db.transaction(async (tx) => {
    const locked = await tx.execute(sql`
      SELECT personal_bests_json, collected_words_json
      FROM player_scores
      WHERE player_id = ${playerId}
      FOR UPDATE
    `);
    const lockedRow = (locked.rows as Array<{
      personal_bests_json: string | null;
      collected_words_json: string | null;
    }>)[0];
    if (!lockedRow) throw new Error("Player not found");

    const currentBests = parseJson<JsonRecord>(lockedRow.personal_bests_json, {});
    const mergedBests: JsonRecord = { ...currentBests };
    for (const mode of modes) {
      const score = incomingBests?.[mode];
      if (typeof score !== "number" || !Number.isFinite(score)) continue;
      const safeScore = Math.max(0, Math.min(Math.floor(score), 100_000));
      const serverMax = authoritativeMax.get(mode);
      if (serverMax === undefined || safeScore > serverMax) continue;
      mergedBests[mode] = Math.max(Number(currentBests[mode] ?? 0), safeScore);
    }

    const currentCollection = parseJson<JsonRecord>(lockedRow.collected_words_json, {});
    const mergedCollection: JsonRecord = { ...currentCollection };
    for (const [key, value] of Object.entries(normalizedCollection)) {
      if (!mergedCollection[key]) mergedCollection[key] = value;
    }

    const update: { personalBestsJson?: string; collectedWordsJson?: string } = {};
    if (JSON.stringify(mergedBests) !== JSON.stringify(currentBests)) {
      update.personalBestsJson = JSON.stringify(mergedBests);
    }
    if (JSON.stringify(mergedCollection) !== JSON.stringify(currentCollection)) {
      update.collectedWordsJson = JSON.stringify(mergedCollection);
    }
    if (Object.keys(update).length > 0) {
      await tx.update(playerScoresTable)
        .set(update)
        .where(eq(playerScoresTable.playerId, playerId));
    }
  });

  res.json({ ok: true });
});

export default router;
