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
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
