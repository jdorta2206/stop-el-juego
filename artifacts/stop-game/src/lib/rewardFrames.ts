// Frontend mirror of the server's REWARD_FRAMES (api-server inventoryCatalog.ts).
// Names the exclusive, unbuyable reward frames so reward rows can tell the player
// EXACTLY which frame they will earn (instead of a generic "marco exclusivo").
// Keep id → label/glyph in sync with the server catalog.
export const REWARD_FRAME_META: Record<string, { label: string; glyph: string }> = {
  frame_collection_hunter:   { label: "Marco Cazador de Palabras", glyph: "🔎" },
  frame_collection_legend:   { label: "Marco Coleccionista",       glyph: "📖" },
  frame_collection_master:   { label: "Marco Erudito",             glyph: "📚" },
  frame_collection_explorer: { label: "Marco Explorador",          glyph: "🧭" },
  frame_collection_mythic:   { label: "Marco Mítico",              glyph: "🦄" },
  frame_prestige_bronze:     { label: "Marco Leyenda Bronce",   glyph: "🥉" },
  frame_prestige_silver:     { label: "Marco Leyenda Plata",    glyph: "🥈" },
  frame_prestige_gold:       { label: "Marco Leyenda Oro",      glyph: "🥇" },
  frame_prestige_diamond:    { label: "Marco Leyenda Diamante", glyph: "💠" },
};

/** Display name for a reward frame id; falls back to a generic label. */
export function rewardFrameName(id?: string | null): string {
  return (id && REWARD_FRAME_META[id]?.label) || "marco exclusivo";
}
