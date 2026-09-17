// ── Self-renewing reward claims (collection sets + prestige milestones) ─────
// Two GET endpoints (status) + two POST endpoints (claim). Claims are atomic:
// the player_scores row is locked FOR UPDATE, eligibility is recomputed
// server-side, and a double-claim guard array prevents re-claiming. Rewards
// (coins increment + exclusive frame appended to inventory) are deposited in
// the SAME transaction as the claim guard write, so a crash leaves no half
// state — mirrors POST /season/claim-tier.

import { Router, type IRouter } from "express";
import { db, playerScoresTable, indexesReady } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requirePlayerIdentity, type AuthedRequest } from "../lib/playerAuth";
import {
  computeCollectionStats,
  evaluateCollectionSets,
  collectionSetById,
} from "../lib/collectionSets";
import { evaluatePrestige, prestigeReward, prestigeTier } from "../lib/prestigeRewards";
import { verifyAdMobSsv } from "../lib/admobSsv";

interface SqlResult<T> {
  rows?: T[];
}

const router: IRouter = Router();

const ADMOB_REQUEST_ID_RE = /^[A-Za-z0-9_-]{20,128}$/;
const ADMOB_ORIGINS = new Set([
  "https://stopjuegodepalabras.com",
  "https://www.stopjuegodepalabras.com",
]);
const ADMOB_PLACEMENTS = new Set([
  "extra_time",
  "hint",
  "double_points",
  "skip_round",
  "extra_pack",
]);

function readString(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function isAllowedOrigin(value: string): boolean {
  return ADMOB_ORIGINS.has(value);
}

async function cleanupAdmobRewardRequests(): Promise<void> {
  await db.execute(sql.raw(
    "DELETE FROM admob_reward_requests WHERE created_at < NOW() - INTERVAL '5 minutes'",
  ));
}

router.post("/admob-result", async (req, res) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }

  const requestId = readString(req.body?.requestId);
  const playerId = readString(req.body?.playerId);
  const origin = readString(req.body?.origin);
  const placement = readString(req.body?.placement);
  const rawClientState = readString(req.body?.clientState);
  const clientState = rawClientState === "earned" || rawClientState === "dismissed" ? rawClientState : "pending";

  if (!ADMOB_REQUEST_ID_RE.test(requestId) || !playerId || playerId.length > 256) {
    res.status(400).json({ error: "Invalid rewarded request" });
    return;
  }

  if (!isAllowedOrigin(origin) || !ADMOB_PLACEMENTS.has(placement)) {
    res.status(400).json({ error: "Invalid rewarded context" });
    return;
  }

  try {
    await cleanupAdmobRewardRequests();

    const existingRows = await db.execute(sql`
      SELECT request_id, player_id, rewarded, client_state, consumed_at
      FROM admob_reward_requests
      WHERE request_id = ${requestId}
      LIMIT 1
    `) as unknown as SqlResult<{
      request_id: string;
      player_id: string;
      rewarded: boolean;
      client_state: string;
      consumed_at: Date | null;
    }>;

    const existing = existingRows.rows?.[0];

    if (existing) {
      if (existing.player_id !== playerId) {
        res.status(409).json({ error: "Reward request identity mismatch" });
        return;
      }

      if (!existing.rewarded && !existing.consumed_at) {
        const nextState =
          clientState === "earned" || existing.client_state === "earned"
            ? "earned"
            : "dismissed";

        await db.execute(sql`
          UPDATE admob_reward_requests
          SET client_state = ${nextState},
              origin = ${origin},
              placement = ${placement}
          WHERE request_id = ${requestId}
            AND rewarded = false
            AND consumed_at IS NULL
        `);
      }
    } else {
      await db.execute(sql`
        INSERT INTO admob_reward_requests
          (request_id, rewarded, player_id, placement, origin, client_state, created_at)
        VALUES
          (${requestId}, false, ${playerId}, ${placement}, ${origin}, ${clientState}, NOW())
        ON CONFLICT (request_id) DO NOTHING
      `);
    }

    res.status(204).end();
  } catch (error) {
    console.error(
      "[rewards/admob-result] error:",
      error instanceof Error ? error.message : String(error),
    );
    res.status(500).json({ error: "Failed to store rewarded ad state" });
  }
});

