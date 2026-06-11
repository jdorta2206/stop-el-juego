import { db, playerScoresTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { SHOP_ITEMS } from "./inventoryCatalog";

// ── World Cup ("Mundial") pack ───────────────────────────────────────────
// One-time purchase (real money via Stripe web or Google Play one-time
// product) that unlocks EVERY World Cup cosmetic at once. The same items
// remain individually buyable with coins — the pack is just a bundle.
//
// Convention: every World Cup shop item id contains the marker "_wc_"
// (see inventoryCatalog.ts). The pack is derived from that marker so adding
// a new event item automatically includes it in the pack — no second list.

export const WORLD_CUP_PACK_SKU = "pack_mundial";
export const WORLD_CUP_PACK_PRICE_CENTS = 299; // 2,99 €
export const WORLD_CUP_PACK_CURRENCY = "eur";
export const WORLD_CUP_PACK_NAME = "Pack Mundial — STOP";

function worldCupItems() {
  return SHOP_ITEMS.filter((s) => s.id.includes("_wc_"));
}

export function worldCupPackItemIds(): string[] {
  return worldCupItems().map((s) => s.id);
}

interface SqlResult<T> {
  rows?: T[];
}

interface OwnedInventory {
  avatars: string[];
  frames: string[];
  backgrounds: string[];
  equippedBackground: string | null;
}

function parseInventory(raw: string): OwnedInventory {
  try {
    const p = JSON.parse(raw || "{}") as Partial<OwnedInventory>;
    return {
      avatars: Array.isArray(p.avatars) ? p.avatars : [],
      frames: Array.isArray(p.frames) ? p.frames : [],
      backgrounds: Array.isArray(p.backgrounds) ? p.backgrounds : [],
      equippedBackground:
        typeof p.equippedBackground === "string" ? p.equippedBackground : null,
    };
  } catch {
    return { avatars: [], frames: [], backgrounds: [], equippedBackground: null };
  }
}

export type GrantResult =
  | { ok: true; granted: number; total: number }
  | { ok: false; status: number; error: string };

// Idempotent set-union grant: adds every World Cup cosmetic id into the
// player's owned arrays inside inventory_json. Runs under a row lock so a
// concurrent /buy or reward claim (which also rewrite inventory_json) can't
// clobber the owned arrays. Re-running is safe — already-owned ids are
// skipped, so a retried /verify or /claim never duplicates or charges twice.
export async function grantWorldCupPack(playerId: string): Promise<GrantResult> {
  const items = worldCupItems();
  return db.transaction(async (tx) => {
    const locked = (await tx.execute(sql`
      SELECT id, inventory_json FROM player_scores WHERE player_id = ${playerId} FOR UPDATE
    `)) as unknown as SqlResult<{ id: number; inventory_json: string }>;
    const row = locked.rows?.[0];
    if (!row) return { ok: false as const, status: 404, error: "Player not found" };

    const inv = parseInventory(row.inventory_json);
    let granted = 0;
    for (const item of items) {
      const arr =
        item.kind === "avatar"
          ? inv.avatars
          : item.kind === "frame"
          ? inv.frames
          : inv.backgrounds;
      if (!arr.includes(item.id)) {
        arr.push(item.id);
        granted++;
      }
    }
    if (granted > 0) {
      await tx
        .update(playerScoresTable)
        .set({ inventoryJson: JSON.stringify(inv), updatedAt: new Date() })
        .where(eq(playerScoresTable.id, row.id));
    }
    return { ok: true as const, granted, total: items.length };
  });
}
