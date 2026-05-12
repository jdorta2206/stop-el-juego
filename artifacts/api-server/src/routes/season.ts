import { Router, type IRouter } from "express";
import { db, seasonsTable, seasonProgressTable, playerScoresTable, indexesReady } from "@workspace/db";
import { resolveCosmetic } from "../lib/inventoryCatalog";
import { eq, and, desc, lte, gte, sql } from "drizzle-orm";
import {
  buildMissionsForDate,
  themeForStartDate,
  allTierRewards,
  tierReward,
  tierFromXp,
  TOTAL_TIERS,
  SEASON_LENGTH_DAYS,
  type Mission,
} from "../lib/seasonConfig";
import { requirePlayerIdentity, type AuthedRequest } from "../lib/playerAuth";

interface SqlResult<T> {
  rows?: T[];
}

interface ProgressRowSql {
  id: number;
  xp: number;
  missions_json: string;
  claimed_tiers: string;
}

interface PlayerPremiumRow {
  is_premium: boolean | null;
}

const router: IRouter = Router();

// Cold-start guard: the season tables are created by ensureIndexes() which
// runs asynchronously after the server starts listening. Requests that arrive
// before that finishes would 500 with "relation does not exist". Return a 503
// (with a short Retry-After) instead so clients back off cleanly.
router.use((_req, res, next) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }
  next();
});

// ── Helpers ────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + "T00:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/**
 * Returns the active season for `today`. Creates one if no season covers
 * today's date. Idempotent thanks to the date-overlap query.
 */
async function getOrCreateActiveSeason() {
  const today = todayUTC();

  const existing = await db
    .select()
    .from(seasonsTable)
    .where(and(lte(seasonsTable.startDate, today), gte(seasonsTable.endDate, today)))
    .orderBy(desc(seasonsTable.id))
    .limit(1);

  if (existing.length > 0) return existing[0];

  // Race-safe insert: a partial unique index on `start_date` (added in
  // ensureIndexes) lets concurrent first-hit/rollover requests collapse to a
  // single row via ON CONFLICT DO NOTHING; we then re-select the winner.
  const startDate = today;
  const endDate = addDays(startDate, SEASON_LENGTH_DAYS - 1);
  const theme = themeForStartDate(startDate);

  await db.execute(sql`
    INSERT INTO seasons (start_date, end_date, theme_json)
    VALUES (${startDate}, ${endDate}, ${JSON.stringify(theme)})
    ON CONFLICT (start_date) DO NOTHING
  `);

  const winner = await db
    .select()
    .from(seasonsTable)
    .where(and(lte(seasonsTable.startDate, today), gte(seasonsTable.endDate, today)))
    .orderBy(desc(seasonsTable.id))
    .limit(1);

  return winner[0];
}

type ProgressRow = typeof seasonProgressTable.$inferSelect;

type MissionsBlob = { date: string; missions: Mission[] };

function parseMissions(raw: string, dateStr: string): MissionsBlob {
  try {
    const parsed = JSON.parse(raw || "{}");
    if (parsed && parsed.date === dateStr && Array.isArray(parsed.missions)) {
      return parsed as MissionsBlob;
    }
  } catch { /* ignore */ }
  return { date: dateStr, missions: buildMissionsForDate(dateStr) };
}

function parseClaimed(raw: string): { free: number[]; premium: number[] } {
  try {
    const parsed = JSON.parse(raw || "{}");
    return {
      free: Array.isArray(parsed.free) ? parsed.free : [],
      premium: Array.isArray(parsed.premium) ? parsed.premium : [],
    };
  } catch {
    return { free: [], premium: [] };
  }
}

