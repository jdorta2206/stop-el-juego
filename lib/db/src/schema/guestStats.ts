import { pgTable, text, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Anonymous, aggregate-only counters for guest (not-logged-in) activity.
// We intentionally store NO per-user data — just a daily tally — so guest
// volume can be measured without tracking individuals (GDPR-safe).
//   games       = guest games finished that day
//   conversions = times a guest tapped the end-of-game "sign in" CTA that day
export const guestStatsTable = pgTable("guest_stats", {
  day: text("day").primaryKey(), // YYYY-MM-DD (UTC)
  games: integer("games").notNull().default(0),
  conversions: integer("conversions").notNull().default(0),
});

export const insertGuestStatsSchema = createInsertSchema(guestStatsTable);
export type InsertGuestStats = z.infer<typeof insertGuestStatsSchema>;
export type GuestStats = typeof guestStatsTable.$inferSelect;


// Short-lived event ledger makes anonymous aggregate counters safe against
// duplicate delivery of the same client event without retaining player data.
export const guestStatsEventsTable = pgTable("guest_stats_events", {
  eventId: text("event_id").primaryKey(),
  day: text("day").notNull(),
  kind: text("kind").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});
