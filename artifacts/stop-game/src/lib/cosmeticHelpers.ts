// Shared cosmetic helpers used by the player profile and the dedicated Tienda
// page. Keep the legendary-frame map in sync with SHOP_ITEMS (server,
// inventoryCatalog.ts) and index.css (.frame-fx-* keyframes).

export const AVATAR_GLYPH_BY_ID: Record<string, string> = {
  avatar_premium_5: "🎯", avatar_premium_10: "🔥", avatar_premium_15: "⚡",
  avatar_premium_20: "🌟", avatar_premium_25: "👑", avatar_premium_30: "💎",
  avatar_shop_rocket: "🚀", avatar_shop_pizza: "🍕", avatar_shop_burger: "🍔",
  avatar_shop_cat: "🐱", avatar_shop_dog: "🐶", avatar_shop_alien: "👽",
  avatar_shop_unicorn: "🦄", avatar_shop_ghost: "👻", avatar_shop_ninja: "🥷",
  avatar_shop_robot: "🤖", avatar_shop_flower: "🌸", avatar_shop_fox: "🦊",
  avatar_shop_clown: "🤡", avatar_shop_gamepad: "🎮", avatar_shop_butterfly: "🦋",
  avatar_shop_owl: "🦉", avatar_shop_panda: "🐼", avatar_shop_star: "✨",
  avatar_shop_octopus: "🐙", avatar_shop_skull: "💀", avatar_shop_lion: "🦁",
  avatar_shop_tiger: "🐯", avatar_shop_devil: "😈", avatar_shop_angel: "😇",
  avatar_shop_pirate: "🏴‍☠️", avatar_shop_dragon: "🐉", avatar_shop_rainbow: "🌈",
  avatar_shop_wizard: "🧙", avatar_shop_crystal: "🔮", avatar_shop_phoenix: "🦅",
  avatar_shop_money: "🤑", avatar_halloween_ghost: "👻", avatar_halloween_pumpkin: "🎃",
  avatar_halloween_vampire: "🧛", avatar_halloween_witch: "🧙‍♀️",
  avatar_wc_ball: "⚽", avatar_wc_jersey: "👕", avatar_wc_goal: "🥅",
  avatar_wc_gloves: "🧤", avatar_wc_boots: "👟", avatar_wc_medal: "🥇",
  avatar_wc_trophy: "🏆", avatar_wc_flag_es: "🇪🇸", avatar_wc_flag_br: "🇧🇷",
  avatar_wc_flag_ar: "🇦🇷", avatar_wc_flag_fr: "🇫🇷", avatar_wc_flag_de: "🇩🇪",
  avatar_wc_flag_pt: "🇵🇹", avatar_wc_flag_it: "🇮🇹", avatar_wc_flag_nl: "🇳🇱",
  avatar_wc_flag_mx: "🇲🇽", avatar_wc_flag_us: "🇺🇸", avatar_wc_flag_uy: "🇺🇾",
  avatar_wc_flag_co: "🇨🇴", avatar_wc_flag_jp: "🇯🇵",
};

// Marcos legendarios → clase CSS de animación aplicada al aro del avatar.
export const LEGENDARY_FRAME_FX: Record<string, string> = {
  frame_shop_fuego:   "frame-fx-fuego",
  frame_shop_rayo:    "frame-fx-rayo",
  frame_shop_lava:    "frame-fx-lava",
  frame_shop_galaxia: "frame-fx-galaxia",
  // Marcos exclusivos de recompensa (no comprables) — también animados para que
  // se sientan especiales. Mantener en sync con index.css (.frame-fx-*).
  frame_collection_hunter:   "frame-fx-hunter",
  frame_collection_legend:   "frame-fx-legend",
  frame_collection_master:   "frame-fx-master",
  frame_collection_explorer: "frame-fx-explorer",
  frame_collection_mythic:   "frame-fx-mythic",
  frame_prestige_bronze:     "frame-fx-bronze",
  frame_prestige_silver:     "frame-fx-silver",
  frame_prestige_gold:       "frame-fx-gold",
  frame_prestige_diamond:    "frame-fx-diamond",
};

export function isLegendaryFrame(id?: string | null): boolean {
  return !!id && id in LEGENDARY_FRAME_FX;
}

// "5h 12m" / "47m" until the next daily-deal reset (00:00 UTC).
export function formatCountdown(msUntil: number): string {
  if (msUntil <= 0) return "muy pronto";
  const totalMin = Math.floor(msUntil / 60000);
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}
