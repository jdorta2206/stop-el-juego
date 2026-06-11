import { pgTable, text, serial, timestamp, bigint } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Google Play Billing subscriptions. One row per purchase token. Receives
// updates from Real-Time Developer Notifications (RTDN) and from explicit
// /verify calls from the client. `expiryTimeMs` is the source of truth for
// "is this subscription currently active" (compare with Date.now()).
//
// We never delete rows — when a subscription expires/cancels we just update
// `state` and let `expiryTimeMs` decide entitlement at read time. Keeps the
// table append-mostly and lets us audit refunds/cancellations historically.
export const playSubscriptionsTable = pgTable("play_subscriptions", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  productId: text("product_id").notNull(), // e.g. premium_monthly
  purchaseToken: text("purchase_token").notNull().unique(),
  orderId: text("order_id"),
  // Last known lifecycle state from Google. Mirrors Play notification types:
  // ACTIVE, IN_GRACE_PERIOD, ON_HOLD, CANCELED, EXPIRED, REVOKED, PAUSED.
  state: text("state").notNull().default("ACTIVE"),
  // Epoch milliseconds. Premium = state in active set AND now < expiryTimeMs.
  expiryTimeMs: bigint("expiry_time_ms", { mode: "number" }).notNull().default(0),
  startTimeMs: bigint("start_time_ms", { mode: "number" }).notNull().default(0),
  // Raw JSON of the last subscription resource fetched from Google. Useful
  // for debugging refunds, country, price changes, etc.
  rawJson: text("raw_json").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlaySubscriptionSchema = createInsertSchema(playSubscriptionsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlaySubscription = z.infer<typeof insertPlaySubscriptionSchema>;
export type PlaySubscription = typeof playSubscriptionsTable.$inferSelect;

// Google Play one-time (managed) product purchases — e.g. the World Cup pack.
// Subscriptions live in `play_subscriptions`; these are non-renewing entitlements.
// One row per purchase token. The token is bound to whichever player first
// verifies it; a different player replaying the same token is refused (the
// same anti-replay guard used for subscriptions). The actual cosmetic
// entitlement is granted into the player's inventory — this row is the
// idempotency + ownership ledger, not the entitlement itself.
export const playProductPurchasesTable = pgTable("play_product_purchases", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  productId: text("product_id").notNull(), // e.g. pack_mundial
  purchaseToken: text("purchase_token").notNull().unique(),
  orderId: text("order_id"),
  // 0 = purchased, 1 = canceled, 2 = pending (Google purchaseState).
  purchaseState: bigint("purchase_state", { mode: "number" }).notNull().default(0),
  rawJson: text("raw_json").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlayProductPurchaseSchema = createInsertSchema(playProductPurchasesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});
export type InsertPlayProductPurchase = z.infer<typeof insertPlayProductPurchaseSchema>;
export type PlayProductPurchase = typeof playProductPurchasesTable.$inferSelect;
