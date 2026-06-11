// Shared cosmetic helpers used by the player profile and the dedicated Tienda
// page. Keep the legendary-frame map in sync with SHOP_ITEMS (server,
// inventoryCatalog.ts) and index.css (.frame-fx-* keyframes).

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
