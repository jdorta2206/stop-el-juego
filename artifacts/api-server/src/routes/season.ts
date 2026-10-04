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
    // Finalize every ended season, not just the immediately preceding one.
    // This matters after downtime: several season periods may have elapsed
    // before the next request/cron creates or discovers the current season.
    const endedRows = (await db.execute(sql`
      SELECT id FROM seasons
      WHERE end_date < ${today} AND id <> ${currentSeasonId}
      ORDER BY id ASC
    `)) as unknown as SqlResult<{ id: number }>;

    for (const season of endedRows.rows ?? []) {
      const prevId = Number(season.id);
      // Finalization and authoritative season events share one transaction-level
      // advisory lock. This closes the midnight race where an event that started
      // before rollover could otherwise update the old season after its standings
      // snapshot had already been taken.
      const client = await pool.connect();
      let processed = 0;
      let standingsCount = 0;
      try {
        await client.query("BEGIN");
        await client.query("SELECT pg_advisory_xact_lock($1::bigint)", [prevId]);

        const standings = await client.query<{
          player_id: string;
          xp: number;
          rank: number | string;
          total: number | string;
        }>(
          `SELECT player_id, xp,
                  ROW_NUMBER() OVER (ORDER BY xp DESC, id ASC) AS rank,
                  COUNT(*) OVER () AS total
           FROM season_progress
           WHERE season_id = $1
           ORDER BY xp DESC, id ASC`,
          [prevId],
        );
        standingsCount = standings.rows.length;

        for (const r of standings.rows) {
          const rank = Number(r.rank);
          const total = Number(r.total);
          const cosmetic = rank <= 3 ? championFrameId(prevId, rank as 1 | 2 | 3) : null;

          await client.query(
            `INSERT INTO season_finals
               (season_id, player_id, final_rank, final_xp, total_players, awarded_cosmetic)
             VALUES ($1, $2, $3, $4, $5, $6)
             ON CONFLICT (season_id, player_id) DO NOTHING`,
            [prevId, r.player_id, rank, r.xp, total, cosmetic],
          );

          if (cosmetic) {
            const invRes = await client.query<{ inventory_json: string }>(
              `SELECT inventory_json FROM player_scores
               WHERE player_id = $1 FOR UPDATE`,
              [r.player_id],
            );
            if (invRes.rows.length > 0) {
              const raw = invRes.rows[0].inventory_json;
              const inv: Record<string, unknown> = { avatars: [], frames: [] };
              try {
                const parsed = JSON.parse(raw || "{}");
                if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
                  Object.assign(inv, parsed);
                }
                if (!Array.isArray(inv.avatars)) inv.avatars = [];
                if (!Array.isArray(inv.frames)) inv.frames = [];
              } catch { /* keep defaults */ }

              const frames = inv.frames as string[];
              if (!frames.includes(cosmetic)) {
                frames.push(cosmetic);
                await client.query(
                  `UPDATE player_scores
                   SET inventory_json = $1, updated_at = NOW()
                   WHERE player_id = $2`,
                  [JSON.stringify(inv), r.player_id],
                );
              }
            }
          }
          processed++;
        }

        await client.query("COMMIT");
      } catch (txErr) {
        await client.query("ROLLBACK").catch(() => {});
        console.error(
          `[finalizePreviousSeason] season ${prevId} failed:`,
          txErr instanceof Error ? txErr.message : String(txErr),
        );
      } finally {
        client.release();
      }

      console.log(
        `[finalizePreviousSeason] Finalized season ${prevId} (${processed}/${standingsCount} players)`,
      );
    }
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

  if (existing.length > 0) {
    // Recovery path: a previous process may have created this season and
    // crashed before finalizing ended seasons. Re-check whether any ended
    // season still has progress rows without a corresponding final snapshot.
    // This is a cheap existence query and keeps finalization recoverable after
    // a crash instead of depending on the original rollover request.
    const incomplete = await db.execute(sql`
      SELECT 1
      FROM seasons s
      WHERE s.end_date < ${today}
        AND EXISTS (
          SELECT 1
          FROM season_progress sp
          WHERE sp.season_id = s.id
            AND NOT EXISTS (
              SELECT 1
              FROM season_finals sf
              WHERE sf.season_id = sp.season_id
                AND sf.player_id = sp.player_id
            )
        )
      LIMIT 1
    `);
    if ((incomplete as any).rows?.length > 0) {
      void finalizePreviousSeason(existing[0].id, today);
    }
    return existing[0];
  }

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
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${playerId}, 0))`);
    const revoked = await tx.execute(sql`SELECT 1 FROM revoked_player_ids WHERE player_id = ${playerId} LIMIT 1`);
    if ((revoked as any).rows?.length) throw new Error("ACCOUNT_DELETED");

  // Race-safe upsert: relies on the unique index on (player_id, season_id).
  // ON CONFLICT DO NOTHING + RETURNING gives us the new row on insert OR
  // nothing on conflict — in which case we SELECT the winning row.
    const fresh: MissionsBlob = { date: today, missions: buildMissionsForDate(today) };
    const inserted = await tx
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
      const existing = await tx
      .select()
      .from(seasonProgressTable)
      .where(and(eq(seasonProgressTable.playerId, playerId), eq(seasonProgressTable.seasonId, seasonId)))
      .limit(1);
      row = existing[0];
    }
    if (!row) throw new Error("SEASON_PROGRESS_NOT_FOUND");

  // Lazily roll missions over to today under the same row lock used by
  // authoritative mission progress. Without this transaction, a rollover
  // update could race a gameplay event and overwrite progress written by the
  // other request.
    const rolledRow = await (async () => {
    const locked = (await tx.execute(sql`
      SELECT id, player_id, season_id, xp, claimed_tiers, missions_json, updated_at
      FROM season_progress
      WHERE id = ${row.id}
      FOR UPDATE
    `)) as unknown as SqlResult<ProgressRow>;
    const current = locked.rows?.[0];
    if (!current) return null;

    const currentDate = (() => {
      try { return JSON.parse(current.missionsJson || "{}")?.date; }
      catch { return undefined; }
    })();

    if (currentDate !== today) {
      const rolled: MissionsBlob = { date: today, missions: buildMissionsForDate(today) };
      await tx
        .update(seasonProgressTable)
        .set({ missionsJson: JSON.stringify(rolled), updatedAt: new Date() })
        .where(eq(seasonProgressTable.id, row.id));
      current.missionsJson = JSON.stringify(rolled);
    }
    return current;
    })();
    return rolledRow ?? row;
  });
}

/**
 * Records season progress only from server-authoritative gameplay results.
 * The public /event endpoint must never accept client-supplied progress values.
 */
async function applyAuthoritativeSeasonEventsInTransaction(
  tx: any,
  playerId: string,
  events: Array<{ type: "win_game" | "play_game" | "round_score" | "streak" | "valid_words" | "daily_done"; value?: number }>,
  eventKey?: string,
): Promise<void> {
  if (!playerId || events.length === 0) return;

  const today = todayUTC();
  await tx.execute(sql`
    INSERT INTO seasons (start_date, end_date, theme_json)
    VALUES (${today}, ${addDays(today, SEASON_LENGTH_DAYS - 1)}, ${JSON.stringify(themeForStartDate(today))})
    ON CONFLICT (start_date) DO NOTHING
  `);

  const seasonRows = (await tx.execute(sql`
    SELECT id FROM seasons
    WHERE start_date <= ${today} AND end_date >= ${today}
    ORDER BY id DESC
    LIMIT 1
  `)) as unknown as SqlResult<{ id: number }>;
  const season = seasonRows.rows?.[0];
  if (!season) return;

  // Lock order must match season finalization: season -> player.
  // Otherwise a rollover can snapshot standings while an event holds the
  // player lock and is still waiting to enter the season lock.
  await tx.execute(sql`
    SELECT pg_advisory_xact_lock(${Number(season.id)}::bigint)
  `);
  await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${playerId}, 0))`);

  const revoked = await tx.execute(sql`SELECT 1 FROM revoked_player_ids WHERE player_id = ${playerId} LIMIT 1`);
  if ((revoked as any).rows?.length) return;

  const activeSeason = (await tx.execute(sql`
    SELECT 1 FROM seasons
    WHERE id = ${Number(season.id)} AND end_date >= ${todayUTC()}
    LIMIT 1
  `)) as unknown as SqlResult<{ "?column?": number }>;
  if ((activeSeason.rows?.length ?? 0) === 0) return;

  const fresh: MissionsBlob = { date: today, missions: buildMissionsForDate(today) };
  await tx.execute(sql`
    INSERT INTO season_progress (player_id, season_id, xp, claimed_tiers, missions_json)
    VALUES (${playerId}, ${Number(season.id)}, 0, '{"free":[],"premium":[]}', ${JSON.stringify(fresh)})
    ON CONFLICT (player_id, season_id) DO NOTHING
  `);

  const progressRows = (await tx.execute(sql`
    SELECT id, missions_json
    FROM season_progress
    WHERE player_id = ${playerId} AND season_id = ${Number(season.id)}
    FOR UPDATE
  `)) as unknown as SqlResult<{ id: number; missions_json: string }>;
  const row = progressRows.rows?.[0];
  if (!row) return;

  if (eventKey) {
    const claim = await tx.execute(sql`
      INSERT INTO season_event_claims (season_id, player_id, event_key)
      VALUES (${Number(season.id)}, ${playerId}, ${eventKey})
      ON CONFLICT (season_id, player_id, event_key) DO NOTHING
      RETURNING event_key
    `);
    if ((claim.rows?.length ?? 0) === 0) return;
  }

  const blob = parseMissions(row.missions_json, today);
  let mutated = false;

  for (const event of events) {
    const value = Number.isFinite(event.value) && Number(event.value) > 0
      ? Math.floor(Number(event.value))
      : 1;

    for (const m of blob.missions) {
      if (m.type !== event.type || m.claimed) continue;
      if (m.type === "round_score" || m.type === "streak") {
        if (value > m.progress) {
          m.progress = Math.min(value, m.target);
          mutated = true;
        }
      } else {
        const next = Math.min(m.progress + value, m.target);
        if (next !== m.progress) {
          m.progress = next;
          mutated = true;
        }
      }
      if (m.progress >= m.target) m.completed = true;
    }
  }

  if (mutated) {
    await tx.update(seasonProgressTable)
      .set({ missionsJson: JSON.stringify(blob), updatedAt: new Date() })
      .where(eq(seasonProgressTable.id, row.id));
  }
}

