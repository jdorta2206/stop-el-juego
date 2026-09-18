import { pgTable, text, integer, timestamp, index } from "drizzle-orm/pg-core";

export const scoreBonusClaimsTable = pgTable(
  "score_bonus_claims",
  {
    tokenSetHash: text("token_set_hash").primaryKey(),
    playerId: text("player_id").notNull(),
    maxScore: integer("max_score").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (t) => ({
    playerIdIdx: index("score_bonus_claims_player_id_idx").on(t.playerId),
    expiresAtIdx: index("score_bonus_claims_expires_at_idx").on(t.expiresAt),
  }),
);
