import { Router, type IRouter } from "express";
import { db, pool, seasonsTable, seasonProgressTable, playerScoresTable, indexesReady } from "@workspace/db";
import { resolveCosmetic, championFrameId } from "../lib/inventoryCatalog";
import { eq, and, desc, lte, gte, sql } from "drizzle-orm";
import {
  buildMissionsForDate,
  themeForStartDate,
  allTierRewards,
  tierReward,
  tierFromXp,
  TOTAL_TIERS,
  SEASON_LENGTH_DAYS,
  PREMIUM_MISSION_MULTIPLIER,
  LEGEND_FRAME_ID,
  type Mission,
} from "../lib/seasonConfig";
import { requirePlayerIdentity, readPlayerId, type AuthedRequest } from "../lib/playerAuth";
import { isUserPremium } from "../lib/premiumStatus";
import { stripeStorage } from "../stripeStorage";

interface SqlResult<T> {
  rows?: T[];
}

interface ProgressRowSql {
  id: number;
  xp: number;
  missions_json: string;
  claimed_tiers: string;
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
/**
 * Freezes the previous season's standings into `season_finals` and awards
 * champion frames to the top 3. Idempotent — relies on the unique
 * (season_id, player_id) index so re-runs are a no-op. Called whenever a
 * brand-new active season is opened (lazy create OR cron rollover).
 */
export async function finalizePreviousSeason(currentSeasonId: number, today: string): Promise<void> {
  try {
    // Find the most recent season that ended strictly before today AND is
    // not the freshly-opened one. We process at most one prior season per
    // call; older un-finalized seasons would be picked up the next time
    // rollover happens.
    const prevRows = (await db.execute(sql`
      SELECT id FROM seasons
      WHERE end_date < ${today} AND id <> ${currentSeasonId}
      ORDER BY id DESC LIMIT 1
    `)) as unknown as SqlResult<{ id: number }>;
    const prevId = prevRows.rows?.[0]?.id;
    if (!prevId) return;

    const standings = (await db.execute(sql`
      SELECT player_id, xp,
             ROW_NUMBER() OVER (ORDER BY xp DESC, id ASC) AS rank,
             COUNT(*) OVER () AS total
      FROM season_progress
      WHERE season_id = ${prevId}
    `)) as unknown as SqlResult<{ player_id: string; xp: number; rank: number | string; total: number | string }>;

    const rows = standings.rows ?? [];
    if (rows.length === 0) return;

    // We deliberately do NOT short-circuit if some finals rows already
    // exist — a previous run may have failed mid-loop. Each per-player
    // step is fully idempotent: the finals INSERT relies on the unique
    // (season_id, player_id) index, and the inventory UPDATE happens
    // inside a transaction with FOR UPDATE so concurrent writers (tier
    // claims, shop purchases) cannot clobber the JSON blob.
    let processed = 0;
    for (const r of rows) {
      const rank = Number(r.rank);
      const total = Number(r.total);
      const cosmetic = rank <= 3 ? championFrameId(prevId, rank as 1 | 2 | 3) : null;

      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        await client.query(
          `INSERT INTO season_finals
             (season_id, player_id, final_rank, final_xp, total_players, awarded_cosmetic)
           VALUES ($1, $2, $3, $4, $5, $6)
           ON CONFLICT (season_id, player_id) DO NOTHING`,
          [prevId, r.player_id, rank, r.xp, total, cosmetic],
        );

        if (cosmetic) {
          // Lock the player_scores row so concurrent inventory writers
          // serialize behind us.
          const invRes = await client.query<{ inventory_json: string }>(
            `SELECT inventory_json FROM player_scores
             WHERE player_id = $1 FOR UPDATE`,
            [r.player_id],
          );
          if (invRes.rows.length > 0) {
            const raw = invRes.rows[0].inventory_json;
            const inv: { avatars: string[]; frames: string[] } = { avatars: [], frames: [] };
            try {
              const parsed = JSON.parse(raw || "{}");
              if (Array.isArray(parsed.avatars)) inv.avatars = parsed.avatars;
              if (Array.isArray(parsed.frames)) inv.frames = parsed.frames;
            } catch { /* keep defaults */ }
            if (!inv.frames.includes(cosmetic)) {
              inv.frames.push(cosmetic);
              await client.query(
                `UPDATE player_scores
                 SET inventory_json = $1, updated_at = NOW()
                 WHERE player_id = $2`,
                [JSON.stringify(inv), r.player_id],
              );
            }
          }
        }

        await client.query("COMMIT");
        processed++;
      } catch (txErr) {
        await client.query("ROLLBACK").catch(() => {});
        // Log per-player failures but keep going — finalize is resumable.
        console.error(
          `[finalizePreviousSeason] player ${r.player_id} failed:`,
          txErr instanceof Error ? txErr.message : String(txErr),
        );
      } finally {
        client.release();
      }
    }
    console.log(`[finalizePreviousSeason] Finalized season ${prevId} (${processed}/${rows.length} players)`);
  } catch (e: unknown) {
    console.error("[finalizePreviousSeason] error:", e instanceof Error ? e.message : String(e));
  }
}

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

  // We just created (or won the race for) a brand-new season. Take the
  // chance to freeze finals for the previous one. Fire-and-forget: errors
  // are logged inside and never block the active-season fetch.
  void finalizePreviousSeason(winner[0].id, today);

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
      // Surface entitlements so the client never hardcodes them.
      premiumMissionMultiplier: PREMIUM_MISSION_MULTIPLIER,
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

    // ── End-of-season recap: surface the most recent finalized season the
    // player participated in, but only if we haven't already shown them
    // the recap modal. Frontend acks via POST /api/season/ack-final.
    let pendingFinal: {
      seasonId: number;
      finalRank: number;
      finalXp: number;
      totalPlayers: number;
      awardedCosmetic: ReturnType<typeof resolveCosmetic> | null;
      seasonName: string | null;
    } | null = null;

    // Legacy backfill: players who claimed Tier 30 premium BEFORE the reward
    // was upgraded from coins to `frame_legend_t30` should still get the
    // frame. One-shot, idempotent — checks claimed_tiers + inventory and
    // grants the frame if missing. No-op once the player owns it.
    if (claimed.premium.includes(TOTAL_TIERS)) {
      try {
        await pool.query(
          `UPDATE player_scores
           SET inventory_json = jsonb_set(
                 COALESCE(inventory_json::jsonb, '{"avatars":[],"frames":[]}'::jsonb),
                 '{frames}',
                 (
                   COALESCE(inventory_json::jsonb->'frames', '[]'::jsonb)
                   || to_jsonb($2::text)
                 )
               )::text,
               updated_at = NOW()
           WHERE player_id = $1
             AND NOT (
               COALESCE(inventory_json::jsonb->'frames', '[]'::jsonb)
               @> to_jsonb($2::text)
             )`,
          [playerId, LEGEND_FRAME_ID],
        );
      } catch (backfillErr) {
        // Backfill is best-effort; never block /progress on it.
        console.error(
          "[season/progress] legend backfill failed:",
          backfillErr instanceof Error ? backfillErr.message : String(backfillErr),
        );
      }
    }

    const finalRows = (await db.execute(sql`
      SELECT sf.season_id, sf.final_rank, sf.final_xp, sf.total_players, sf.awarded_cosmetic,
             s.theme_json, ps.notified_final_season_id
      FROM season_finals sf
      JOIN seasons s         ON s.id = sf.season_id
      JOIN player_scores ps  ON ps.player_id = sf.player_id
      WHERE sf.player_id = ${playerId}
        AND sf.season_id <> ${season.id}
      ORDER BY sf.season_id DESC LIMIT 1
    `)) as unknown as SqlResult<{
      season_id: number;
      final_rank: number;
      final_xp: number;
      total_players: number;
      awarded_cosmetic: string | null;
      theme_json: string;
      notified_final_season_id: number | null;
    }>;
    const fr = finalRows.rows?.[0];
    if (fr && fr.notified_final_season_id !== fr.season_id) {
      let seasonName: string | null = null;
      try { seasonName = JSON.parse(fr.theme_json || "{}")?.name ?? null; } catch { /* ignore */ }
      pendingFinal = {
        seasonId: fr.season_id,
        finalRank: Number(fr.final_rank),
        finalXp: Number(fr.final_xp),
        totalPlayers: Number(fr.total_players),
        awardedCosmetic: fr.awarded_cosmetic ? resolveCosmetic(fr.awarded_cosmetic) : null,
        seasonName,
      };
    }

    res.json({
      seasonId: season.id,
      xp: progress.xp,
      currentTier,
      totalTiers: TOTAL_TIERS,
      claimedTiers: claimed,
      missions: missions.missions,
      missionsDate: missions.date,
      hasUnclaimedMissions: missions.missions.some((m) => m.completed && !m.claimed),
      pendingFinal,
    });
  } catch (e: unknown) {
    console.error("[season/progress] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to load progress" });
  }
});