export async function recordAuthoritativeSeasonEvents(
  playerId: string,
  events: Array<{ type: "win_game" | "play_game" | "round_score" | "streak" | "valid_words" | "daily_done"; value?: number }>,
  eventKey?: string,
 ): Promise<boolean> {
  if (!playerId || events.length === 0) return true;
  try {
    await db.transaction(async (tx) => {
      await applyAuthoritativeSeasonEventsInTransaction(tx, playerId, events, eventKey);
    });
    return true;
  } catch (e: unknown) {
    // Season progression is auxiliary and must never make a valid game result fail.
    console.error("[season/authoritative-event] error:", e instanceof Error ? e.message : String(e));
    return false;
  }
}

export { applyAuthoritativeSeasonEventsInTransaction };

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

// POST /api/season/event
// Deprecated: mission progress is now recorded only by server-authoritative
// gameplay endpoints. Keeping this route closed prevents forged type/value
// submissions from granting season progress.
router.post("/event", requirePlayerIdentity, async (_req: AuthedRequest, res) => {
  res.status(410).json({ error: "Season events are server-authoritative" });
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
      // Serialize claims with season rollover using the same lock order as
      // finalization: season -> player/progress. Re-check the season inside
      // the transaction so a request that crossed the UTC rollover boundary
      // cannot claim a mission from an ended season.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${Number(season.id)}::bigint)`);
      const activeSeason = (await tx.execute(sql`
        SELECT 1 FROM seasons
        WHERE id = ${Number(season.id)} AND start_date <= ${today} AND end_date >= ${today}
        LIMIT 1
      `)) as unknown as SqlResult<{ "?column?": number }>;
      if ((activeSeason.rows?.length ?? 0) === 0) {
        return { ok: false as const, error: "Season is no longer active", status: 409 };
      }

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

  if (typeof tier !== "number" || !Number.isInteger(tier) || !track || (track !== "free" && track !== "premium")) {
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
      // Keep the same season -> player lock order used by rollover/finalization
      // and re-check activity inside the transaction before granting a tier.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(${Number(season.id)}::bigint)`);
      const activeSeason = (await tx.execute(sql`
        SELECT 1 FROM seasons
        WHERE id = ${Number(season.id)} AND start_date <= ${todayUTC()} AND end_date >= ${todayUTC()}
        LIMIT 1
      `)) as unknown as SqlResult<{ "?column?": number }>;
      if ((activeSeason.rows?.length ?? 0) === 0) {
        return { ok: false as const, error: "Season is no longer active", status: 409 };
      }

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
        let inv: { avatars: string[]; frames: string[]; backgrounds: string[]; equippedBackground: string | null } = { avatars: [], frames: [], backgrounds: [], equippedBackground: null };
        try {
          const parsed = JSON.parse(playerRow.inventory_json || "{}");
          if (Array.isArray(parsed.avatars)) inv.avatars = parsed.avatars;
          if (Array.isArray(parsed.frames)) inv.frames = parsed.frames;
          if (Array.isArray(parsed.backgrounds)) inv.backgrounds = parsed.backgrounds;
          if (typeof parsed.equippedBackground === "string") inv.equippedBackground = parsed.equippedBackground;
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