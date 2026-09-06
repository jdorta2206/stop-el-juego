import { pgTable, text, serial, integer, timestamp, boolean, bigint, uniqueIndex } from "drizzle-orm/pg-core";
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
  currentStreak: integer("current_streak").notNull().default(0),
  longestStreak: integer("longest_streak").notNull().default(0),
  lastPlayedDate: text("last_played_date"),
  streakDaysJson: text("streak_days_json").notNull().default("[]"),
  xp: integer("xp").notNull().default(0),
  level: integer("level").notNull().default(1),
  achievementsJson: text("achievements_json").notNull().default("[]"),
  achievementStatsJson: text("achievement_stats_json").notNull().default("{}"),
  personalBestsJson: text("personal_bests_json").notNull().default("{}"),
  coins: integer("coins").notNull().default(0),
  inventoryJson: text("inventory_json").notNull().default("{\"avatars\":[],\"frames\":[]}"),
  equippedAvatar: text("equipped_avatar"),
  equippedFrame: text("equipped_frame"),
  equippedBackground: text("equipped_background"),
  equippedTitle: text("equipped_title"),
  prestigeClaimsJson: text("prestige_claims_json").notNull().default("[]"),
  collectionClaimsJson: text("collection_claims_json").notNull().default("[]"),
  notifiedFinalSeasonId: integer("notified_final_season_id"),
  collectedWordsJson: text("collected_words_json").notNull().default("{}"),
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
  maxPlayers: integer("max_players").notNull().default(8),
  gameMode: text("game_mode").notNull().default("classic"),
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
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertFollowSchema = createInsertSchema(followsTable).omit({ id: true, createdAt: true });
export type InsertFollow = z.infer<typeof insertFollowSchema>;
export type Follow = typeof followsTable.$inferSelect;

export const dailyResultsTable = pgTable("daily_results", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  avatarColor: text("avatar_color").notNull().default("#e53e3e"),
  challengeDate: text("challenge_date").notNull(),
  score: integer("score").notNull().default(0),
  letter: text("letter").notNull(),
  language: text("language").notNull().default("es"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  playerDateUnique: uniqueIndex("daily_results_player_date_uidx").on(t.playerId, t.challengeDate),
}));

export const insertDailyResultSchema = createInsertSchema(dailyResultsTable).omit({ id: true, createdAt: true });
export type InsertDailyResult = z.infer<typeof insertDailyResultSchema>;
export type DailyResult = typeof dailyResultsTable.$inferSelect;

export const impossibleResultsTable = pgTable("impossible_results", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  playerName: text("player_name").notNull(),
  challengeDate: text("challenge_date").notNull(),
  language: text("language").notNull().default("es"),
  letter: text("letter").notNull(),
  category: text("category").notNull(),
  attemptedWord: text("attempted_word").notNull().default(""),
  won: boolean("won").notNull().default(false),
  timeMs: integer("time_ms").notNull().default(60000),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  uniqPlayerDateLang: uniqueIndex("impossible_results_player_date_lang_uniq").on(t.playerId, t.challengeDate, t.language),
}));

export const insertImpossibleResultSchema = createInsertSchema(impossibleResultsTable).omit({ id: true, createdAt: true });
export type InsertImpossibleResult = z.infer<typeof insertImpossibleResultSchema>;
export type ImpossibleResult = typeof impossibleResultsTable.$inferSelect;

export const tournamentsTable = pgTable("tournaments", {
  id: serial("id").primaryKey(),
  code: text("code").notNull().unique(),
  hostId: text("host_id").notNull(),
  hostName: text("host_name").notNull().default(""),
  name: text("name").notNull(),
  status: text("status").notNull().default("waiting"),
  size: integer("size").notNull().default(4),
  isPublic: boolean("is_public").notNull().default(false),
  playersJson: text("players_json").notNull().default("[]"),
  bracketJson: text("bracket_json"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertTournamentSchema = createInsertSchema(tournamentsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertTournament = z.infer<typeof insertTournamentSchema>;
export type Tournament = typeof tournamentsTable.$inferSelect;

export const pushSubscriptionsTable = pgTable("push_subscriptions", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  endpoint: text("endpoint").notNull().unique(),
  p256dh: text("p256dh").notNull(),
  auth: text("auth").notNull(),
  language: text("language").notNull().default("es"),
  enabled: boolean("enabled").notNull().default(true),
  hourLocal: integer("hour_local").notNull().default(20),
  tzOffsetMinutes: integer("tz_offset_minutes").notNull().default(0),
  mutedUntil: bigint("muted_until", { mode: "number" }).notNull().default(0),
  origin: text("origin"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertPushSubscriptionSchema = createInsertSchema(pushSubscriptionsTable).omit({ id: true, createdAt: true });
export type InsertPushSubscription = z.infer<typeof insertPushSubscriptionSchema>;
export type PushSubscription = typeof pushSubscriptionsTable.$inferSelect;

export const seasonsTable = pgTable("seasons", {
  id: serial("id").primaryKey(),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  themeJson: text("theme_json").notNull().default("{}"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertSeasonSchema = createInsertSchema(seasonsTable).omit({ id: true, createdAt: true });
export type InsertSeason = z.infer<typeof insertSeasonSchema>;
export type Season = typeof seasonsTable.$inferSelect;

export const seasonProgressTable = pgTable("season_progress", {
  id: serial("id").primaryKey(),
  playerId: text("player_id").notNull(),
  seasonId: integer("season_id").notNull(),
  xp: integer("xp").notNull().default(0),
  claimedTiers: text("claimed_tiers").notNull().default("{\"free\":[],\"premium\":[]}"),
  missionsJson: text("missions_json").notNull().default("{}"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSeasonProgressSchema = createInsertSchema(seasonProgressTable).omit({ id: true, updatedAt: true });
export type InsertSeasonProgress = z.infer<typeof insertSeasonProgressSchema>;
export type SeasonProgress = typeof seasonProgressTable.$inferSelect;