router.get("/admob-result/:requestId", async (req, res) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }

  const requestId = req.params.requestId;
  if (!ADMOB_REQUEST_ID_RE.test(requestId)) {
    res.status(400).json({ error: "Invalid requestId" });
    return;
  }

  try {
    await cleanupAdmobRewardRequests();

    const rows = await db.execute(sql`
      SELECT request_id, rewarded, client_state, consumed_at, created_at
      FROM admob_reward_requests
      WHERE request_id = ${requestId}
      LIMIT 1
    `) as unknown as SqlResult<{
      request_id: string;
      rewarded: boolean;
      client_state: string;
      consumed_at: Date | null;
      created_at: Date;
    }>;

    const row = rows.rows?.[0];

    if (!row || row.consumed_at) {
      res.json({ ready: false });
      return;
    }

    if (row.rewarded) {
      const updated = await db.execute(sql`
        UPDATE admob_reward_requests
        SET consumed_at = NOW()
        WHERE request_id = ${requestId}
          AND consumed_at IS NULL
          AND rewarded = true
        RETURNING rewarded
      `) as unknown as SqlResult<{ rewarded: boolean }>;

      if (updated.rows?.[0]?.rewarded) {
        res.json({ ready: true, rewarded: true });
        return;
      }
    }

    if (row.client_state === "dismissed") {
      const updated = await db.execute(sql`
        UPDATE admob_reward_requests
        SET consumed_at = NOW()
        WHERE request_id = ${requestId}
          AND consumed_at IS NULL
          AND rewarded = false
        RETURNING rewarded
      `) as unknown as SqlResult<{ rewarded: boolean }>;

      if (updated.rows?.[0]) {
        res.json({ ready: true, rewarded: false });
        return;
      }
    }

    const ageMs = Date.now() - new Date(row.created_at).getTime();

    if (ageMs >= 45_000) {
      const updated = await db.execute(sql`
        UPDATE admob_reward_requests
        SET consumed_at = NOW()
        WHERE request_id = ${requestId}
          AND consumed_at IS NULL
          AND rewarded = false
        RETURNING rewarded
      `) as unknown as SqlResult<{ rewarded: boolean }>;

      if (updated.rows?.[0]) {
        res.json({ ready: true, rewarded: false });
        return;
      }
    }

    res.json({ ready: false });
  } catch (error) {
    console.error(
      "[rewards/admob-result/get] error:",
      error instanceof Error ? error.message : String(error),
    );
    res.status(500).json({ error: "Failed to read rewarded ad state" });
  }
});

