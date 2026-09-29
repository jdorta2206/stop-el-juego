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
    // Serialize the sweep with premium-grant transactions that update the
    // same player row. This prevents a legitimate purchase from racing the
    // read/filter/update sequence below.
    await db.transaction(async (tx) => {
      // Lock all currently-premium candidates before checking external
      // subscription state. Purchase flows that update player_scores must wait
      // for this decision, so they cannot be revoked by a stale read.
      const candidates = await tx
        .select({
          id: playerScoresTable.id,
          playerId: playerScoresTable.playerId,
          name: playerScoresTable.playerName,
        })
        .from(playerScoresTable)
        .where(
          and(
            eq(playerScoresTable.isPremium, true),
            or(
              isNull(playerScoresTable.stripeSubscriptionId),
              eq(playerScoresTable.stripeSubscriptionId, ""),
            ),
          ),
        )
        .for("update");

      if (candidates.length === 0) {
        console.log("[premium] No fake premium accounts found — DB clean.");
        return;
      }

      // Re-check Play subscriptions after acquiring the player-row locks.
      // A concurrent purchase that grants premium through the player row must
      // therefore wait and cannot be lost by this sweep.
      const playSubscribers = await tx.execute(
        sql`SELECT DISTINCT player_id FROM play_subscriptions
            WHERE product_id = 'premium_monthly'
              AND state IN ('ACTIVE', 'IN_GRACE_PERIOD')
              AND expiry_time_ms > ${Date.now()}`,
      );
      const playPremiumIds = new Set<string>(
        (playSubscribers.rows as Array<{ player_id: string }>).map((r) => r.player_id),
      );

      const toRevoke = candidates.filter((c) => !playPremiumIds.has(c.playerId));
      if (toRevoke.length === 0) {
        console.log("[premium] No fake premium accounts found — DB clean.");
        return;
      }

      const result = await tx
        .update(playerScoresTable)
        .set({ isPremium: false })
        .where(
          sql`id IN (${sql.join(toRevoke.map((c) => sql`${c.id}`), sql`, `)})
            AND NOT EXISTS (
              SELECT 1
              FROM play_subscriptions ps
              WHERE ps.player_id = ${playerScoresTable.playerId}
                AND ps.product_id = 'premium_monthly'
                AND ps.state IN ('ACTIVE', 'IN_GRACE_PERIOD')
                AND ps.expiry_time_ms > ${Date.now()}
            )`,
        )
        .returning({ id: playerScoresTable.id, name: playerScoresTable.playerName });

      if (result.length > 0) {
        console.log(
          `[premium] Revoked fake premium from ${result.length} account(s):`,
          result.map((r) => r.name).join(", "),
        );
      } else {
        console.log("[premium] No fake premium accounts found — DB clean.");
      }
    });
  } catch (err: any) {
    console.error("[premium] revokeFakePremium failed:", err.message);
  }
}

// Deprecated alias kept temporarily for backward compatibility with old imports.
export const ensurePermanentPremium = revokeFakePremium;
