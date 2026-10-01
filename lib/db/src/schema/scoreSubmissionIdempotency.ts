import { pgTable, text, timestamp } from "drizzle-orm/pg-core";

export const scoreSubmissionIdempotencyTable = pgTable("score_submission_idempotency", {
  submissionId: text("submission_id").primaryKey(),
  playerId: text("player_id").notNull(),
  requestHash: text("request_hash").notNull(),
  responseJson: text("response_json").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type ScoreSubmissionIdempotency = typeof scoreSubmissionIdempotencyTable.$inferSelect;
