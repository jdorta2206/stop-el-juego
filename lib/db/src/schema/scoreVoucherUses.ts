import { pgTable, text, timestamp, index, primaryKey } from "drizzle-orm/pg-core";

export const scoreVoucherUsesTable = pgTable(
  "score_voucher_uses",
  {
    jti: text("jti").notNull(),
    purpose: text("purpose").notNull().default("ranking"),
    expiresAt: timestamp("expires_at").notNull(),
    usedAt: timestamp("used_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.jti, t.purpose] }),
    expiresAtIdx: index("score_voucher_uses_expires_at_idx").on(t.expiresAt),
  }),
);

export type ScoreVoucherUse = typeof scoreVoucherUsesTable.$inferSelect;
