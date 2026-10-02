import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

export async function withPlayerBillingLock<T>(playerId: string, fn: () => Promise<T>): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${playerId}, 0))`);
    return fn();
  });
}

export class StripeStorage {
  async getProduct(productId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.products WHERE id = ${productId}`
    );
    return result.rows[0] || null;
  }

  async listProductsWithPrices(active = true, limit = 20, offset = 0) {
    const result = await db.execute(
      sql`
        WITH paginated_products AS (
          SELECT id, name, description, metadata, active
          FROM stripe.products
          WHERE active = ${active}
          ORDER BY id
          LIMIT ${limit} OFFSET ${offset}
        )
        SELECT
          p.id as product_id,
          p.name as product_name,
          p.description as product_description,
          p.active as product_active,
          p.metadata as product_metadata,
          pr.id as price_id,
          pr.unit_amount,
          pr.currency,
          pr.recurring,
          pr.active as price_active
        FROM paginated_products p
        LEFT JOIN stripe.prices pr ON pr.product = p.id AND pr.active = true
        ORDER BY p.id, pr.unit_amount
      `
    );
    return result.rows;
  }

  async getSubscription(subscriptionId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions WHERE id = ${subscriptionId}`
    );
    return result.rows[0] || null;
  }

  async getActiveSubscriptionByCustomerId(customerId: string) {
    const result = await db.execute(
      sql`SELECT * FROM stripe.subscriptions
          WHERE customer = ${customerId}
            AND status IN ('active', 'trialing')
          LIMIT 1`
    );
    return result.rows[0] || null;
  }

  async getPlayer(playerId: string) {
    const [player] = await db
      .select()
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, playerId));
    return player || null;
  }

  async updatePlayerStripeInfo(
    playerId: string,
    info: { stripeCustomerId?: string; stripeSubscriptionId?: string; isPremium?: boolean },
    options?: { skipLock?: boolean },
  ) {
    // Account deletion uses the same per-player advisory transaction lock and
    // inserts a durable revocation before deleting player_scores. Acquire the
    // identical lock here and refuse to recreate a revoked account; otherwise
    // a concurrent Premium self-heal / Stripe request could resurrect the
    // deleted player_scores row after the deletion transaction commits.
    return db.transaction(async (tx) => {
      if (!options?.skipLock) {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${playerId}, 0))`);
      }
      const revoked = await tx.execute(sql`
        SELECT 1
        FROM revoked_player_ids
        WHERE player_id = ${playerId}
        LIMIT 1
      `);
      if (revoked.rows?.length) return null;

      const [player] = await tx
        .insert(playerScoresTable)
        .values({
          playerId,
          playerName: "Player",
          avatarColor: "#e53e3e",
          totalScore: 0,
          gamesPlayed: 0,
          wins: 0,
          ...info,
        })
        .onConflictDoUpdate({
          target: playerScoresTable.playerId,
          set: { ...info, updatedAt: new Date() },
        })
        .returning();
      return player ?? null;
    });
  }
}

export const stripeStorage = new StripeStorage();
