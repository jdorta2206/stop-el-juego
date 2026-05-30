import { pgTable, text, integer } from "drizzle-orm/pg-core";
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
