import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Durable idempotency ledger for Google Play one-time purchases.
 * A purchase token can only grant a product once, even across restarts or
 * multiple API replicas. The unique token is the security boundary.
 */
export const playPurchaseLedgerTable = pgTable(
  "play_purchase_ledger",
  {
    id: serial("id").primaryKey(),
    purchaseToken: text("purchase_token").notNull(),
    playerId: text("player_id").notNull(),
    productId: text("product_id").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    purchaseTokenUniq: uniqueIndex("play_purchase_ledger_token_uniq").on(t.purchaseToken),
  }),
);

export const insertPlayPurchaseLedgerSchema = createInsertSchema(playPurchaseLedgerTable).omit({
  id: true,
  createdAt: true,
});
export type InsertPlayPurchaseLedger = z.infer<typeof insertPlayPurchaseLedgerSchema>;
export type PlayPurchaseLedger = typeof playPurchaseLedgerTable.$inferSelect;
