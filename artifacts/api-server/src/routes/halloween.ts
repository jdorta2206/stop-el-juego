import { Router, type IRouter } from "express";
import { db, indexesReady } from "@workspace/db";
import { requirePlayerIdentity, type AuthedRequest } from "../lib/playerAuth";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const START_MONTH = 9; // October, UTC
const START_DAY = 15;
const END_MONTH = 10; // November, UTC
const END_DAY = 2;

function getEventYear(now = new Date()): number | null {
  const year = now.getUTCFullYear();
  const start = Date.UTC(year, START_MONTH, START_DAY);
  const end = Date.UTC(year, END_MONTH, END_DAY);
  const ms = now.getTime();
  return ms >= start && ms < end ? year : null;
}

type ProgressRow = {
  id: number;
  event_year: number;
  games_completed: number;
  scares_received: number;
  scares_provoked: number;
  coins_earned: number;
  rewards_json: string;
};

function parseJsonArray(raw: string | null | undefined): string[] {
  try {
    const parsed = JSON.parse(raw || "[]");
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : [];
  } catch {
    return [];
  }
}

async function getOrCreateProgress(playerId: string, year: number): Promise<ProgressRow> {
  await db.execute(sql`
    INSERT INTO halloween_progress (player_id, event_year)
    VALUES (${playerId}, ${year})
    ON CONFLICT (player_id, event_year) DO NOTHING
  `);
  const result = await db.execute(sql`
    SELECT id, event_year, games_completed, scares_received, scares_provoked,
           coins_earned, rewards_json
    FROM halloween_progress
    WHERE player_id = ${playerId} AND event_year = ${year}
    LIMIT 1
  `);
  return (result.rows?.[0] as ProgressRow) ?? {
    id: 0, event_year: year, games_completed: 0, scares_received: 0,
    scares_provoked: 0, coins_earned: 0, rewards_json: "[]",
  };
}

const REWARD_RULES = [
  { key: "games_5", kind: "coins", threshold: 5, field: "games_completed", amount: 500 },
  { key: "games_10", kind: "avatar", threshold: 10, field: "games_completed", amount: 0, item: "avatar_halloween_ghost" },
  { key: "received_3", kind: "coins", threshold: 3, field: "scares_received", amount: 500 },
  { key: "received_10", kind: "avatar", threshold: 10, field: "scares_received", amount: 0, item: "avatar_halloween_pumpkin" },
  { key: "provoked_3", kind: "coins", threshold: 3, field: "scares_provoked", amount: 500 },
  { key: "provoked_10", kind: "frame", threshold: 10, field: "scares_provoked", amount: 0, item: "frame_halloween_web" },
  { key: "games_20", kind: "background", threshold: 20, field: "games_completed", amount: 0, item: "bg_halloween_cemetery" },
] as const;

router.use((_req, res, next) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }
  next();
});

router.get("/progress", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const year = getEventYear();
  if (year === null) {
    res.json({ active: false, year: new Date().getUTCFullYear(), progress: null });
    return;
  }
  try {
    const progress = await getOrCreateProgress(playerId, year);
    res.json({
      active: true,
      year,
      progress: {
        gamesCompleted: progress.games_completed,
        scaresReceived: progress.scares_received,
        scaresProvoked: progress.scares_provoked,
        coinsEarned: progress.coins_earned,
        rewards: parseJsonArray(progress.rewards_json),
      },
      rewards: REWARD_RULES,
    });
  } catch (e) {
    console.error("[halloween/progress] error:", e);
    res.status(500).json({ error: "Failed to load Halloween progress" });
  }
});

