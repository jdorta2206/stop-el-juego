import { pgTable, text, integer, timestamp, index, primaryKey } from "drizzle-orm/pg-core";

export const scoreVoucherIssuancesTable = pgTable(
  "score_voucher_issuances",
  {
    sessionHash: text("session_hash").notNull(),
    mode: text("mode").notNull(),
    round: integer("round").notNull(),
    jti: text("jti").notNull().unique(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    pk: primaryKey({ columns: [t.sessionHash, t.mode, t.round] }),
    expiresAtIdx: index("score_voucher_issuances_expires_at_idx").on(t.expiresAt),
  }),
);
