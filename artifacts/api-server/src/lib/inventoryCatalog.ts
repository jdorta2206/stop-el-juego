// ── Cosmetic catalog & coin shop ───────────────────────────────────────────
// All cosmetics players can own come from one of two sources:
//   1) Season Pass tier rewards (free or premium track)  — see seasonConfig.tierReward()
//   2) The coin shop                                    — see SHOP_ITEMS below
//
// IDs are namespaced so we can tell them apart (and so a free tier reward
// can't accidentally collide with a premium one). The frontend uses the
// `label` and `glyph` fields to render them; nothing on the server side
// needs the visuals.

export type CosmeticKind = "avatar" | "frame" | "background";

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
  // ── Avatares ────────────────────────────────────────────────────────────
  // Solo necesitan un emoji (glyph); el cliente lo pinta. Precios variados
  // para que siempre haya algo asequible y algo aspiracional.
  { id: "avatar_shop_rocket",   kind: "avatar", label: "Avatar Cohete",     glyph: "🚀", price: 200 },
  { id: "avatar_shop_pizza",    kind: "avatar", label: "Avatar Pizza",      glyph: "🍕", price: 200 },
  { id: "avatar_shop_burger",   kind: "avatar", label: "Avatar Hamburguesa",glyph: "🍔", price: 200 },
  { id: "avatar_shop_cat",      kind: "avatar", label: "Avatar Gato",       glyph: "🐱", price: 250 },
  { id: "avatar_shop_dog",      kind: "avatar", label: "Avatar Perro",      glyph: "🐶", price: 250 },
  { id: "avatar_shop_alien",    kind: "avatar", label: "Avatar Alien",      glyph: "👽", price: 250 },
  { id: "avatar_shop_unicorn",  kind: "avatar", label: "Avatar Unicornio",  glyph: "🦄", price: 300 },
  { id: "avatar_shop_ghost",    kind: "avatar", label: "Avatar Fantasma",   glyph: "👻", price: 300 },
  { id: "avatar_shop_ninja",    kind: "avatar", label: "Avatar Ninja",      glyph: "🥷", price: 350 },
  { id: "avatar_shop_robot",    kind: "avatar", label: "Avatar Robot",      glyph: "🤖", price: 350 },
  { id: "avatar_shop_flower",   kind: "avatar", label: "Avatar Flor",       glyph: "🌸", price: 350 },
  { id: "avatar_shop_fox",      kind: "avatar", label: "Avatar Zorro",      glyph: "🦊", price: 400 },
  { id: "avatar_shop_clown",    kind: "avatar", label: "Avatar Payaso",     glyph: "🤡", price: 400 },
  { id: "avatar_shop_gamepad",  kind: "avatar", label: "Avatar Mando",      glyph: "🎮", price: 400 },
  { id: "avatar_shop_butterfly",kind: "avatar", label: "Avatar Mariposa",   glyph: "🦋", price: 500 },
  { id: "avatar_shop_owl",      kind: "avatar", label: "Avatar Búho",       glyph: "🦉", price: 500 },
  { id: "avatar_shop_panda",    kind: "avatar", label: "Avatar Panda",      glyph: "🐼", price: 600 },
  { id: "avatar_shop_star",     kind: "avatar", label: "Avatar Estrella",   glyph: "✨", price: 600 },
  { id: "avatar_shop_octopus",  kind: "avatar", label: "Avatar Pulpo",      glyph: "🐙", price: 700 },
  { id: "avatar_shop_skull",    kind: "avatar", label: "Avatar Calavera",   glyph: "💀", price: 700 },
  { id: "avatar_shop_lion",     kind: "avatar", label: "Avatar León",       glyph: "🦁", price: 800 },
  { id: "avatar_shop_tiger",    kind: "avatar", label: "Avatar Tigre",      glyph: "🐯", price: 800 },
  { id: "avatar_shop_devil",    kind: "avatar", label: "Avatar Diablillo",  glyph: "😈", price: 900 },
  { id: "avatar_shop_angel",    kind: "avatar", label: "Avatar Ángel",      glyph: "😇", price: 900 },
  { id: "avatar_shop_pirate",   kind: "avatar", label: "Avatar Pirata",     glyph: "🏴‍☠️", price: 1000 },
  { id: "avatar_shop_dragon",   kind: "avatar", label: "Avatar Dragón",     glyph: "🐉", price: 1200 },
  { id: "avatar_shop_rainbow",  kind: "avatar", label: "Avatar Arcoíris",   glyph: "🌈", price: 1200 },
  { id: "avatar_shop_wizard",   kind: "avatar", label: "Avatar Mago",       glyph: "🧙", price: 1500 },
  { id: "avatar_shop_crystal",  kind: "avatar", label: "Avatar Bola Mágica",glyph: "🔮", price: 2000 },
  { id: "avatar_shop_phoenix",  kind: "avatar", label: "Avatar Fénix",      glyph: "🦅", price: 2500 },
  { id: "avatar_shop_money",    kind: "avatar", label: "Avatar Millonario", glyph: "🤑", price: 5000 },

  // ── Marcos estáticos (aro de color) ──────────────────────────────────────
  // Solo necesitan color en el cliente (FRAME_COLORS_BY_ID); sin CSS extra.
  { id: "frame_shop_neon",      kind: "frame",  label: "Marco Neón",      glyph: "▣", color: "#22d3ee", price: 400 },
  { id: "frame_shop_plata",     kind: "frame",  label: "Marco Plata",     glyph: "▣", color: "#94a3b8", price: 500 },
  { id: "frame_shop_esmeralda", kind: "frame",  label: "Marco Esmeralda", glyph: "▣", color: "#10b981", price: 600 },
  { id: "frame_shop_menta",     kind: "frame",  label: "Marco Menta",     glyph: "▣", color: "#34d399", price: 600 },
  { id: "frame_shop_coral",     kind: "frame",  label: "Marco Coral",     glyph: "▣", color: "#fb7185", price: 700 },
  { id: "frame_shop_rosa",      kind: "frame",  label: "Marco Rosa",      glyph: "▣", color: "#ec4899", price: 700 },
  { id: "frame_shop_rubi",      kind: "frame",  label: "Marco Rubí",      glyph: "▣", color: "#e11d48", price: 800 },
  { id: "frame_shop_zafiro",    kind: "frame",  label: "Marco Zafiro",    glyph: "▣", color: "#2563eb", price: 800 },
  { id: "frame_shop_indigo",    kind: "frame",  label: "Marco Índigo",    glyph: "▣", color: "#6366f1", price: 900 },
  { id: "frame_shop_amatista",  kind: "frame",  label: "Marco Amatista",  glyph: "▣", color: "#9333ea", price: 1000 },
  { id: "frame_shop_dorado",    kind: "frame",  label: "Marco Dorado",    glyph: "▣", color: "#f59e0b", price: 1500 },

  // ── Fondos (backgrounds) ─────────────────────────────────────────────────
  // Categoría nueva: el cliente pinta un degradado por id (BACKGROUND_CSS_BY_ID).
  // El servidor solo necesita label/glyph/price; color = tono representativo.
  { id: "bg_shop_noche",     kind: "background", label: "Fondo Noche",     glyph: "🌙", color: "#1e3a8a", price: 1000 },
  { id: "bg_shop_caramelo",  kind: "background", label: "Fondo Caramelo",  glyph: "🍬", color: "#f472b6", price: 1200 },
  { id: "bg_shop_atardecer", kind: "background", label: "Fondo Atardecer", glyph: "🌅", color: "#f97316", price: 1500 },
  { id: "bg_shop_oceano",    kind: "background", label: "Fondo Océano",    glyph: "🌊", color: "#0ea5e9", price: 1500 },
  { id: "bg_shop_bosque",    kind: "background", label: "Fondo Bosque",    glyph: "🌲", color: "#16a34a", price: 1500 },
  { id: "bg_shop_neon",      kind: "background", label: "Fondo Neón",      glyph: "💜", color: "#d946ef", price: 1800 },
  { id: "bg_shop_galaxia",   kind: "background", label: "Fondo Galaxia",   glyph: "🌌", color: "#7c3aed", price: 2000 },
  { id: "bg_shop_aurora",    kind: "background", label: "Fondo Aurora",    glyph: "🌈", color: "#22d3ee", price: 2500 },
  { id: "bg_shop_fuego",     kind: "background", label: "Fondo Fuego",     glyph: "🔥", color: "#ef4444", price: 3000 },
  { id: "bg_shop_oro",       kind: "background", label: "Fondo Oro",       glyph: "👑", color: "#fbbf24", price: 5000 },

  // ── ⚽ ESPECIAL MUNDIAL ───────────────────────────────────────────────────
  // Evento del Mundial de fútbol. IDs con `_wc_` para que el cliente los
  // agrupe en su propia sección. Avatares de fútbol + banderas de selecciones,
  // marcos y fondos temáticos. Todo comprable con monedas.
  { id: "avatar_wc_ball",    kind: "avatar", label: "Avatar Balón",        glyph: "⚽", price: 200 },
  { id: "avatar_wc_jersey",  kind: "avatar", label: "Avatar Camiseta",     glyph: "👕", price: 300 },
  { id: "avatar_wc_goal",    kind: "avatar", label: "Avatar Portería",     glyph: "🥅", price: 300 },
  { id: "avatar_wc_gloves",  kind: "avatar", label: "Avatar Guantes",      glyph: "🧤", price: 350 },
  { id: "avatar_wc_boots",   kind: "avatar", label: "Avatar Botas",        glyph: "👟", price: 350 },
  { id: "avatar_wc_medal",   kind: "avatar", label: "Avatar Medalla",      glyph: "🥇", price: 800 },
  { id: "avatar_wc_trophy",  kind: "avatar", label: "Avatar Copa Mundial", glyph: "🏆", price: 1500 },
  // Banderas de selecciones
  { id: "avatar_wc_flag_es", kind: "avatar", label: "Selección España",       glyph: "🇪🇸", price: 400 },
  { id: "avatar_wc_flag_br", kind: "avatar", label: "Selección Brasil",       glyph: "🇧🇷", price: 400 },
  { id: "avatar_wc_flag_ar", kind: "avatar", label: "Selección Argentina",    glyph: "🇦🇷", price: 400 },
  { id: "avatar_wc_flag_fr", kind: "avatar", label: "Selección Francia",      glyph: "🇫🇷", price: 400 },
  { id: "avatar_wc_flag_de", kind: "avatar", label: "Selección Alemania",     glyph: "🇩🇪", price: 400 },
  { id: "avatar_wc_flag_pt", kind: "avatar", label: "Selección Portugal",     glyph: "🇵🇹", price: 400 },
  { id: "avatar_wc_flag_it", kind: "avatar", label: "Selección Italia",       glyph: "🇮🇹", price: 400 },
  { id: "avatar_wc_flag_nl", kind: "avatar", label: "Selección Países Bajos", glyph: "🇳🇱", price: 400 },
  { id: "avatar_wc_flag_mx", kind: "avatar", label: "Selección México",       glyph: "🇲🇽", price: 400 },
  { id: "avatar_wc_flag_us", kind: "avatar", label: "Selección EE. UU.",      glyph: "🇺🇸", price: 400 },
  { id: "avatar_wc_flag_uy", kind: "avatar", label: "Selección Uruguay",      glyph: "🇺🇾", price: 400 },
  { id: "avatar_wc_flag_co", kind: "avatar", label: "Selección Colombia",     glyph: "🇨🇴", price: 400 },
  { id: "avatar_wc_flag_jp", kind: "avatar", label: "Selección Japón",        glyph: "🇯🇵", price: 400 },
  // Marcos del Mundial
  { id: "frame_wc_cesped", kind: "frame", label: "Marco Césped", glyph: "▣", color: "#16a34a", price: 600 },
  { id: "frame_wc_espana", kind: "frame", label: "Marco España", glyph: "▣", color: "#dc2626", price: 800 },
  { id: "frame_wc_copa",   kind: "frame", label: "Marco Copa",   glyph: "▣", color: "#f59e0b", price: 1200 },
  // Fondos del Mundial
  { id: "bg_wc_cesped", kind: "background", label: "Fondo Estadio",       glyph: "⚽",  color: "#16a34a", price: 1500 },
  { id: "bg_wc_noche",  kind: "background", label: "Fondo Estadio Noche", glyph: "🏟️", color: "#1e3a8a", price: 1500 },
  { id: "bg_wc_espana", kind: "background", label: "Fondo España",        glyph: "🇪🇸", color: "#dc2626", price: 2000 },
  { id: "bg_wc_copa",   kind: "background", label: "Fondo Mundial",       glyph: "🏆", color: "#fbbf24", price: 2500 },

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
