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

interface SqlResult<T> { rows?: T[]; }

const router: IRouter = Router();
const MAX_CLAIMS = 500;
const MAX_INVENTORY_ITEMS = 500;
const MAX_ITEM_LENGTH = 100;

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
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((n): n is number =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= 0,
    ))].slice(0, MAX_CLAIMS);
  } catch (error) {
    console.warn("Could not parse integer reward claims", error);
    return [];
  }
}

function parseStrArray(raw: string | null | undefined): string[] {
  try {
    const value: unknown = JSON.parse(raw || "[]");
    if (!Array.isArray(value)) return [];
    return [...new Set(value.filter((s): s is string =>
      typeof s === "string" && s.length > 0 && s.length <= MAX_ITEM_LENGTH,
    ))].slice(0, MAX_CLAIMS);
  } catch (error) {
    console.warn("Could not parse string reward claims", error);
    return [];
  }
}

function parseInventory(raw: string | null | undefined): { avatars: string[]; frames: string[] } {
  try {
    const value: unknown = JSON.parse(raw || "{}");
    if (!value || typeof value !== "object" || Array.isArray(value)) {
      return { avatars: [], frames: [] };
    }
    const parsed = value as { avatars?: unknown; frames?: unknown };
    const normalize = (items: unknown): string[] => {
      if (!Array.isArray(items)) return [];
      return [...new Set(items.filter((item): item is string =>
        typeof item === "string" && item.length > 0 && item.length <= MAX_ITEM_LENGTH,
      ))].slice(0, MAX_INVENTORY_ITEMS);
    };
    return { avatars: normalize(parsed.avatars), frames: normalize(parsed.frames) };
  } catch (error) {
    console.warn("Could not parse player reward inventory", error);
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
    res.json({ stats, sets: evaluateCollectionSets(stats, parseStrArray(row.collection_claims_json), Number(row.games_played ?? 0)) });
  } catch (error: unknown) {
    console.error("[rewards/collection/get] error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to load collection rewards" });
  }
});

router.post("/collection/claim", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { setId } = (req.body ?? {}) as { setId?: string };
  if (!setId || setId.length > MAX_ITEM_LENGTH || !collectionSetById(setId)) { res.status(400).json({ error: "Unknown set" }); return; }
  const set = collectionSetById(setId)!;
  try {
    const result = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT id, coins, inventory_json, collected_words_json, collection_claims_json, games_played
        FROM player_scores WHERE player_id = ${playerId} FOR UPDATE
      `)) as unknown as SqlResult<{ id: number; coins: number; inventory_json: string; collected_words_json: string; collection_claims_json: string; games_played: number }>;
      const row = locked.rows?.[0];
      if (!row) return { ok: false as const, status: 404, error: "Player not found" };
      const claimed = parseStrArray(row.collection_claims_json);
      if (claimed.includes(setId)) return { ok: false as const, status: 400, error: "Already claimed" };
      const stats = computeCollectionStats(row.collected_words_json);
      if (set.progress(stats) < set.target) return { ok: false as const, status: 400, error: "Set not complete" };
      const minGames = set.minGames ?? 0;
      if (minGames > 0 && Number(row.games_played ?? 0) < minGames) return { ok: false as const, status: 400, error: "Not enough games played" };
      const inv = parseInventory(row.inventory_json);
      let grantedFrame: string | null = null;
      if (set.reward.frame && !inv.frames.includes(set.reward.frame)) { inv.frames.push(set.reward.frame); grantedFrame = set.reward.frame; }
      const grantedCoins = set.reward.coins ?? 0;
      const newCoins = row.coins + grantedCoins;
      claimed.push(setId);
      await tx.update(playerScoresTable).set({ coins: newCoins, inventoryJson: JSON.stringify(inv), collectionClaimsJson: JSON.stringify(claimed), updatedAt: new Date() }).where(eq(playerScoresTable.id, row.id));
      return { ok: true as const, coins: newCoins, grantedCoins, grantedFrame };
    });
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ok: true, coins: result.coins, grantedCoins: result.grantedCoins, grantedFrame: result.grantedFrame });
  } catch (error: unknown) {
    console.error("[rewards/collection/claim] error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to claim collection reward" });
  }
});

router.get("/prestige", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  try {
    const rows = (await db.execute(sql`SELECT games_played, prestige_claims_json FROM player_scores WHERE player_id = ${playerId} LIMIT 1`)) as unknown as SqlResult<{ games_played: number; prestige_claims_json: string }>;
    const row = rows.rows?.[0];
    if (!row) { res.status(404).json({ error: "Player not found" }); return; }
    res.json(evaluatePrestige(Number(row.games_played ?? 0), parseIntArray(row.prestige_claims_json)));
  } catch (error: unknown) {
    console.error("[rewards/prestige/get] error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to load prestige rewards" });
  }
});

router.post("/prestige/claim", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { tier } = (req.body ?? {}) as { tier?: number };
  if (typeof tier !== "number" || !Number.isSafeInteger(tier) || tier < 1 || tier > MAX_CLAIMS) { res.status(400).json({ error: "Invalid tier" }); return; }
  try {
    const result = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`SELECT id, coins, inventory_json, games_played, prestige_claims_json FROM player_scores WHERE player_id = ${playerId} FOR UPDATE`)) as unknown as SqlResult<{ id: number; coins: number; inventory_json: string; games_played: number; prestige_claims_json: string }>;
      const row = locked.rows?.[0];
      if (!row) return { ok: false as const, status: 404, error: "Player not found" };
      if (tier > prestigeTier(Number(row.games_played ?? 0))) return { ok: false as const, status: 400, error: "Tier not reached" };
      const claimed = parseIntArray(row.prestige_claims_json);
      if (claimed.includes(tier)) return { ok: false as const, status: 400, error: "Already claimed" };
      const reward = prestigeReward(tier);
      const inv = parseInventory(row.inventory_json);
      let grantedFrame: string | null = null;
      if (reward.frame && !inv.frames.includes(reward.frame)) { inv.frames.push(reward.frame); grantedFrame = reward.frame; }
      const newCoins = row.coins + reward.coins;
      claimed.push(tier);
      await tx.update(playerScoresTable).set({ coins: newCoins, inventoryJson: JSON.stringify(inv), prestigeClaimsJson: JSON.stringify(claimed), updatedAt: new Date() }).where(eq(playerScoresTable.id, row.id));
      return { ok: true as const, coins: newCoins, grantedCoins: reward.coins, grantedFrame };
    });
    if (!result.ok) { res.status(result.status).json({ error: result.error }); return; }
    res.json({ ok: true, coins: result.coins, grantedCoins: result.grantedCoins, grantedFrame: result.grantedFrame });
  } catch (error: unknown) {
    console.error("[rewards/prestige/claim] error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to claim prestige reward" });
  }
});

export default router;