router.get("/admob-ssv", async (req, res) => {
  try {
    if (!indexesReady()) {
      res.status(503).send("warming_up");
      return;
    }

    // AdMob's dashboard "Verify URL" probe may intentionally omit custom_data.
    // This probe only validates reachability/configuration and MUST NEVER grant
    // a reward, so it is safe to acknowledge it before normal SSV processing.
    const hasCustomData = typeof req.query.custom_data === "string" && req.query.custom_data.length > 0;
    if (!hasCustomData) {
      res.status(200).send("ok");
      return;
    }

    const verification = await verifyAdMobSsv(req.originalUrl);

    if (!verification.valid) {
      res.status(400).send("invalid_ssv");
      return;
    }

    const params = verification.params;
    const adUnit = params.ad_unit ?? "";
    const customDataRaw = params.custom_data ?? "";
    const transactionId = params.transaction_id ?? "";

    if (adUnit !== "ca-app-pub-4807272408824742/3559554716") {
      res.status(400).send("invalid_ad_unit");
      return;
    }

    // AdMob's "Verify URL" test may omit custom_data because Google
    // documents custom_data as optional. A verification request must still
    // return HTTP 200, but it must never grant a reward.
    if (!customDataRaw) {
      if (!transactionId || transactionId.length > 256) {
        res.status(400).send("missing_ssv_data");
        return;
      }
      res.status(200).send("ok");
      return;
    }

    if (!transactionId || transactionId.length > 256) {
      res.status(400).send("missing_ssv_data");
      return;
    }

    let customData: {
      requestId?: string;
      playerId?: string;
      placement?: string;
    };

    try {
      customData = JSON.parse(customDataRaw) as {
        requestId?: string;
        playerId?: string;
        placement?: string;
      };
    } catch {
      res.status(400).send("invalid_custom_data");
      return;
    }

    const requestId = customData.requestId ?? "";
    const playerId = customData.playerId ?? "";
    const placement = customData.placement ?? null;

    if (!ADMOB_REQUEST_ID_RE.test(requestId) || !playerId || playerId.length > 256) {
      res.status(400).send("invalid_reward_identity");
      return;
    }

    if (placement !== null && !ADMOB_PLACEMENTS.has(placement)) {
      res.status(400).send("invalid_placement");
      return;
    }

    const existingRows = await db.execute(sql`
      SELECT request_id, player_id, rewarded
      FROM admob_reward_requests
      WHERE request_id = ${requestId}
      LIMIT 1
    `) as unknown as SqlResult<{
      request_id: string;
      player_id: string;
      rewarded: boolean;
    }>;

    const existing = existingRows.rows?.[0];

    if (existing && existing.player_id !== playerId) {
      res.status(409).send("identity_mismatch");
      return;
    }

    await db.execute(sql`
      INSERT INTO admob_reward_requests
        (request_id, rewarded, player_id, placement, client_state, transaction_id, created_at)
      VALUES
        (${requestId}, true, ${playerId}, ${placement}, 'earned', ${transactionId}, NOW())
      ON CONFLICT (request_id) DO UPDATE SET
        rewarded = true,
        client_state = 'earned',
        transaction_id = COALESCE(admob_reward_requests.transaction_id, EXCLUDED.transaction_id),
        placement = COALESCE(admob_reward_requests.placement, EXCLUDED.placement)
    `);

    res.status(200).send("ok");
  } catch (error) {
    console.error(
      "[rewards/admob-ssv] error:",
      error instanceof Error ? error.message : String(error),
    );
    res.status(500).send("ssv_error");
  }
});

router.use((_req, res, next) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }
  next();
});

function parseIntArray(raw: string | null | undefined): number[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((n) => typeof n === "number") : [];
  } catch {
    return [];
  }
}

function parseStrArray(raw: string | null | undefined): string[] {
  try {
    const v = JSON.parse(raw || "[]");
    return Array.isArray(v) ? v.filter((s) => typeof s === "string") : [];
  } catch {
    return [];
  }
}

function parseInventory(raw: string): { avatars: string[]; frames: string[] } {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<{ avatars: string[]; frames: string[] }>;
    return {
      avatars: Array.isArray(parsed.avatars) ? parsed.avatars : [],
      frames: Array.isArray(parsed.frames) ? parsed.frames : [],
    };
  } catch {
    return { avatars: [], frames: [] };
  }
}

// ── Collection ──────────────────────────────────────────────────────────────

router.get("/collection", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  try {
    const rows = (await db.execute(sql`
      SELECT collected_words_json, collection_claims_json, games_played
      FROM player_scores WHERE player_id = ${playerId} LIMIT 1
    `)) as unknown as SqlResult<{ collected_words_json: string; collection_claims_json: string; games_played: number }>;
    const row = rows.rows?.[0];
    if (!row) { res.status(404).json({ error: "Player not found" }); return; }
    const stats = computeCollectionStats(row.collected_words_json);
    res.json({
      stats,
      sets: evaluateCollectionSets(
        stats,
        parseStrArray(row.collection_claims_json),
        Number(row.games_played ?? 0),
      ),
    });
  } catch (e: unknown) {
    console.error("[rewards/collection/get] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to load collection rewards" });
  }
});

