import { pgTable, text, timestamp, index } from "drizzle-orm/pg-core";

export const scoreVoucherUsesTable = pgTable(
  "score_voucher_uses",
  {
    jti: text("jti").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (t) => ({
    expiresAtIdx: index("score_voucher_uses_expires_at_idx").on(t.expiresAt),
  }),
);

export type ScoreVoucherUse = typeof scoreVoucherUsesTable.$inferSelect;
