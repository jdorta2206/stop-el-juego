// ── Cosmetic catalog & coin shop ───────────────────────────────────────────
// All cosmetics players can own come from one of two sources:
//   1) Season Pass tier rewards (free or premium track)  — see seasonConfig.tierReward()
//   2) The coin shop                                    — see SHOP_ITEMS below
//
// IDs are namespaced so we can tell them apart (and so a free tier reward
// can't accidentally collide with a premium one). The frontend uses the
// `label` and `glyph` fields to render them; nothing on the server side
// needs the visuals.

export type CosmeticKind = "avatar" | "frame";

export interface CosmeticMeta {
  id: string;
  kind: CosmeticKind;
  label: string;
  /** Single emoji/character used by the frontend as the visual stand-in. */
  glyph: string;
  /** Optional CSS color used for frames (border) or avatar background. */
  color?: string;
}

const FRAME_COLORS = ["#cd7f32", "#c0c0c0", "#f9a825", "#67e8f9", "#a78bfa", "#f472b6"];
const FRAME_NAMES  = ["Bronce", "Plata",   "Oro",     "Diamante", "Maestro", "Leyenda"];
const AVATAR_GLYPHS = ["🎯", "🔥", "⚡", "🌟", "👑", "💎"];

/**
 * Resolve the metadata for any cosmetic the player can own. Covers BOTH
 * Season Pass-issued IDs (`frame_free_<tier>`, `avatar_premium_<tier>`)
 * AND shop IDs. Returns `null` for unknown IDs so callers can fail closed.
 */
export function resolveCosmetic(id: string): CosmeticMeta | null {
  // Season Pass — free track frames at tier 5,10,15,20,25,30
  let m = id.match(/^frame_free_(\d+)$/);
  if (m) {
    const tier = Number(m[1]);
    const idx = Math.floor(tier / 5) - 1;
    if (idx < 0) return null;
    return {
      id, kind: "frame",
      label: `Marco ${FRAME_NAMES[idx % FRAME_NAMES.length]}`,
      glyph: "▣",
      color: FRAME_COLORS[idx % FRAME_COLORS.length],
    };
  }
  // Season Pass — premium track avatars at tier 5,10,15,20,25,30
  m = id.match(/^avatar_premium_(\d+)$/);
  if (m) {
    const tier = Number(m[1]);
    const idx = Math.floor(tier / 5) - 1;
    if (idx < 0) return null;
    return {
      id, kind: "avatar",
      label: `Avatar ${AVATAR_GLYPHS[idx % AVATAR_GLYPHS.length]}`,
      glyph: AVATAR_GLYPHS[idx % AVATAR_GLYPHS.length],
    };
  }
  // Legend of the Pass — single static frame awarded at Tier 30 premium.
  if (id === "frame_legend_t30") {
    return {
      id, kind: "frame",
      label: "Marco Leyenda del Pase",
      glyph: "✦",
      color: "#fbbf24",
    };
  }
  // Champion frames awarded to season top-3 — id shape: `frame_champion_s<seasonId>_r<rank>`
  m = id.match(/^frame_champion_s(\d+)_r([1-3])$/);
  if (m) {
    const seasonId = Number(m[1]);
    const rank = Number(m[2]);
    const meta = CHAMPION_FRAMES[rank - 1];
    return {
      id, kind: "frame",
      label: `${meta.label} S${seasonId}`,
      glyph: meta.glyph,
      color: meta.color,
    };
  }
  // Reward-only frames (collection sets + prestige milestones). NOT in
  // SHOP_ITEMS, so they can't be bought — only earned. Visuals (animated)
  // resolved client-side by id; the server only needs label/glyph/color.
  const reward = REWARD_FRAMES[id];
  if (reward) return { id, kind: "frame", label: reward.label, glyph: reward.glyph, color: reward.color };
  // Shop items
  const shop = SHOP_ITEMS.find((s) => s.id === id);
  if (shop) return { id: shop.id, kind: shop.kind, label: shop.label, glyph: shop.glyph, color: shop.color };
  return null;
}