async function getOrCreateProgress(playerId: string, seasonId: number): Promise<ProgressRow> {
  const today = todayUTC();

  // Race-safe upsert: relies on the unique index on (player_id, season_id).
  // ON CONFLICT DO NOTHING + RETURNING gives us the new row on insert OR
  // nothing on conflict — in which case we SELECT the winning row.
  const fresh: MissionsBlob = { date: today, missions: buildMissionsForDate(today) };
  const inserted = await db
    .insert(seasonProgressTable)
    .values({
      playerId,
      seasonId,
      xp: 0,
      claimedTiers: JSON.stringify({ free: [], premium: [] }),
      missionsJson: JSON.stringify(fresh),
    })
    .onConflictDoNothing({ target: [seasonProgressTable.playerId, seasonProgressTable.seasonId] })
    .returning();

  let row: ProgressRow;
  if (inserted.length > 0) {
    row = inserted[0];
  } else {
    const existing = await db
      .select()
      .from(seasonProgressTable)
      .where(and(eq(seasonProgressTable.playerId, playerId), eq(seasonProgressTable.seasonId, seasonId)))
      .limit(1);
    row = existing[0];
  }

  // Lazily roll missions over to today.
  const currentDate = (() => {
    try { return JSON.parse(row.missionsJson || "{}")?.date; }
    catch { return undefined; }
  })();
  if (currentDate !== today) {
    const rolled: MissionsBlob = { date: today, missions: buildMissionsForDate(today) };
    await db
      .update(seasonProgressTable)
      .set({ missionsJson: JSON.stringify(rolled), updatedAt: new Date() })
      .where(eq(seasonProgressTable.id, row.id));
    row.missionsJson = JSON.stringify(rolled);
  }
  return row;
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/season/current → active season metadata + tier list (public)
router.get("/current", async (_req, res) => {
  try {
    const season = await getOrCreateActiveSeason();
    let theme: unknown = {};
    try { theme = JSON.parse(season.themeJson); } catch { /* ignore */ }
    res.json({
      id: season.id,
      startDate: season.startDate,
      endDate: season.endDate,
      theme,
      totalTiers: TOTAL_TIERS,
      tiers: allTierRewards(),
    });
  } catch (e: unknown) {
    console.error("[season/current] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to load season" });
  }
});

// GET /api/season/progress  (auth required — playerId derived from session)
router.get("/progress", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  try {
    const season = await getOrCreateActiveSeason();
    const progress = await getOrCreateProgress(playerId, season.id);
    const today = todayUTC();
    const missions = parseMissions(progress.missionsJson, today);
    const claimed = parseClaimed(progress.claimedTiers);
    const currentTier = tierFromXp(progress.xp);

    res.json({
      seasonId: season.id,
      xp: progress.xp,
      currentTier,
      totalTiers: TOTAL_TIERS,
      claimedTiers: claimed,
      missions: missions.missions,
      missionsDate: missions.date,
      hasUnclaimedMissions: missions.missions.some((m) => m.completed && !m.claimed),
    });
  } catch (e: unknown) {
    console.error("[season/progress] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to load progress" });
  }
});

