import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { and, eq, or, isNull, sql } from "drizzle-orm";

// 🚫 Permanent premium hard-coded accounts have been removed.
// Premium is now granted EXCLUSIVELY via an active Stripe subscription.
// Kept the helper as a no-op so callers don't need to be touched everywhere.
export const PERMANENT_PREMIUM_IDS = new Set<string>();

export function isPermanentPremium(_playerId: string): boolean {
  return false;
}

// Runs once at startup. Revokes is_premium for any account that does NOT have
// an active Stripe subscription on file. Safe & idempotent — paying customers
// (those with a non-empty stripe_subscription_id) are never touched.
export async function revokeFakePremium() {
  try {
    const result = await db
      .update(playerScoresTable)
      .set({ isPremium: false })
      .where(
        and(
          eq(playerScoresTable.isPremium, true),
          or(
            isNull(playerScoresTable.stripeSubscriptionId),
            eq(playerScoresTable.stripeSubscriptionId, "")
          )
        )
      )
      .returning({ id: playerScoresTable.id, name: playerScoresTable.playerName });
    if (result.length > 0) {
      console.log(
        `[premium] Revoked fake premium from ${result.length} account(s):`,
        result.map((r) => r.name).join(", ")
      );
    } else {
      console.log("[premium] No fake premium accounts found — DB clean.");
    }
  } catch (err: any) {
    console.error("[premium] revokeFakePremium failed:", err.message);
  }
}

// Deprecated alias kept temporarily for backward compatibility with old imports.
export const ensurePermanentPremium = revokeFakePremium;
