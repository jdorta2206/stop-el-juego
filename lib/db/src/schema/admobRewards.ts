import { pgTable, text, boolean, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const admobRewardRequestsTable = pgTable("admob_reward_requests", {
  requestId: text("request_id").primaryKey(),
  rewarded: boolean("rewarded").notNull().default(false),
  playerId: text("player_id").notNull(),
  placement: text("placement"),
  origin: text("origin"),
  clientState: text("client_state").notNull().default("pending"),
  transactionId: text("transaction_id"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  consumedAt: timestamp("consumed_at"),
}, (t) => ({
  transactionUid: uniqueIndex("admob_reward_requests_transaction_uidx").on(t.transactionId),
}));

export const insertAdmobRewardRequestSchema = createInsertSchema(admobRewardRequestsTable).omit({
  createdAt: true,
});
export type InsertAdmobRewardRequest = z.infer<typeof insertAdmobRewardRequestSchema>;
export type AdmobRewardRequest = typeof admobRewardRequestsTable.$inferSelect;
