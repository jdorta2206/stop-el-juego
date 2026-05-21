// Word Collection — rarity engine + types shared by the hook and the page.
// Keep this pure (no React, no fetch) so SoloGame can call computeRarity
// synchronously right after validate.

export type Rarity = "common" | "rare" | "epic" | "legendary";

export interface CollectedWord {
  /** Original-cased word as the player typed it (capitalized). */
  name: string;
  /** First category where the word was discovered. */
  cat: string;
  /** Computed rarity at discovery time. */
  r: Rarity;
  /** Discovery timestamp (Date.now()). */
  d: number;
}

/** Storage shape: keyed by normalized word so the same word in a different
 * category does NOT count twice. Append-only. */
export type CollectionMap = Record<string, CollectedWord>;

const RARE_LETTERS = new Set(["k", "q", "w", "x", "y", "z", "ñ"]);

/** Strip accents + lowercase. Matches the server's normalizeWord roughly
 * enough for client-side dedupe. */
export function normalizeWord(w: string): string {
  return w
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim();
}

/** Pure rarity formula based on length + rare letters. No network, no IA.
 * Tuned so most short common words are "common", longer ones climb the
 * ladder, and rare-letter words always get at least "rare". */
export function computeRarity(word: string): Rarity {
  const norm = normalizeWord(word);
  const len = norm.length;
  const startsRare = norm.length > 0 && RARE_LETTERS.has(norm[0]);
  const containsRare = [...norm].some(ch => RARE_LETTERS.has(ch));

  if (len >= 12 || startsRare) return "legendary";
  if (len >= 9 || (containsRare && len >= 6)) return "epic";
  if (len >= 6 || containsRare) return "rare";
  return "common";
}

export const RARITY_ORDER: Rarity[] = ["legendary", "epic", "rare", "common"];

export const RARITY_META: Record<Rarity, { emoji: string; color: string; border: string; glow: string }> = {
  legendary: { emoji: "✨", color: "#fbbf24", border: "rgba(251,191,36,0.7)", glow: "0 0 20px rgba(251,191,36,0.4)" },
  epic:      { emoji: "🔥", color: "#a855f7", border: "rgba(168,85,247,0.6)", glow: "0 0 14px rgba(168,85,247,0.3)" },
  rare:      { emoji: "⭐", color: "#3b82f6", border: "rgba(59,130,246,0.55)", glow: "0 0 10px rgba(59,130,246,0.25)" },
  common:    { emoji: "◻️", color: "#9ca3af", border: "rgba(156,163,175,0.35)", glow: "none" },
};

/** Merge new discoveries into existing map (first-write wins on dedupe).
 * Returns the new map AND the list of words actually added (for toast). */
export function mergeDiscoveries(
  current: CollectionMap,
  newWords: Array<{ word: string; category: string }>,
): { next: CollectionMap; added: CollectedWord[] } {
  const next: CollectionMap = { ...current };
  const added: CollectedWord[] = [];
  const now = Date.now();
  for (const { word, category } of newWords) {
    const trimmed = word?.trim();
    if (!trimmed) continue;
    const key = normalizeWord(trimmed);
    if (!key || next[key]) continue;
    const entry: CollectedWord = {
      name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1).toLowerCase(),
      cat: category,
      r: computeRarity(trimmed),
      d: now,
    };
    next[key] = entry;
    added.push(entry);
  }
  return { next, added };
}
