import { pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";

export const scoreVoucherUsesTable = pgTable(
  "score_voucher_uses",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (t) => ({
    expiresAtIdx: uniqueIndex("score_voucher_uses_jti_uniq").on(t.jti),
  }),
);

export type ScoreVoucherUse = typeof scoreVoucherUsesTable.$inferSelect;