// ── Reward-only frames (unbuyable; earned via collection sets / prestige) ───
// Keep the client mirror (PlayerProfile.tsx FRAME_VISUALS) in sync with these.
export const REWARD_FRAMES: Record<string, { label: string; glyph: string; color: string }> = {
  // Collection sets
  frame_collection_hunter:  { label: "Marco Cazador de Palabras", glyph: "🔎", color: "#38bdf8" },
  frame_collection_legend:  { label: "Marco Coleccionista",       glyph: "📖", color: "#f472b6" },
  frame_collection_master:  { label: "Marco Erudito",             glyph: "📚", color: "#06b6d4" },
  frame_collection_explorer:{ label: "Marco Explorador",          glyph: "🧭", color: "#22c55e" },
  frame_collection_mythic:  { label: "Marco Mítico",              glyph: "🦄", color: "#a855f7" },
  // Prestige milestones
  frame_prestige_bronze:   { label: "Marco Leyenda Bronce",   glyph: "🥉", color: "#cd7f32" },
  frame_prestige_silver:   { label: "Marco Leyenda Plata",    glyph: "🥈", color: "#cbd5e1" },
  frame_prestige_gold:     { label: "Marco Leyenda Oro",      glyph: "🥇", color: "#fbbf24" },
  frame_prestige_diamond:  { label: "Marco Leyenda Diamante", glyph: "💠", color: "#67e8f9" },
};

// ── Champion frames (top 3 of a season) ─────────────────────────────────────
// Awarded automatically by season rollover. Visuals shared across seasons —
// only the season number in the label changes.
const CHAMPION_FRAMES = [
  { label: "Marco Campeón Oro",   glyph: "▣", color: "#fbbf24" },
  { label: "Marco Campeón Plata", glyph: "▣", color: "#cbd5e1" },
  { label: "Marco Campeón Bronce",glyph: "▣", color: "#cd7f32" },
];

export function championFrameId(seasonId: number, rank: 1 | 2 | 3): string {
  return `frame_champion_s${seasonId}_r${rank}`;
}

// ── Coin shop ──────────────────────────────────────────────────────────────
// Small, hand-curated catalog so coins always have a use even for players
// who don't want to wait for the next Season Pass milestone.
export interface ShopItem extends CosmeticMeta {
  /** Coin price; deducted on purchase. */
  price: number;
}

export const SHOP_ITEMS: ShopItem[] = [
  { id: "avatar_shop_rocket",  kind: "avatar", label: "Avatar Cohete",   glyph: "🚀", price: 200 },
  { id: "avatar_shop_unicorn", kind: "avatar", label: "Avatar Unicornio", glyph: "🦄", price: 300 },
  { id: "avatar_shop_alien",   kind: "avatar", label: "Avatar Alien",    glyph: "👽", price: 250 },
  { id: "frame_shop_neon",     kind: "frame",  label: "Marco Neón",      glyph: "▣",  color: "#22d3ee", price: 400 },
  // ── Marcos legendarios (animados) — sumideros de monedas de largo plazo ──
  // Visuales animados resueltos en el cliente por id (ver PlayerProfile.tsx).
  // El servidor solo necesita label/glyph/color/price; el efecto es CSS.
  { id: "frame_shop_fuego",    kind: "frame",  label: "Marco Fuego",     glyph: "🔥", color: "#fb923c", price: 25000 },
  { id: "frame_shop_rayo",     kind: "frame",  label: "Marco Rayo",      glyph: "⚡", color: "#38bdf8", price: 50000 },
  { id: "frame_shop_lava",     kind: "frame",  label: "Marco Lava",      glyph: "🌋", color: "#ef4444", price: 100000 },
  { id: "frame_shop_galaxia",  kind: "frame",  label: "Marco Galaxia",   glyph: "🌌", color: "#a855f7", price: 250000 },
];

export function shopItem(id: string): ShopItem | null {
  return SHOP_ITEMS.find((s) => s.id === id) ?? null;
}
