import { Router, type IRouter } from "express";
import { db, playerScoresTable, indexesReady } from "@workspace/db";
import { sql } from "drizzle-orm";
import { requirePlayerIdentity, type AuthedRequest } from "../lib/playerAuth";

const router: IRouter = Router();
const COMPENSATION_COINS = 500;
const COMPENSATION_FRAME_ID = "frame_gracias_por_seguir";

interface SqlResult<T> { rows?: T[]; }

function parseInventory(raw: string): { avatars: string[]; frames: string[]; backgrounds: string[] } {
  try {
    const parsed = JSON.parse(raw || "{}") as Record<string, unknown>;
    return {
      avatars: Array.isArray(parsed.avatars) ? parsed.avatars.filter((v): v is string => typeof v === "string") : [],
      frames: Array.isArray(parsed.frames) ? parsed.frames.filter((v): v is string => typeof v === "string") : [],
      backgrounds: Array.isArray(parsed.backgrounds) ? parsed.backgrounds.filter((v): v is string => typeof v === "string") : [],
    };
  } catch {
    return { avatars: [], frames: [], backgrounds: [] };
  }
}

/**
 * One-time service interruption compensation.
 * Eligibility and the claim are enforced server-side under a row lock:
 * the client can request the endpoint repeatedly but can never receive the
 * coins/frame more than once.
 */
router.post("/downtime-compensation", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }

  const playerId = req.playerId!;
  if (!playerId || playerId.startsWith("guest_") || playerId.startsWith("bot_")) {
    res.json({ granted: false });
    return;
  }

  try {
    const result = await db.transaction(async (tx) => {
      const rows = await tx.execute(sql`
        SELECT id, coins, inventory_json
        FROM player_scores
        WHERE player_id = ${playerId}
        FOR UPDATE
      `) as unknown as SqlResult<{ id: number; coins: number; inventory_json: string }>;

      const row = rows.rows?.[0];
      if (!row) return { granted: false as const, alreadyClaimed: false as const };

      const inventory = parseInventory(row.inventory_json);
      if (inventory.frames.includes(COMPENSATION_FRAME_ID)) {
        return { granted: false as const, alreadyClaimed: true as const };
      }

      inventory.frames.push(COMPENSATION_FRAME_ID);
      await tx.update(playerScoresTable)
        .set({
          coins: row.coins + COMPENSATION_COINS,
          inventoryJson: JSON.stringify(inventory),
          updatedAt: new Date(),
        })
        .where(sql`id = ${row.id}`);

      return { granted: true as const, alreadyClaimed: false as const };
    });

    res.json({
      granted: result.granted,
      alreadyClaimed: result.alreadyClaimed,
      coins: result.granted ? COMPENSATION_COINS : 0,
      frameId: result.granted ? COMPENSATION_FRAME_ID : null,
    });
  } catch (error) {
    console.error("[rewards/downtime-compensation] error:", error instanceof Error ? error.message : String(error));
    res.status(500).json({ error: "Failed to grant downtime compensation" });
  }
});

export default router;
