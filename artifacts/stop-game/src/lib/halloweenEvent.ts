export const HALLOWEEN_START = "2026-10-15T00:00:00";
export const HALLOWEEN_END = "2026-11-03T00:00:00";

export const HALLOWEEN_CATEGORIES = {
  es: ["Disfraz de miedo", "Monstruo", "Película de terror", "Cosa de una casa encantada", "Criatura sobrenatural"],
  en: ["Scary costume", "Monster", "Horror movie", "Haunted house item", "Supernatural creature"],
  pt: ["Fantasia assustadora", "Monstro", "Filme de terror", "Coisa de uma casa assombrada", "Criatura sobrenatural"],
  fr: ["Déguisement effrayant", "Monstre", "Film d'horreur", "Objet d'une maison hantée", "Créature surnaturelle"],
} as const;

export const isHalloweenPreview = (): boolean => import.meta.env.VITE_HALLOWEEN_PREVIEW === "true";

export type HalloweenScareId = "clown" | "nightmare" | "specter" | "stranger";

export interface HalloweenScare {
  id: HalloweenScareId;
  title: string;
  text: string;
}

export const HALLOWEEN_SCARES: Record<string, HalloweenScare[]> = {
  es: [
    { id: "clown", title: "NO MIRES", text: "Algo está demasiado cerca..." },
    { id: "nightmare", title: "DESPIERTA", text: "No estás solo..." },
    { id: "specter", title: "¿LO HAS VISTO?", text: "Acaba de aparecer..." },
    { id: "stranger", title: "TE ESTÁ MIRANDO", text: "No apartes la vista..." },
  ],
  en: [
    { id: "clown", title: "DON'T LOOK", text: "Something is too close..." },
    { id: "nightmare", title: "WAKE UP", text: "You are not alone..." },
    { id: "specter", title: "DID YOU SEE IT?", text: "Something appeared..." },
    { id: "stranger", title: "IT'S WATCHING", text: "Don't look away..." },
  ],
  pt: [
    { id: "clown", title: "NÃO OLHE", text: "Algo está perto demais..." },
    { id: "nightmare", title: "ACORDE", text: "Você não está sozinho..." },
    { id: "specter", title: "VOCÊ VIU?", text: "Algo apareceu..." },
    { id: "stranger", title: "ESTÁ OLHANDO", text: "Não desvie o olhar..." },
  ],
  fr: [
    { id: "clown", title: "NE REGARDE PAS", text: "Quelque chose est trop près..." },
    { id: "nightmare", title: "RÉVEILLE-TOI", text: "Tu n'es pas seul..." },
    { id: "specter", title: "TU L'AS VU?", text: "Quelque chose est apparu..." },
    { id: "stranger", title: "IL TE REGARDE", text: "Ne détourne pas les yeux..." },
  ],
};
export function isHalloweenActive(now = new Date()): boolean {
  if (isHalloweenPreview()) return true;
  const start = new Date(HALLOWEEN_START);
  const end = new Date(HALLOWEEN_END);
  return now >= start && now < end;
}

export function getHalloweenLabel(lang: string): string {
  const labels: Record<string, string> = { es: "HALLOWEEN", en: "HALLOWEEN", pt: "HALLOWEEN", fr: "HALLOWEEN" };
  return labels[lang] ?? labels.es;
}

export function getHalloweenSubtitle(lang: string): string {
  const subtitles: Record<string, string> = { es: "El terror ha comenzado", en: "The terror has begun", pt: "O terror começou", fr: "La terreur a commencé" };
  return subtitles[lang] ?? subtitles.es;
}

export function getHalloweenCategory(lang: string, seed = Math.random()): string {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = HALLOWEEN_CATEGORIES[key];
  const safeSeed = Math.max(0, Math.min(0.999999, seed));
  return list[Math.floor(safeSeed * list.length)];
}

export function applyHalloweenCategory(
  categories: string[],
  lang: string,
  options: { enabled?: boolean; seed?: number } = {},
): string[] {
  if (!isHalloweenActive() || options.enabled === false || categories.length === 0) {
    return categories;
  }
  const result = [...categories];
  const seed = options.seed ?? Math.random();
  const idx = Math.floor(Math.max(0, Math.min(0.999999, seed)) * result.length);
  result[idx] = getHalloweenCategory(lang, seed);
  return result;
}

export function getHalloweenLabel(lang: string): string {
  const labels: Record<string, string> = { es: "HALLOWEEN", en: "HALLOWEEN", pt: "HALLOWEEN", fr: "HALLOWEEN" };
  return labels[lang] ?? labels.es;
}

export function getHalloweenSubtitle(lang: string): string {
  const subtitles: Record<string, string> = { es: "El terror ha comenzado", en: "The terror has begun", pt: "O terror começou", fr: "La terreur a commencé" };
  return subtitles[lang] ?? subtitles.es;
}

export function getHalloweenScare(lang: string, seed = Math.random()): HalloweenScare {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = HALLOWEEN_SCARES[key];
  const safeSeed = Math.max(0, Math.min(0.999999, seed));
  return list[Math.floor(safeSeed * list.length)];
}

export function getHalloweenScareById(lang: string, id: HalloweenScareId): HalloweenScare {
  const scares = HALLOWEEN_SCARES[lang] ?? HALLOWEEN_SCARES.es;
  return scares.find((scare) => scare.id === id) ?? scares[0];
}
