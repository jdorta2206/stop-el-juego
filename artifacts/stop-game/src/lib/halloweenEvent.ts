export const HALLOWEEN_START = "2026-10-15T00:00:00";
export const HALLOWEEN_END = "2026-11-03T00:00:00";

export const HALLOWEEN_CATEGORIES = {
  es: ["Disfraz de miedo", "Monstruo", "Película de terror", "Cosa de una casa encantada", "Criatura sobrenatural"],
  en: ["Scary costume", "Monster", "Horror movie", "Haunted house item", "Supernatural creature"],
  pt: ["Fantasia assustadora", "Monstro", "Filme de terror", "Coisa de uma casa assombrada", "Criatura sobrenatural"],
  fr: ["Déguisement effrayant", "Monstre", "Film d'horreur", "Objet d'une maison hantée", "Créature surnaturelle"],
} as const;

export function isHalloweenActive(now = new Date()): boolean {
  const start = new Date(HALLOWEEN_START);
  const end = new Date(HALLOWEEN_END);
  return now >= start && now < end;
}

export function getHalloweenCategory(lang: string, seed = Math.random()): string {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = HALLOWEEN_CATEGORIES[key];
  return list[Math.floor(Math.max(0, Math.min(0.999999, seed)) * list.length)];
}

/**
 * Adds exactly one Halloween category during the event.
 * Custom packs are deliberately left untouched so user-created packs keep
 * their exact contents. Daily mode can also opt out explicitly.
 */
export function applyHalloweenCategory(
  categories: string[],
  lang: string,
  options: { enabled?: boolean; seed?: number } = {},
): string[] {
  if (!isHalloweenActive() || options.enabled === false || categories.length === 0) {
    return categories;
  }
  const result = [...categories];
  const idx = Math.floor((options.seed ?? Math.random()) * result.length);
  result[idx] = getHalloweenCategory(lang, options.seed == null ? Math.random() : options.seed);
  return result;
}

export function getHalloweenLabel(lang: string): string {
  if (lang === "en") return "🎃 HALLOWEEN EVENT";
  if (lang === "pt") return "🎃 EVENTO DE HALLOWEEN";
  if (lang === "fr") return "🎃 ÉVÉNEMENT HALLOWEEN";
  return "🎃 EVENTO HALLOWEEN";
}

export function getHalloweenSubtitle(lang: string): string {
  if (lang === "en") return "One spooky category appears in every normal game.";
  if (lang === "pt") return "Uma categoria assustadora aparece em cada partida normal.";
  if (lang === "fr") return "Une catégorie terrifiante apparaît dans chaque partie normale.";
  return "Una categoría terrorífica aparece en cada partida normal.";
}


export function getHalloweenScare(lang: string, seed = Math.random()): HalloweenScare {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = SCARES[key];
  return list[Math.floor(Math.max(0, Math.min(0.999999, seed)) * list.length)];
}