// GET /api/season/leaderboard?seasonId=  (public — defaults to active season)
// Returns top 50 by XP plus the viewer's row (if authenticated and ranked).
router.get("/leaderboard", async (req: AuthedRequest, res) => {
  // Optional auth: derive viewer id if a session is present, but never 401.
  req.playerId = readPlayerId(req) ?? undefined;
  try {
    let seasonId: number;
    const requested = Number(req.query.seasonId);
    if (Number.isFinite(requested) && requested > 0) {
      seasonId = requested;
    } else {
      const season = await getOrCreateActiveSeason();
      seasonId = season.id;
    }

    const topRows = (await db.execute(sql`
      SELECT sp.player_id, sp.xp,
             ps.player_name, ps.avatar_color, ps.is_premium,
             ps.equipped_avatar, ps.equipped_frame
      FROM season_progress sp
      LEFT JOIN player_scores ps ON ps.player_id = sp.player_id
      WHERE sp.season_id = ${seasonId}
      ORDER BY sp.xp DESC, sp.id ASC
      LIMIT 50
    `)) as unknown as SqlResult<{
      player_id: string; xp: number;
      player_name: string | null; avatar_color: string | null; is_premium: boolean | null;
      equipped_avatar: string | null; equipped_frame: string | null;
    }>;

    const totalRows = (await db.execute(sql`
      SELECT COUNT(*)::int AS total FROM season_progress WHERE season_id = ${seasonId}
    `)) as unknown as SqlResult<{ total: number }>;
    const total = Number(totalRows.rows?.[0]?.total ?? 0);

    const top = (topRows.rows ?? []).map((r, i) => ({
      rank: i + 1,
      playerId: r.player_id,
      playerName: r.player_name ?? "Anónimo",
      avatarColor: r.avatar_color ?? "#e53e3e",
      isPremium: r.is_premium === true,
      equippedAvatar: r.equipped_avatar,
      equippedFrame: r.equipped_frame,
      xp: Number(r.xp),
    }));

    // Derive viewer row (only if authenticated AND has a season_progress row).
    let me: (typeof top)[number] & { inTop: boolean } | null = null;
    const viewerId = req.playerId; // optional; requirePlayerIdentity not used here
    if (viewerId) {
      const rankRow = (await db.execute(sql`
        WITH ranked AS (
          SELECT sp.player_id, sp.xp,
                 ROW_NUMBER() OVER (ORDER BY sp.xp DESC, sp.id ASC) AS rank
          FROM season_progress sp
          WHERE sp.season_id = ${seasonId}
        )
        SELECT r.player_id, r.xp, r.rank,
               ps.player_name, ps.avatar_color, ps.is_premium,
               ps.equipped_avatar, ps.equipped_frame
        FROM ranked r
        LEFT JOIN player_scores ps ON ps.player_id = r.player_id
        WHERE r.player_id = ${viewerId}
        LIMIT 1
      `)) as unknown as SqlResult<{
        player_id: string; xp: number; rank: number | string;
        player_name: string | null; avatar_color: string | null; is_premium: boolean | null;
        equipped_avatar: string | null; equipped_frame: string | null;
      }>;
      const mr = rankRow.rows?.[0];
      if (mr) {
        const rankNum = Number(mr.rank);
        me = {
          rank: rankNum,
          playerId: mr.player_id,
          playerName: mr.player_name ?? "Anónimo",
          avatarColor: mr.avatar_color ?? "#e53e3e",
          isPremium: mr.is_premium === true,
          equippedAvatar: mr.equipped_avatar,
          equippedFrame: mr.equipped_frame,
          xp: Number(mr.xp),
          inTop: rankNum <= 50,
        };
      }
    }

    res.json({ seasonId, total, top, me });
  } catch (e: unknown) {
    console.error("[season/leaderboard] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to load leaderboard" });
  }
});