// POST /api/season/event { type, value? }  (auth required)
// Increments mission progress for any matching mission. XP is granted on /claim-mission.
router.post("/event", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { type, value } = (req.body ?? {}) as { type?: string; value?: number };
  if (!type) {
    res.status(400).json({ error: "Missing type" });
    return;
  }
  const v = typeof value === "number" && value > 0 ? value : 1;

  try {
    const season = await getOrCreateActiveSeason();
    const progress = await getOrCreateProgress(playerId, season.id);
    const today = todayUTC();

    // Atomic: serialize against concurrent /event and /claim-mission for this row
    const result = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT id, missions_json FROM season_progress WHERE id = ${progress.id} FOR UPDATE
      `)) as unknown as SqlResult<Pick<ProgressRowSql, "id" | "missions_json">>;
      const row = locked.rows?.[0];
      if (!row) return null;
      const blob = parseMissions(row.missions_json, today);

      let mutated = false;
      for (const m of blob.missions) {
        if (m.type !== type || m.claimed) continue;
        if (m.type === "round_score" || m.type === "streak" || m.type === "valid_words") {
          if (v > m.progress) {
            m.progress = Math.min(v, m.target);
            mutated = true;
          }
        } else {
          m.progress = Math.min(m.progress + v, m.target);
          mutated = true;
        }
        if (m.progress >= m.target) m.completed = true;
      }
      if (mutated) {
        await tx
          .update(seasonProgressTable)
          .set({ missionsJson: JSON.stringify(blob), updatedAt: new Date() })
          .where(eq(seasonProgressTable.id, progress.id));
      }
      return blob;
    });

    if (!result) {
      res.status(404).json({ error: "Progress row not found" });
      return;
    }

    res.json({
      ok: true,
      missions: result.missions,
      hasUnclaimedMissions: result.missions.some((m) => m.completed && !m.claimed),
    });
  } catch (e: unknown) {
    console.error("[season/event] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to record event" });
  }
});

// POST /api/season/claim-mission { missionId }  (auth required)
router.post("/claim-mission", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { missionId } = (req.body ?? {}) as { missionId?: string };
  if (!missionId) {
    res.status(400).json({ error: "Missing missionId" });
    return;
  }

  try {
    const season = await getOrCreateActiveSeason();
    const progress = await getOrCreateProgress(playerId, season.id);
    const today = todayUTC();

    // Atomic claim guard: lock row, re-check claimed flag, update inside the same tx.
    const claim = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT id, xp, missions_json FROM season_progress WHERE id = ${progress.id} FOR UPDATE
      `)) as unknown as SqlResult<Pick<ProgressRowSql, "id" | "xp" | "missions_json">>;
      const row = locked.rows?.[0];
      if (!row) return { ok: false as const, error: "Progress row not found", status: 404 };

      const blob = parseMissions(row.missions_json, today);
      const m = blob.missions.find((x) => x.id === missionId);
      if (!m) return { ok: false as const, error: "Mission not found", status: 404 };
      if (!m.completed) return { ok: false as const, error: "Mission not completed", status: 400 };
      if (m.claimed) return { ok: false as const, error: "Already claimed", status: 400 };

      m.claimed = true;
      const newXp = row.xp + m.xpReward;

      await tx
        .update(seasonProgressTable)
        .set({ xp: newXp, missionsJson: JSON.stringify(blob), updatedAt: new Date() })
        .where(eq(seasonProgressTable.id, progress.id));

      return { ok: true as const, xpEarned: m.xpReward, xp: newXp, missions: blob.missions };
    });

    if (!claim) { res.status(500).json({ error: "Transaction failed" }); return; }
    if (!claim.ok) {
      res.status(claim.status ?? 400).json({ error: claim.error });
      return;
    }

    res.json({
      ok: true,
      xpEarned: claim.xpEarned,
      xp: claim.xp,
      currentTier: tierFromXp(claim.xp),
      missions: claim.missions,
    });
  } catch (e: unknown) {
    console.error("[season/claim-mission] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to claim mission" });
  }
});