router.post("/collection/claim", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { setId } = (req.body ?? {}) as { setId?: string };
  if (!setId || !collectionSetById(setId)) { res.status(400).json({ error: "Unknown set" }); return; }
  const set = collectionSetById(setId)!;

  try {
    const result = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT id, coins, inventory_json, collected_words_json, collection_claims_json, games_played
        FROM player_scores WHERE player_id = ${playerId} FOR UPDATE
      `)) as unknown as SqlResult<{
        id: number; coins: number; inventory_json: string;
        collected_words_json: string; collection_claims_json: string; games_played: number;
      }>;
      const row = locked.rows?.[0];
      if (!row) return { ok: false as const, status: 404, error: "Player not found" };

      const claimed = parseStrArray(row.collection_claims_json);
      if (claimed.includes(setId)) return { ok: false as const, status: 400, error: "Already claimed" };

      const stats = computeCollectionStats(row.collected_words_json);
      if (set.progress(stats) < set.target) {
        return { ok: false as const, status: 400, error: "Set not complete" };
      }

      const minGames = set.minGames ?? 0;
      if (minGames > 0 && Number(row.games_played ?? 0) < minGames) {
        return { ok: false as const, status: 400, error: "Not enough games played" };
      }

      const inv = parseInventory(row.inventory_json);
      let grantedFrame: string | null = null;
      if (set.reward.frame && !inv.frames.includes(set.reward.frame)) {
        inv.frames.push(set.reward.frame);
        grantedFrame = set.reward.frame;
      }
      const grantedCoins = set.reward.coins ?? 0;
      const newCoins = row.coins + grantedCoins;
      claimed.push(setId);

      await tx.update(playerScoresTable)
        .set({
          coins: newCoins,
          inventoryJson: JSON.stringify(inv),
          collectionClaimsJson: JSON.stringify(claimed),
          updatedAt: new Date(),
        })
        .where(eq(playerScoresTable.id, row.id));

      return { ok: true as const, coins: newCoins, grantedCoins, grantedFrame };
    });

    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ok: true, coins: result.coins, grantedCoins: result.grantedCoins, grantedFrame: result.grantedFrame });
  } catch (e: unknown) {
    console.error("[rewards/collection/claim] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to claim collection reward" });
  }
});

// ── Prestige ─────────────────────────────────────────────────────────────────

router.get("/prestige", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  try {
    const rows = (await db.execute(sql`
      SELECT games_played, prestige_claims_json
      FROM player_scores WHERE player_id = ${playerId} LIMIT 1
    `)) as unknown as SqlResult<{ games_played: number; prestige_claims_json: string }>;
    const row = rows.rows?.[0];
    if (!row) { res.status(404).json({ error: "Player not found" }); return; }
    res.json(evaluatePrestige(Number(row.games_played ?? 0), parseIntArray(row.prestige_claims_json)));
  } catch (e: unknown) {
    console.error("[rewards/prestige/get] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to load prestige rewards" });
  }
});

router.post("/prestige/claim", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { tier } = (req.body ?? {}) as { tier?: number };
  if (typeof tier !== "number" || !Number.isInteger(tier) || tier < 1) {
    res.status(400).json({ error: "Invalid tier" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT id, coins, inventory_json, games_played, prestige_claims_json
        FROM player_scores WHERE player_id = ${playerId} FOR UPDATE
      `)) as unknown as SqlResult<{
        id: number; coins: number; inventory_json: string;
        games_played: number; prestige_claims_json: string;
      }>;
      const row = locked.rows?.[0];
      if (!row) return { ok: false as const, status: 404, error: "Player not found" };

      if (tier > prestigeTier(Number(row.games_played ?? 0))) {
        return { ok: false as const, status: 400, error: "Tier not reached" };
      }
      const claimed = parseIntArray(row.prestige_claims_json);
      if (claimed.includes(tier)) return { ok: false as const, status: 400, error: "Already claimed" };

      const reward = prestigeReward(tier);
      const inv = parseInventory(row.inventory_json);
      let grantedFrame: string | null = null;
      if (reward.frame && !inv.frames.includes(reward.frame)) {
        inv.frames.push(reward.frame);
        grantedFrame = reward.frame;
      }
      const newCoins = row.coins + reward.coins;
      claimed.push(tier);

      await tx.update(playerScoresTable)
        .set({
          coins: newCoins,
          inventoryJson: JSON.stringify(inv),
          prestigeClaimsJson: JSON.stringify(claimed),
          updatedAt: new Date(),
        })
        .where(eq(playerScoresTable.id, row.id));

      return { ok: true as const, coins: newCoins, grantedCoins: reward.coins, grantedFrame };
    });

    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ok: true, coins: result.coins, grantedCoins: result.grantedCoins, grantedFrame: result.grantedFrame });
  } catch (e: unknown) {
    console.error("[rewards/prestige/claim] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to claim prestige reward" });
  }
});

export default router;