// POST /api/season/ack-final { seasonId } → mark recap modal as shown.
router.post("/ack-final", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { seasonId } = (req.body ?? {}) as { seasonId?: number };
  if (typeof seasonId !== "number" || seasonId <= 0) {
    res.status(400).json({ error: "Invalid seasonId" });
    return;
  }
  try {
    // Only allow ack for a season the player actually has a finals row in.
    const exists = (await db.execute(sql`
      SELECT 1 FROM season_finals
      WHERE player_id = ${playerId} AND season_id = ${seasonId}
      LIMIT 1
    `)) as unknown as SqlResult<{ "?column?": number }>;
    if ((exists.rows?.length ?? 0) === 0) {
      res.status(404).json({ error: "No final standing for that season" });
      return;
    }
    // Monotonic update: never roll back the notified pointer if a newer
    // ack already happened (defensive against out-of-order client calls).
    await db.execute(sql`
      UPDATE player_scores
      SET notified_final_season_id = ${seasonId}, updated_at = NOW()
      WHERE player_id = ${playerId}
        AND COALESCE(notified_final_season_id, 0) < ${seasonId}
    `);
    res.json({ ok: true });
  } catch (e: unknown) {
    console.error("[season/ack-final] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to ack" });
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
        if (m.type === "round_score" || m.type === "streak") {
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

    // Unified entitlement (Stripe + Play), resolved BEFORE the tx so we never
    // hold the season_progress row lock during external billing lookups. This
    // mirrors the client UI check; the raw player_scores.is_premium column can
    // lag a live subscription and would silently deny the premium XP bonus.
    // Self-heal the column so other readers stay consistent.
    const isPremium = await isUserPremium(playerId);
    void stripeStorage.updatePlayerStripeInfo(playerId, { isPremium }).catch(() => {});

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
      const baseXp = m.xpReward;
      const xpEarned = isPremium
        ? Math.round(baseXp * PREMIUM_MISSION_MULTIPLIER)
        : baseXp;
      const bonusXp = xpEarned - baseXp;
      const newXp = row.xp + xpEarned;

      await tx
        .update(seasonProgressTable)
        .set({ xp: newXp, missionsJson: JSON.stringify(blob), updatedAt: new Date() })
        .where(eq(seasonProgressTable.id, progress.id));

      return {
        ok: true as const,
        xpEarned, baseXp, bonusXp,
        xp: newXp, missions: blob.missions, isPremium,
      };
    });

    if (!claim) { res.status(500).json({ error: "Transaction failed" }); return; }
    if (!claim.ok) {
      res.status(claim.status ?? 400).json({ error: claim.error });
      return;
    }

    res.json({
      ok: true,
      xpEarned: claim.xpEarned,
      baseXp: claim.baseXp,
      bonusXp: claim.bonusXp,
      premiumBonus: claim.isPremium,
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
      // Source of truth = unified entitlement (Stripe + Google Play), the SAME
      // check the client UI uses. Reading the raw player_scores.is_premium
      // column here would 403 a paying user whenever that column lags behind a
      // live subscription. Self-heal the column (both directions) so other
      // readers (multiplayer, ranking) stay consistent.
      const isPremium = await isUserPremium(playerId);
      void stripeStorage.updatePlayerStripeInfo(playerId, { isPremium }).catch(() => {});
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
      // Lock the player_scores row up front and hard-fail if it's missing
      // — otherwise the UPDATE below could affect 0 rows and the claim
      // would silently lose the reward while still being marked claimed.
      const playerLocked = (await tx.execute(sql`
        SELECT inventory_json FROM player_scores
        WHERE player_id = ${playerId} FOR UPDATE
      `)) as unknown as SqlResult<{ inventory_json: string }>;
      const playerRow = playerLocked.rows?.[0];
      if (!playerRow) {
        return { ok: false as const, error: "Player profile not found", status: 404 };
      }

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
        let inv: { avatars: string[]; frames: string[] } = { avatars: [], frames: [] };
        try {
          const parsed = JSON.parse(playerRow.inventory_json || "{}");
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
