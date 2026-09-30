import { pickHalloweenScareVisual } from "@/lib/halloweenScareAssets";

export const HALLOWEEN_START_MONTH = 9;
export const HALLOWEEN_START_DAY = 15;
export const HALLOWEEN_END_MONTH = 10;
export const HALLOWEEN_END_DAY = 3; // exclusive: event includes November 2

/** Recurring annual Halloween window. The event runs Oct 15 through Nov 2 inclusive. */
export function getHalloweenWindow(year: number): { start: Date; end: Date } {
  return {
    start: new Date(Date.UTC(year, HALLOWEEN_START_MONTH, HALLOWEEN_START_DAY)),
    end: new Date(Date.UTC(year, HALLOWEEN_END_MONTH, HALLOWEEN_END_DAY)),
  };
}

export const HALLOWEEN_CATEGORIES = {
  es: ["Disfraz de miedo", "Monstruo", "Película de terror", "Cosa de una casa encantada", "Criatura sobrenatural"],
  en: ["Scary costume", "Monster", "Horror movie", "Haunted house item", "Supernatural creature"],
  pt: ["Fantasia assustadora", "Monstro", "Filme de terror", "Coisa de uma casa assombrada", "Criatura sobrenatural"],
  fr: ["Déguisement effrayant", "Monstre", "Film d'horreur", "Objet d'une maison hantée", "Créature surnaturelle"],
} as const;

export const isHalloweenPreview = (): boolean => import.meta.env.VITE_HALLOWEEN_PREVIEW === "true";

export type HalloweenScareId = "clown" | "horrorMask" | "hauntedDoll" | "creepyDoll" | "demonMask";

export interface HalloweenScare {
  id: HalloweenScareId;
  title: string;
  text: string;
}

export const HALLOWEEN_SCARES: Record<string, HalloweenScare[]> = {
  es: [
    { id: "clown", title: "NO MIRES", text: "Algo está demasiado cerca..." },
    { id: "horrorMask", title: "NO ESTÁS SOLO", text: "No apartes la vista..." },
    { id: "hauntedDoll", title: "TE ESTÁ MIRANDO", text: "¿Lo has visto?" },
    { id: "creepyDoll", title: "DEMASIADO CERCA", text: "Acaba de aparecer..." },
    { id: "demonMask", title: "NO TE GÍRES", text: "Sigue jugando..." },
  ],
  en: [
    { id: "clown", title: "DON'T LOOK", text: "Something is too close..." },
    { id: "horrorMask", title: "YOU ARE NOT ALONE", text: "Don't look away..." },
    { id: "hauntedDoll", title: "IT'S WATCHING", text: "Did you see it?" },
    { id: "creepyDoll", title: "TOO CLOSE", text: "Something appeared..." },
    { id: "demonMask", title: "DON'T TURN AROUND", text: "Keep playing..." },
  ],
  pt: [
    { id: "clown", title: "NÃO OLHE", text: "Algo está perto demais..." },
    { id: "horrorMask", title: "VOCÊ NÃO ESTÁ SOZINHO", text: "Não desvie o olhar..." },
    { id: "hauntedDoll", title: "ESTÁ OLHANDO", text: "Você viu?" },
    { id: "creepyDoll", title: "PERTO DEMAIS", text: "Algo apareceu..." },
    { id: "demonMask", title: "NÃO SE VIRE", text: "Continue jogando..." },
  ],
  fr: [
    { id: "clown", title: "NE REGARDE PAS", text: "Quelque chose est trop près..." },
    { id: "horrorMask", title: "TU N'ES PAS SEUL", text: "Ne détourne pas les yeux..." },
    { id: "hauntedDoll", title: "IL TE REGARDE", text: "Tu l'as vu ?" },
    { id: "creepyDoll", title: "TROP PRÈS", text: "Quelque chose est apparu..." },
    { id: "demonMask", title: "NE TE RETOURNE PAS", text: "Continue à jouer..." },
  ],
};

export function isHalloweenActive(now = new Date()): boolean {
  if (isHalloweenPreview()) return true;
  const { start, end } = getHalloweenWindow(now.getUTCFullYear());
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

export function applyHalloweenCategory(categories: string[], lang: string, options: { enabled?: boolean; seed?: number } = {}): string[] {
  if (!isHalloweenActive() || !isHalloweenModeEnabled() || options.enabled === false || categories.length === 0) return categories;
  const result = [...categories];
  const seed = options.seed ?? Math.random();
  const idx = Math.floor(Math.max(0, Math.min(0.999999, seed)) * result.length);
  result[idx] = getHalloweenCategory(lang, seed);
  return result;
}

export function getHalloweenScare(lang: string): HalloweenScare {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = HALLOWEEN_SCARES[key];
  const id = pickHalloweenScareVisual();
  return list.find((scare) => scare.id === id) ?? list[0];
}

export function getHalloweenScareById(lang: string, id: HalloweenScareId): HalloweenScare {
  const scares = HALLOWEEN_SCARES[lang] ?? HALLOWEEN_SCARES.es;
  return scares.find((scare) => scare.id === id) ?? scares[0];
}

const HALLOWEEN_MODE_STORAGE_KEY = "stop_halloween_mode_enabled";

export function isHalloweenModeEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const stored = window.localStorage.getItem(HALLOWEEN_MODE_STORAGE_KEY);
    return stored === null ? true : stored === "1";
  } catch {
    return true;
  }
}

export function setHalloweenModeEnabled(enabled: boolean): void {
  try { window.localStorage.setItem(HALLOWEEN_MODE_STORAGE_KEY, enabled ? "1" : "0"); } catch {}
}
