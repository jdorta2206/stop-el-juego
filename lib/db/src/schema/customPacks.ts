import { pgTable, text, serial, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

/**
 * Premium-only feature: user-defined category packs.
 * Categories are stored as a JSON-encoded string array (typically 7 items).
 * The premium check is enforced at the route layer (isUserPremium) — this
 * table doesn't carry a premium flag on its own so a downgraded ex-premium
 * user simply loses access at read time but their saved packs survive in
 * case they re-subscribe.
 */
export const customCategoryPacksTable = pgTable(
  "custom_category_packs",
  {
    id: serial("id").primaryKey(),
    playerId: text("player_id").notNull(),
    name: text("name").notNull(),
    icon: text("icon").notNull().default("✨"),
    color: text("color").notNull().default("#f9a825"),
    categoriesJson: text("categories_json").notNull(),
    language: text("language").notNull().default("es"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at").defaultNow().notNull(),
  },
  (table) => ({
    playerIdx: index("custom_packs_player_idx").on(table.playerId),
  }),
);

export const insertCustomCategoryPackSchema = createInsertSchema(
  customCategoryPacksTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertCustomCategoryPack = z.infer<
  typeof insertCustomCategoryPackSchema
>;
export type CustomCategoryPack = typeof customCategoryPacksTable.$inferSelect;
