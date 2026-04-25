import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

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
      sql`SELECT * FROM stripe.subscriptions WHERE customer = ${customerId} AND status = 'active' LIMIT 1`
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
    info: { stripeCustomerId?: string; stripeSubscriptionId?: string; isPremium?: boolean }
  ) {
    // Upsert so paying users without an existing player_scores row still get
    // their premium flag persisted (e.g., new sign-up that goes straight to
    // checkout). Without this, the €1.99 charge succeeds but the user never
    // sees premium features unlocked → refund + 1-star reviews.
    const [player] = await db
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
    return player;
  }
}

export const stripeStorage = new StripeStorage();
