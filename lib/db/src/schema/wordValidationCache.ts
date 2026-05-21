import { pgTable, text, serial, timestamp, boolean, integer, uniqueIndex, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Cache of AI-resolved word validations. When a player writes a word that is
// NOT in our static dictionary, we ask an LLM whether the word is a valid
// member of the requested category in the requested language. The answer is
// cached here forever so a given (word, category, lang) triple is only ever
// paid for once across all players for the lifetime of the game.
//
// Cache is intentionally lowercase-normalized and accent-folded on write
// (callers must normalize before lookup) so "Manzana", "manzana" and
// "MANZÁNA" all hit the same row. `source` lets us audit later: which entries
// came from the static dict vs. the AI vs. a manual override.
export const wordValidationCacheTable = pgTable("word_validation_cache", {
  id: serial("id").primaryKey(),
  // Already-normalized: lowercase, accents stripped, trimmed.
  word: text("word").notNull(),
  category: text("category").notNull(),
  lang: text("lang").notNull(),
  isValid: boolean("is_valid").notNull(),
  // 'ai' | 'manual' | 'dict'. Free-form on purpose so we can add provenance
  // tags later without a migration.
  source: text("source").notNull().default("ai"),
  // Optional model identifier (e.g. "gpt-5-nano") for debugging cost / quality.
  model: text("model"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
}, (t) => ({
  // Single lookup key. Composite unique because the same word can have a
  // different verdict per (category, language) — "rosa" is valid as color in
  // Spanish, not as fruit. Enforced at DB level so concurrent inserts can't
  // create duplicates.
  uniq: uniqueIndex("word_validation_cache_lookup").on(t.word, t.category, t.lang),
  // Helps the daily-budget query stay cheap as the table grows.
  byCreatedAt: index("word_validation_cache_created_at_idx").on(t.createdAt),
}));

export const insertWordValidationCacheSchema = createInsertSchema(wordValidationCacheTable).omit({
  id: true,
  createdAt: true,
});
export type InsertWordValidationCache = z.infer<typeof insertWordValidationCacheSchema>;
export type WordValidationCache = typeof wordValidationCacheTable.$inferSelect;
