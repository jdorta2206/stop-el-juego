import { pgTable, serial, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Persistent single-use ledger for signed score vouchers.
 * The unique JTI is the authoritative replay guard; the in-memory map in
 * scoreToken.ts remains only as a fast-path/fallback when PostgreSQL is
 * temporarily unavailable.
 */
export const scoreVoucherUsesTable = pgTable("score_voucher_uses", {
  id: serial("id").primaryKey(),
  jti: text("jti").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at").defaultNow().notNull(),
}, (t) => ({
  jtiUnique: uniqueIndex("score_voucher_uses_jti_uidx").on(t.jti),
}));

export const insertScoreVoucherUseSchema = createInsertSchema(scoreVoucherUsesTable).omit({ id: true, usedAt: true });
export type InsertScoreVoucherUse = z.infer<typeof insertScoreVoucherUseSchema>;
export type ScoreVoucherUse = typeof scoreVoucherUsesTable.$inferSelect;
