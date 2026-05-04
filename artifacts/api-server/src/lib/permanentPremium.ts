import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

export const PERMANENT_PREMIUM_IDS = new Set([
  "google_115341741312068082096",
  "fb_10162175157238897",
]);

export function isPermanentPremium(playerId: string): boolean {
  return PERMANENT_PREMIUM_IDS.has(playerId);
}

export async function ensurePermanentPremium() {
  try {
    const ids = [...PERMANENT_PREMIUM_IDS];
    await db
      .update(playerScoresTable)
      .set({ isPremium: true })
      .where(inArray(playerScoresTable.playerId, ids));
    console.log(`[premium] Permanent premium enforced for ${ids.length} accounts`);
  } catch (err: any) {
    console.error("[premium] Failed to enforce permanent premium:", err.message);
  }
}
