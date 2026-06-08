import { Router, type IRouter } from "express";
import { db, playerScoresTable, indexesReady } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { requirePlayerIdentity, type AuthedRequest } from "../lib/playerAuth";
import { resolveCosmetic, shopItem, SHOP_ITEMS } from "../lib/inventoryCatalog";
import { computeTitleStats, evaluateTitles, isTitleUnlocked } from "../lib/titleCatalog";

interface SqlResult<T> {
  rows?: T[];
}

interface InventoryRow {
  coins: number;
  inventory_json: string;
  equipped_avatar: string | null;
  equipped_frame: string | null;
  equipped_title: string | null;
  games_played: number;
  wins: number;
  current_streak: number;
  longest_streak: number;
  level: number;
  total_score: number;
}

interface OwnedInventory {
  avatars: string[];
  frames: string[];
}

const router: IRouter = Router();

router.use((_req, res, next) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    res.status(503).json({ error: "Server warming up", ready: false });
    return;
  }
  next();
});

function parseInventory(raw: string): OwnedInventory {
  try {
    const parsed = JSON.parse(raw || "{}") as Partial<OwnedInventory>;
    return {
      avatars: Array.isArray(parsed.avatars) ? parsed.avatars : [],
      frames: Array.isArray(parsed.frames) ? parsed.frames : [],
    };
  } catch {
    return { avatars: [], frames: [] };
  }
}

async function loadInventoryRow(playerId: string): Promise<InventoryRow | null> {
  const rows = (await db.execute(sql`
    SELECT coins, inventory_json, equipped_avatar, equipped_frame, equipped_title,
           games_played, wins, current_streak, longest_streak, level, total_score
    FROM player_scores WHERE player_id = ${playerId} LIMIT 1
  `)) as unknown as SqlResult<InventoryRow>;
  return rows.rows?.[0] ?? null;
}

// GET /api/inventory → coin balance, owned cosmetics (with metadata),
// equipped selection, and the shop catalog. One round-trip for the UI.
router.get("/", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  try {
    const row = await loadInventoryRow(playerId);
    if (!row) {
      res.status(404).json({ error: "Player not found" });
      return;
    }
    const inv = parseInventory(row.inventory_json);
    const titleStats = computeTitleStats(row);
    res.json({
      coins: row.coins,
      equipped: { avatar: row.equipped_avatar, frame: row.equipped_frame, title: row.equipped_title },
      owned: {
        avatars: inv.avatars
          .map((id) => resolveCosmetic(id))
          .filter((c): c is NonNullable<ReturnType<typeof resolveCosmetic>> => c !== null && c.kind === "avatar"),
        frames: inv.frames
          .map((id) => resolveCosmetic(id))
          .filter((c): c is NonNullable<ReturnType<typeof resolveCosmetic>> => c !== null && c.kind === "frame"),
      },
      // Titles are earned by playing — full catalog annotated with unlocked state.
      titles: evaluateTitles(titleStats),
      shop: SHOP_ITEMS,
    });
  } catch (e: unknown) {
    console.error("[inventory/get] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to load inventory" });
  }
});

// POST /api/inventory/equip { kind, value } → equip an owned cosmetic.
// `value` may be `null` to unequip. Server validates ownership.
router.post("/equip", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { kind, value } = (req.body ?? {}) as { kind?: string; value?: string | null };
  if (kind !== "avatar" && kind !== "frame" && kind !== "title") {
    res.status(400).json({ error: "Invalid kind" });
    return;
  }

  try {
    const row = await loadInventoryRow(playerId);
    if (!row) { res.status(404).json({ error: "Player not found" }); return; }

    const hasValue = value !== null && value !== undefined && value !== "";

    if (hasValue && kind === "title") {
      // Titles aren't in inventory_json — they're unlocked by meeting the
      // play criteria. Validate against the player's live stats.
      if (!isTitleUnlocked(value as string, computeTitleStats(row))) {
        res.status(403).json({ error: "Title not unlocked" });
        return;
      }
    } else if (hasValue) {
      const meta = resolveCosmetic(value as string);
      if (!meta || meta.kind !== kind) {
        res.status(400).json({ error: "Unknown cosmetic" });
        return;
      }
      const inv = parseInventory(row.inventory_json);
      const owned = kind === "avatar" ? inv.avatars : inv.frames;
      if (!owned.includes(value as string)) {
        res.status(403).json({ error: "Cosmetic not owned" });
        return;
      }
    }

    const finalValue = value === "" ? null : value ?? null;
    if (kind === "avatar") {
      await db.update(playerScoresTable)
        .set({ equippedAvatar: finalValue, updatedAt: new Date() })
        .where(eq(playerScoresTable.playerId, playerId));
    } else if (kind === "frame") {
      await db.update(playerScoresTable)
        .set({ equippedFrame: finalValue, updatedAt: new Date() })
        .where(eq(playerScoresTable.playerId, playerId));
    } else {
      await db.update(playerScoresTable)
        .set({ equippedTitle: finalValue, updatedAt: new Date() })
        .where(eq(playerScoresTable.playerId, playerId));
    }
    res.json({ ok: true, kind, value: finalValue });
  } catch (e: unknown) {
    console.error("[inventory/equip] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to equip" });
  }
});

// POST /api/inventory/buy { itemId } → spend coins to buy a shop cosmetic.
// Atomic: locks the row, re-checks balance and ownership inside the tx so
// concurrent purchases can't double-spend or duplicate items.
router.post("/buy", requirePlayerIdentity, async (req: AuthedRequest, res) => {
  const playerId = req.playerId!;
  const { itemId } = (req.body ?? {}) as { itemId?: string };
  if (!itemId) { res.status(400).json({ error: "Missing itemId" }); return; }

  const item = shopItem(itemId);
  if (!item) { res.status(400).json({ error: "Unknown shop item" }); return; }

  try {
    const result = await db.transaction(async (tx) => {
      const locked = (await tx.execute(sql`
        SELECT id, coins, inventory_json
        FROM player_scores WHERE player_id = ${playerId} FOR UPDATE
      `)) as unknown as SqlResult<{ id: number; coins: number; inventory_json: string }>;
      const row = locked.rows?.[0];
      if (!row) return { ok: false as const, status: 404, error: "Player not found" };

      const inv = parseInventory(row.inventory_json);
      const owned = item.kind === "avatar" ? inv.avatars : inv.frames;
      if (owned.includes(item.id)) {
        return { ok: false as const, status: 400, error: "Already owned" };
      }
      if (row.coins < item.price) {
        return { ok: false as const, status: 400, error: "Insufficient coins" };
      }

      if (item.kind === "avatar") inv.avatars.push(item.id);
      else inv.frames.push(item.id);

      const newCoins = row.coins - item.price;
      await tx.update(playerScoresTable)
        .set({ coins: newCoins, inventoryJson: JSON.stringify(inv), updatedAt: new Date() })
        .where(eq(playerScoresTable.id, row.id));

      return { ok: true as const, coins: newCoins, inventory: inv };
    });

    if (!result.ok) {
      res.status(result.status).json({ error: result.error });
      return;
    }
    res.json({ ok: true, coins: result.coins, item });
  } catch (e: unknown) {
    console.error("[inventory/buy] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to purchase" });
  }
});

export default router;
