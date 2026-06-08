// ── Recompensas por colección ──────────────────────────────────────────────
// Closes the collection loop: completing "sets" (thresholds over the words a
// player has discovered) grants coins + EXCLUSIVE frames (unbuyable). Sets are
// evaluated SERVER-SIDE from the player's stored collected_words_json so the
// claim can't be spoofed by claiming a set you haven't completed. (The words
// themselves are client-merged, so coin payouts here are one-time + moderate;
// the headline reward is the exclusive cosmetic.)

type Rarity = "common" | "rare" | "epic" | "legendary";

interface StoredWord {
  name?: string;
  cat?: string;
  r?: Rarity;
  d?: number;
}

export interface CollectionStats {
  total: number;
  byRarity: Record<Rarity, number>;
  distinctCategories: number;
}

/** Reward for a collection set: coins and/or an exclusive frame id. */
export interface SetReward {
  coins?: number;
  frame?: string;
}

export interface CollectionSet {
  id: string;
  label: string;
  icon: string;
  desc: string;
  /** Current progress + target are derived from CollectionStats. */
  progress: (s: CollectionStats) => number;
  target: number;
  reward: SetReward;
}

/** Parse + tally the server's stored collected_words_json map. Defensive: any
 *  malformed entry is skipped, never thrown. */
export function computeCollectionStats(raw: string | null | undefined): CollectionStats {
  const byRarity: Record<Rarity, number> = { common: 0, rare: 0, epic: 0, legendary: 0 };
  const cats = new Set<string>();
  let total = 0;
  try {
    const map = JSON.parse(raw || "{}") as Record<string, StoredWord>;
    for (const key of Object.keys(map)) {
      const w = map[key];
      if (!w || typeof w !== "object") continue;
      total++;
      const r = w.r;
      if (r === "common" || r === "rare" || r === "epic" || r === "legendary") byRarity[r]++;
      const cat = (w.cat ?? "").trim().toLowerCase();
      if (cat) cats.add(cat);
    }
  } catch {
    /* keep zeros */
  }
  return { total, byRarity, distinctCategories: cats.size };
}

export const COLLECTION_SETS: CollectionSet[] = [
  // Total milestones
  { id: "total_50",   label: "Aprendiz de Palabras", icon: "🌱", desc: "Colecciona 50 palabras.",  progress: (s) => s.total, target: 50,   reward: { coins: 500 } },
  { id: "total_150",  label: "Lexicógrafo",          icon: "📝", desc: "Colecciona 150 palabras.", progress: (s) => s.total, target: 150,  reward: { coins: 1500 } },
  { id: "total_400",  label: "Erudito",              icon: "📚", desc: "Colecciona 400 palabras.", progress: (s) => s.total, target: 400,  reward: { coins: 5000, frame: "frame_collection_master" } },
  { id: "total_1000", label: "Maestro del Léxico",   icon: "🦄", desc: "Colecciona 1000 palabras.",progress: (s) => s.total, target: 1000, reward: { coins: 25000, frame: "frame_collection_mythic" } },
  // Rarity sets
  { id: "rare_50",      label: "Cazador de Raras",   icon: "⭐", desc: "Colecciona 50 palabras raras.",        progress: (s) => s.byRarity.rare,      target: 50, reward: { coins: 1500, frame: "frame_collection_hunter" } },
  { id: "epic_25",      label: "Cazador Épico",      icon: "🔥", desc: "Colecciona 25 palabras épicas.",       progress: (s) => s.byRarity.epic,      target: 25, reward: { coins: 3000 } },
  { id: "legendary_10", label: "Coleccionista",      icon: "✨", desc: "Colecciona 10 palabras legendarias.",  progress: (s) => s.byRarity.legendary, target: 10, reward: { coins: 4000, frame: "frame_collection_legend" } },
  // Variety sets (distinct categories)
  { id: "cats_8",  label: "Curioso",    icon: "🔎", desc: "Palabras en 8 categorías distintas.",  progress: (s) => s.distinctCategories, target: 8,  reward: { coins: 1000 } },
  { id: "cats_12", label: "Explorador", icon: "🧭", desc: "Palabras en 12 categorías distintas.", progress: (s) => s.distinctCategories, target: 12, reward: { coins: 2500, frame: "frame_collection_explorer" } },
];

const SET_BY_ID = new Map(COLLECTION_SETS.map((s) => [s.id, s]));
export function collectionSetById(id: string): CollectionSet | null {
  return SET_BY_ID.get(id) ?? null;
}

export interface CollectionSetView {
  id: string;
  label: string;
  icon: string;
  desc: string;
  progress: number;
  target: number;
  complete: boolean;
  claimed: boolean;
  reward: SetReward;
}

/** Annotate every set with the player's progress + claim state. */
export function evaluateCollectionSets(stats: CollectionStats, claimedIds: string[]): CollectionSetView[] {
  const claimed = new Set(claimedIds);
  return COLLECTION_SETS.map((s) => {
    const progress = Math.max(0, Math.min(s.progress(stats), s.target));
    return {
      id: s.id,
      label: s.label,
      icon: s.icon,
      desc: s.desc,
      progress,
      target: s.target,
      complete: s.progress(stats) >= s.target,
      claimed: claimed.has(s.id),
      reward: s.reward,
    };
  });
}

export function isSetComplete(setId: string, stats: CollectionStats): boolean {
  const set = collectionSetById(setId);
  return set ? set.progress(stats) >= set.target : false;
}