router.post("/event", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const year = getEventYear();
  if (year === null) {
    res.status(409).json({ error: "Halloween event is not active" });
    return;
  }

  const { type, eventKey } = (req.body ?? {}) as {
    type?: "game_completed" | "scare_received" | "scare_provoked";
    eventKey?: string;
  };
  if (!["game_completed", "scare_received", "scare_provoked"].includes(type ?? "")) {
    res.status(400).json({ error: "Invalid Halloween event type" });
    return;
  }
  if (!eventKey || typeof eventKey !== "string" || eventKey.length > 160) {
    res.status(400).json({ error: "Missing eventKey" });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      await tx.execute(sql`
        INSERT INTO halloween_progress (player_id, event_year)
        VALUES (${playerId}, ${year})
        ON CONFLICT (player_id, event_year) DO NOTHING
      `);

      const locked = await tx.execute(sql`
        SELECT id, games_completed, scares_received, scares_provoked,
               coins_earned, rewards_json, event_keys_json
        FROM halloween_progress
        WHERE player_id = ${playerId} AND event_year = ${year}
        FOR UPDATE
      `);
      const row = locked.rows?.[0] as {
        id: number; games_completed: number; scares_received: number;
        scares_provoked: number; coins_earned: number;
        rewards_json: string; event_keys_json: string;
      } | undefined;
      if (!row) throw new Error("Halloween progress row missing");

      const keys = parseJsonArray(row.event_keys_json);
      if (keys.includes(eventKey)) {
        return {
          gamesCompleted: row.games_completed,
          scaresReceived: row.scares_received,
          scaresProvoked: row.scares_provoked,
          coinsEarned: row.coins_earned,
          rewards: parseJsonArray(row.rewards_json),
          duplicate: true,
        };
      }

      const games = row.games_completed + (type === "game_completed" ? 1 : 0);
      const received = row.scares_received + (type === "scare_received" ? 1 : 0);
      const provoked = row.scares_provoked + (type === "scare_provoked" ? 1 : 0);
      const rewards = parseJsonArray(row.rewards_json);
      let coinsAwarded = 0;
      const newRewardItems: string[] = [];

      for (const rule of REWARD_RULES) {
        const value = rule.field === "games_completed" ? games
          : rule.field === "scares_received" ? received : provoked;
        if (value < rule.threshold || rewards.includes(rule.key)) continue;
        rewards.push(rule.key);
        if (rule.kind === "coins") coinsAwarded += rule.amount;
        else if ("item" in rule && rule.item) newRewardItems.push(rule.item);
      }

      if (coinsAwarded > 0 || newRewardItems.length > 0) {
        const player = await tx.execute(sql`
          SELECT coins, inventory_json FROM player_scores
          WHERE player_id = ${playerId} FOR UPDATE
        `);
        const p = player.rows?.[0] as { coins: number; inventory_json: string } | undefined;
        if (p) {
          let inventory: { avatars: string[]; frames: string[]; backgrounds?: string[] } = { avatars: [], frames: [] };
          try {
            const parsed = JSON.parse(p.inventory_json || "{}");
            if (Array.isArray(parsed.avatars)) inventory.avatars = parsed.avatars;
            if (Array.isArray(parsed.frames)) inventory.frames = parsed.frames;
            if (Array.isArray(parsed.backgrounds)) inventory.backgrounds = parsed.backgrounds;
          } catch {}
          inventory.backgrounds ??= [];
          for (const item of newRewardItems) {
            if (item.startsWith("avatar_") && !inventory.avatars.includes(item)) inventory.avatars.push(item);
            else if (item.startsWith("frame_") && !inventory.frames.includes(item)) inventory.frames.push(item);
            else if (item.startsWith("bg_") && !inventory.backgrounds.includes(item)) inventory.backgrounds.push(item);
          }
          await tx.execute(sql`
            UPDATE player_scores
            SET coins = coins + ${coinsAwarded},
                inventory_json = ${JSON.stringify(inventory)},
                updated_at = NOW()
            WHERE player_id = ${playerId}
          `);
        }
      }

      keys.push(eventKey);
      if (keys.length > 500) keys.splice(0, keys.length - 500);
      const totalCoins = row.coins_earned + coinsAwarded;
      await tx.execute(sql`
        UPDATE halloween_progress
        SET games_completed = ${games},
            scares_received = ${received},
            scares_provoked = ${provoked},
            coins_earned = ${totalCoins},
            rewards_json = ${JSON.stringify(rewards)},
            event_keys_json = ${JSON.stringify(keys)},
            updated_at = NOW()
        WHERE id = ${row.id}
      `);

      return {
        gamesCompleted: games,
        scaresReceived: received,
        scaresProvoked: provoked,
        coinsEarned: totalCoins,
        coinsAwarded,
        rewards,
        newRewardItems,
        duplicate: false,
      };
    });

    res.json({ ok: true, year, ...result });
  } catch (e) {
    console.error("[halloween/event] error:", e);
    res.status(500).json({ error: "Failed to record Halloween event" });
  }
});

export default router;
