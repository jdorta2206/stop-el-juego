import { pgTable, text, serial, integer, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const playerScoresTable = pgTable("player_scores", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull().unique(),
  playerName: text("player_name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#e53e3e"),
  totalScore: integer("total_score").notNull().default(0),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  isPremium: boolean("is_premium").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertPlayerScoreSchema = createInsertSchema(playerScoresTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertPlayerScore = z.infer<typeof insertPlayerScoreSchema>;
export type PlayerScore = typeof playerScoresTable.$inferSelect;

export const gameHistoryTable = pgTable("game_history", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  score: integer("score").notNull().default(0),
  letter: text("letter").notNull(),
  mode: text("mode").notNull().default("solo"),
  won: boolean("won").notNull().default(false),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertGameHistorySchema = createInsertSchema(gameHistoryTable).omit({ id: true, createdAt: true });
export type InsertGameHistory = z.infer<typeof insertGameHistorySchema>;
export type GameHistory = typeof gameHistoryTable.$inferSelect;

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  roomCode: text("room_code").notNull().unique(),
  hostId: text("host_id").notNull(),
  status: text("status").notNull().default("waiting"),
  currentLetter: text("current_letter"),
  currentRound: integer("current_round").notNull().default(0),
  maxRounds: integer("max_rounds").notNull().default(3),
  language: text("language").notNull().default("es"),
  playersJson: text("players_json").notNull().default("[]"),
  stopperJson: text("stopper_json"),
  isPublic: boolean("is_public").notNull().default(false),
  hostName: text("host_name").notNull().default(""),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;

export const followsTable = pgTable("follows", {
  id: serial("id").primaryKey(),
  followerId: text("follower_id").notNull(),
  followedId: text("followed_id").notNull(),
  followedName: text("followed_name").notNull(),
  followedPicture: text("followed_picture"),
  followedAvatarColor: text("followed_avatar_color").notNull().default("#e53e3e"),
  followedProvider: text("followed_provider"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFollowSchema = createInsertSchema(followsTable).omit({ id: true, createdAt: true });
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;

// ── Daily challenge results ───────────────────────────────────────────────────
export const dailyResultsTable = pgTable("daily_results", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#e53e3e"),
  challengeDate: text("challenge_date").notNull(), // YYYY-MM-DD
  score: integer("score").notNull().default(0),
  letter: text("letter").notNull(),
  language: text("language").notNull().default("es"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertDailyResultSchema = createInsertSchema(dailyResultsTable).omit({ id: true, createdAt: true });
export type InsertDailyResult = z.infer<typeof insertDailyResultSchema>;
export type DailyResult = typeof dailyResultsTable.$inferSelect;
