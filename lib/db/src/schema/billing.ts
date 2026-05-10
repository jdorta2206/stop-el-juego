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