// POST /api/season/claim-tier { tier, track: 'free'|'premium' }  (auth required)
// `track === 'premium'` requires player_scores.is_premium = true.
router.post("/claim-tier", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { tier, track } = (req.body ?? {}) as {
    tier?: number;
    track?: "free" | "premium";
  };

  if (typeof tier !== "number" || !track || (track !== "free" && track !== "premium")) {
    res.status(400).json({ error: "Missing or invalid fields" });
    return;
  }
  if (tier < 1 || tier > TOTAL_TIERS) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }
  const tierNum: number = tier;

  try {
    const season = await getOrCreateActiveSeason();
    const progress = await getOrCreateProgress(playerId, season.id);

    if (track === "premium") {
      const rows = (await db.execute(sql`
        SELECT is_premium FROM player_scores WHERE player_id = ${playerId} LIMIT 1
      `)) as unknown as SqlResult<PlayerPremiumRow>;
      const isPremium = rows.rows?.[0]?.is_premium === true;
      if (!isPremium) {
        res.status(403).json({ error: "Premium subscription required" });
        return;
      }
    }

    // Atomic claim guard
    const claim = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT id, xp, claimed_tiers FROM season_progress WHERE id = ${progress.id} FOR UPDATE
      `)) as unknown as SqlResult<Pick<ProgressRowSql, "id" | "xp" | "claimed_tiers">>;
      const row = locked.rows?.[0];
      if (!row) return { ok: false as const, error: "Progress row not found", status: 404 };

      const unlockedTier = tierFromXp(row.xp);
      if (tierNum > unlockedTier) {
        return { ok: false as const, error: "Tier not unlocked", status: 400 };
      }

      const claimed = parseClaimed(row.claimed_tiers);
      if (claimed[track].includes(tierNum)) {
        return { ok: false as const, error: "Already claimed", status: 400 };
      }
      claimed[track].push(tierNum);

      // 🎁 Deposit the actual reward into player_scores so Season Pass tiers
      // are no longer cosmetic-only IDs. Coins increment the balance;
      // avatars/frames are appended to the inventory (de-duplicated). All
      // happens inside the SAME transaction as the claimed_tiers write so a
      // crash mid-claim leaves no half-state.
      const reward = tierReward(tierNum)[track];
      let depositedCoins = 0;
      let depositedCosmetic: string | null = null;
      if (reward.kind === "coins" && typeof reward.value === "number") {
        await tx.execute(sql`
          UPDATE player_scores
          SET coins = coins + ${reward.value}, updated_at = NOW()
          WHERE player_id = ${playerId}
        `);
        depositedCoins = reward.value;
      } else if ((reward.kind === "avatar" || reward.kind === "frame") && typeof reward.value === "string") {
        // Read-modify-write inside the row lock taken above on
        // season_progress; player_scores is also locked here to keep
        // concurrent claims from stomping each other's inventory writes.
        const invLocked = (await tx.execute(sql`
          SELECT inventory_json FROM player_scores
          WHERE player_id = ${playerId} FOR UPDATE
        `)) as unknown as SqlResult<{ inventory_json: string }>;
        let inv: { avatars: string[]; frames: string[] } = { avatars: [], frames: [] };
        try {
          const parsed = JSON.parse(invLocked.rows?.[0]?.inventory_json || "{}");
          if (Array.isArray(parsed.avatars)) inv.avatars = parsed.avatars;
          if (Array.isArray(parsed.frames)) inv.frames = parsed.frames;
        } catch { /* keep defaults */ }
        const bucket = reward.kind === "avatar" ? inv.avatars : inv.frames;
        if (!bucket.includes(reward.value)) bucket.push(reward.value);
        await tx.update(playerScoresTable)
          .set({ inventoryJson: JSON.stringify(inv), updatedAt: new Date() })
          .where(eq(playerScoresTable.playerId, playerId));
        depositedCosmetic = reward.value;
      }

      await tx
        .update(seasonProgressTable)
        .set({ claimedTiers: JSON.stringify(claimed), updatedAt: new Date() })
        .where(eq(seasonProgressTable.id, progress.id));

      return { ok: true as const, claimed, depositedCoins, depositedCosmetic };
    });

    if (!claim) { res.status(500).json({ error: "Transaction failed" }); return; }
    if (!claim.ok) {
      res.status(claim.status ?? 400).json({ error: claim.error });
      return;
    }

    const reward = tierReward(tierNum)[track];
    const cosmeticMeta = claim.depositedCosmetic ? resolveCosmetic(claim.depositedCosmetic) : null;
    res.json({
      ok: true,
      reward,
      deposited: {
        coins: claim.depositedCoins,
        cosmetic: cosmeticMeta,
      },
      claimedTiers: claim.claimed,
    });
  } catch (e: unknown) {
    console.error("[season/claim-tier] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to claim tier" });
  }
});

export default router;
