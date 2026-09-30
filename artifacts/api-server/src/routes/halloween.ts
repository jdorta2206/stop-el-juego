import { Router, type IRouter } from "express";
import { db, indexesReady } from "@workspace/db";
import { verifyClaimedIdentity, isLoggedInId, type AuthedRequest } from "../lib/playerAuth";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

const START_MONTH = 9; // October, UTC
const START_DAY = 15;
const END_MONTH = 10; // November, UTC
const END_DAY = 3;

export function isHalloweenPreviewAuthorized(req: { headers?: Record<string, unknown> }): boolean {
  const enabled = String(req.headers?.["x-halloween-preview"] ?? "") === "1";
  const configuredSecret = String(process.env.HALLOWEEN_PREVIEW_SECRET ?? "");
  const suppliedSecret = String(req.headers?.["x-halloween-preview-token"] ?? "");
  return enabled && configuredSecret.length >= 32 && suppliedSecret === configuredSecret;
}

export function getHalloweenEventYear(now = new Date(), preview = false): number | null {
  if (preview) return now.getUTCFullYear();
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

router.get("/progress", async (req: AuthedRequest, res) => {
  const playerId = String(req.headers["x-halloween-player-id"] ?? "").trim();
  if (!playerId || !verifyClaimedIdentity(req, playerId)) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  const preview = isHalloweenPreviewAuthorized(req);
  const year = getHalloweenEventYear(new Date(), preview);

  if (year === null) {
    res.json({ active: false, year: new Date().getUTCFullYear(), progress: null });
    return;
  }

  // Guests are intentionally excluded from persistent Halloween rewards/progress.
  // Do not create rows for arbitrary UUIDs: guest identities are tokenless by design,
  // so accepting any UUID here would let an attacker fill halloween_progress at will.
  if (!isLoggedInId(playerId)) {
    res.json({ active: true, year, progress: null, rewards: REWARD_RULES });
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


export async function recordHalloweenEventInTransaction(
  tx: any,
  playerId: string,
  type: "game_completed" | "scare_received" | "scare_provoked",
  eventKey: string,
  preview = false,
  activeRoomId?: number,
  activeRoomStatus?: "playing" | "stopped",
  activeRoomRound?: number,
) {
  const year = getEventYear(new Date(), preview);
  if (year === null) return null;
  if (!playerId || !eventKey || eventKey.length > 160) return null;
      if (activeRoomId !== undefined) {
        const activeRoom = await tx.execute(sql`
          SELECT status, current_round
          FROM rooms
          WHERE id = ${activeRoomId}
          FOR UPDATE
        `);
        const activeStatus = String(activeRoom.rows?.[0]?.status ?? "");
        const expectedStatus = activeRoomStatus ?? "playing";
        if (activeStatus !== expectedStatus) return null;
        if (activeRoomRound !== undefined && Number(activeRoom.rows?.[0]?.current_round) !== activeRoomRound) return null;
      }

      // Lock player_scores before halloween_progress so Solo score settlement
      // and concurrent Halloween scares always acquire locks in the same order.
      const playerLock = await tx.execute(sql`
        SELECT coins, inventory_json
        FROM player_scores
        WHERE player_id = ${playerId}
        FOR UPDATE
      `);
      const lockedPlayer = playerLock.rows?.[0] as { coins: number; inventory_json: string } | undefined;
      if (!lockedPlayer) throw new Error("Player score row missing while recording Halloween event");

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

      const claim = await tx.execute(sql`
        INSERT INTO halloween_event_claims (event_year, player_id, event_key)
        VALUES (${year}, ${playerId}, ${eventKey})
        ON CONFLICT (event_year, player_id, event_key) DO NOTHING
        RETURNING event_key
      `);
      if ((claim.rows?.length ?? 0) === 0) {
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
        const p = lockedPlayer;
        {
          let inventory: Record<string, unknown> = {};
          try {
            const parsed = JSON.parse(p.inventory_json || "{}");
            if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
              inventory = parsed as Record<string, unknown>;
            }
          } catch {}
          const avatars = Array.isArray(inventory.avatars) ? inventory.avatars as string[] : [];
          const frames = Array.isArray(inventory.frames) ? inventory.frames as string[] : [];
          const backgrounds = Array.isArray(inventory.backgrounds) ? inventory.backgrounds as string[] : [];
          inventory.avatars = avatars;
          inventory.frames = frames;
          inventory.backgrounds = backgrounds;
          for (const item of newRewardItems) {
            if (item.startsWith("avatar_") && !avatars.includes(item)) avatars.push(item);
            else if (item.startsWith("frame_") && !frames.includes(item)) frames.push(item);
            else if (item.startsWith("bg_") && !backgrounds.includes(item)) backgrounds.push(item);
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

      const keys = parseJsonArray(row.event_keys_json);
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
}export async function recordHalloweenEvent(
  playerId: string,
  type: "game_completed" | "scare_received" | "scare_provoked",
  eventKey: string,
  preview = false,
  activeRoomId?: number,
  activeRoomStatus?: "playing" | "stopped",
  activeRoomRound?: number,
) {
  return await db.transaction(async (tx) =>
    recordHalloweenEventInTransaction(
      tx,
      playerId,
      type,
      eventKey,
      preview,
      activeRoomId,
      activeRoomStatus,
      activeRoomRound,
    )
  );
}


export async function recordHalloweenScareEventsInTransaction(
  tx: any,
  events: Array<{
    playerId: string;
    type: "scare_received" | "scare_provoked";
    eventKey: string;
  }>,
  preview = false,
  activeRoomId?: number,
  activeRoomStatus: "playing" | "stopped" = "playing",
  activeRoomRound?: number,
) {
  const year = getEventYear(new Date(), preview);
  if (year === null || events.length === 0) return [];
  if (activeRoomId === undefined) return [];

    const activeRoom = await tx.execute(sql`
      SELECT status, current_round
      FROM rooms
      WHERE id = ${activeRoomId}
      FOR UPDATE
    `);
    if (String(activeRoom.rows?.[0]?.status ?? "") !== activeRoomStatus) return [];
    if (activeRoomRound !== undefined && Number(activeRoom.rows?.[0]?.current_round) !== activeRoomRound) return [];

    const results: unknown[] = [];
    // Always lock Halloween progress rows in a deterministic player order.
    // Concurrent scares involving the same players otherwise could lock A→B
    // in one transaction and B→A in another, causing a PostgreSQL deadlock.
    const orderedEvents = [...events].sort((a, b) =>
      a.playerId.localeCompare(b.playerId) || a.eventKey.localeCompare(b.eventKey)
    );
    for (const event of orderedEvents) {
      if (!event.playerId || !event.eventKey || event.eventKey.length > 160) continue;

      // Lock player_scores before halloween_progress to match Solo score
      // settlement and every other Halloween reward path.
      const playerLock = await tx.execute(sql`
        SELECT coins, inventory_json
        FROM player_scores
        WHERE player_id = ${event.playerId}
        FOR UPDATE
      `);
      const lockedPlayer = playerLock.rows?.[0] as { coins: number; inventory_json: string } | undefined;
      if (!lockedPlayer) throw new Error("Player score row missing while recording Halloween scare event");

      await tx.execute(sql`
        INSERT INTO halloween_progress (player_id, event_year)
        VALUES (${event.playerId}, ${year})
        ON CONFLICT (player_id, event_year) DO NOTHING
      `);

      const locked = await tx.execute(sql`
        SELECT id, games_completed, scares_received, scares_provoked,
               coins_earned, rewards_json, event_keys_json
        FROM halloween_progress
        WHERE player_id = ${event.playerId} AND event_year = ${year}
        FOR UPDATE
      `);
      const row = locked.rows?.[0] as {
        id: number; games_completed: number; scares_received: number; scares_provoked: number;
        coins_earned: number; rewards_json: string; event_keys_json: string;
      } | undefined;
      if (!row) throw new Error("Halloween progress row missing");

      const claim = await tx.execute(sql`
        INSERT INTO halloween_event_claims (event_year, player_id, event_key)
        VALUES (${year}, ${event.playerId}, ${event.eventKey})
        ON CONFLICT (event_year, player_id, event_key) DO NOTHING
        RETURNING event_key
      `);
      if ((claim.rows?.length ?? 0) === 0) continue;

      const games = row.games_completed;
      const received = row.scares_received + (event.type === "scare_received" ? 1 : 0);
      const provoked = row.scares_provoked + (event.type === "scare_provoked" ? 1 : 0);
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
        const p = lockedPlayer;

        let inventory: Record<string, unknown> = {};
        try {
          const parsed = JSON.parse(p.inventory_json || "{}");
          if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
            inventory = parsed as Record<string, unknown>;
          }
        } catch {}
        const avatars = Array.isArray(inventory.avatars) ? inventory.avatars as string[] : [];
        const frames = Array.isArray(inventory.frames) ? inventory.frames as string[] : [];
        const backgrounds = Array.isArray(inventory.backgrounds) ? inventory.backgrounds as string[] : [];
        inventory.avatars = avatars;
        inventory.frames = frames;
        inventory.backgrounds = backgrounds;
        for (const item of newRewardItems) {
          if (item.startsWith("avatar_") && !avatars.includes(item)) avatars.push(item);
          else if (item.startsWith("frame_") && !frames.includes(item)) frames.push(item);
          else if (item.startsWith("bg_") && !backgrounds.includes(item)) backgrounds.push(item);
        }
        await tx.execute(sql`
          UPDATE player_scores
          SET coins = coins + ${coinsAwarded},
              inventory_json = ${JSON.stringify(inventory)},
              updated_at = NOW()
          WHERE player_id = ${event.playerId}
        `);
      }

      const keys = parseJsonArray(row.event_keys_json);
      keys.push(event.eventKey);
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
      results.push({ playerId: event.playerId, eventKey: event.eventKey, coinsAwarded });
    }
    return results;

}

export async function recordHalloweenScareEventsWithCooldown(
  events: Array<{
    playerId: string;
    type: "scare_received" | "scare_provoked";
    eventKey: string;
  }>,
  preview: boolean,
  roomId: number,
  roomRound: number,
  playerId: string,
) {
  const year = getEventYear(new Date(), preview);
  if (year === null) return { recorded: [], cooldownMs: 0, ended: false };

  return await db.transaction(async (tx) => {
    const activeRoom = await tx.execute(sql`
      SELECT status, current_round
      FROM rooms
      WHERE id = ${roomId}
      FOR UPDATE
    `);
    if (String(activeRoom.rows?.[0]?.status ?? "") !== "playing" ||
        Number(activeRoom.rows?.[0]?.current_round) !== roomRound) {
      return { recorded: [], cooldownMs: 0, ended: true };
    }

    const claimed = await tx.execute(sql`
      INSERT INTO halloween_scare_cooldowns (room_id, player_id, available_at)
      VALUES (${roomId}, ${playerId}, clock_timestamp() + INTERVAL '18 seconds')
      ON CONFLICT (room_id, player_id) DO UPDATE
      SET available_at = EXCLUDED.available_at,
          updated_at = NOW()
      WHERE halloween_scare_cooldowns.available_at <= clock_timestamp()
      RETURNING available_at
    `);
    if ((claimed.rows?.length ?? 0) === 0) {
      const current = await tx.execute(sql`
        SELECT GREATEST(0, EXTRACT(EPOCH FROM (available_at - clock_timestamp())) * 1000) AS remaining_ms
        FROM halloween_scare_cooldowns
        WHERE room_id = ${roomId} AND player_id = ${playerId}
        LIMIT 1
      `);
      return {
        recorded: [],
        cooldownMs: Math.max(1, Math.ceil(Number((current.rows?.[0] as any)?.remaining_ms ?? 18000))),
        ended: false,
      };
    }

    if (events.length === 0) return { recorded: [], cooldownMs: 18000, ended: false };
    const recorded = await recordHalloweenScareEventsInTransaction(
      tx,
      events,
      preview,
      roomId,
      "playing",
      roomRound,
    );
    return { recorded, cooldownMs: 18000, ended: false };
  });
}

export async function recordHalloweenScareEvents(
  events: Array<{
    playerId: string;
    type: "scare_received" | "scare_provoked";
    eventKey: string;
  }>,
  preview = false,
  activeRoomId?: number,
  activeRoomStatus: "playing" | "stopped" = "playing",
  activeRoomRound?: number,
) {
  return await db.transaction(async (tx) =>
    recordHalloweenScareEventsInTransaction(
      tx,
      events,
      preview,
      activeRoomId,
      activeRoomStatus,
      activeRoomRound,
    )
  );
}

router.post("/event", async (_req, res) => {
  // Halloween progress is authoritative server state. Clients cannot mint
  // progress/rewards by posting arbitrary event types or keys.
  res.status(410).json({ error: "Halloween progress is recorded by gameplay" });
});

export default router;
