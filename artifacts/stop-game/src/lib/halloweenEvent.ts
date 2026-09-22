export const HALLOWEEN_START = "2026-10-15T00:00:00";
export const HALLOWEEN_END = "2026-11-03T00:00:00";

export const HALLOWEEN_CATEGORIES = {
  es: ["Disfraz de miedo", "Monstruo", "Película de terror", "Cosa de una casa encantada", "Criatura sobrenatural"],
  en: ["Scary costume", "Monster", "Horror movie", "Haunted house item", "Supernatural creature"],
  pt: ["Fantasia assustadora", "Monstro", "Filme de terror", "Coisa de uma casa assombrada", "Criatura sobrenatural"],
  fr: ["Déguisement effrayant", "Monstre", "Film d'horreur", "Objet d'une maison hantée", "Créature surnaturelle"],
} as const;

export type HalloweenScareId = "ghost" | "clown" | "spider" | "skull" | "pumpkin" | "vampire";

export interface HalloweenScare {
  id: HalloweenScareId;
  emoji: string;
  title: string;
  text: string;
}

export const HALLOWEEN_SCARES: Record<string, HalloweenScare[]> = {
  es: [
    { id: "ghost", emoji: "👻", title: "¡NO MIRES ATRÁS!", text: "Algo acaba de aparecer..." },
    { id: "clown", emoji: "🤡", title: "¡TE ENCONTRÉ!", text: "El payaso estaba esperando..." },
    { id: "spider", emoji: "🕷️", title: "¡CUIDADO!", text: "Hay algo en la pantalla..." },
    { id: "skull", emoji: "💀", title: "¡TE HE VISTO!", text: "No todas las palabras dan miedo." },
    { id: "pumpkin", emoji: "🎃", title: "LA CALABAZA TE OBSERVA", text: "Sigue jugando si te atreves." },
    { id: "vampire", emoji: "🧛", title: "¡EL VAMPIRO HA LLEGADO!", text: "Esta partida acaba de ponerse rara..." },
  ],
  en: [
    { id: "ghost", emoji: "👻", title: "DON’T LOOK BACK!", text: "Something just appeared..." },
    { id: "clown", emoji: "🤡", title: "I FOUND YOU!", text: "The clown was waiting..." },
    { id: "spider", emoji: "🕷️", title: "WATCH OUT!", text: "Something is on the screen..." },
    { id: "skull", emoji: "💀", title: "I SAW YOU!", text: "Not every word is scary." },
    { id: "pumpkin", emoji: "🎃", title: "THE PUMPKIN IS WATCHING", text: "Keep playing if you dare." },
    { id: "vampire", emoji: "🧛", title: "THE VAMPIRE ARRIVED!", text: "This game just got weird..." },
  ],
  pt: [
    { id: "ghost", emoji: "👻", title: "NÃO OLHES PARA TRÁS!", text: "Algo acabou de aparecer..." },
    { id: "clown", emoji: "🤡", title: "ENCONTREI-TE!", text: "O palhaço estava à espera..." },
    { id: "spider", emoji: "🕷️", title: "CUIDADO!", text: "Há algo no ecrã..." },
    { id: "skull", emoji: "💀", title: "EU VI-TE!", text: "Nem todas as palavras assustam." },
    { id: "pumpkin", emoji: "🎃", title: "A ABÓBORA OBSERVA-TE", text: "Continua se tiveres coragem." },
    { id: "vampire", emoji: "🧛", title: "O VAMPIRO CHEGOU!", text: "Esta partida ficou estranha..." },
  ],
  fr: [
    { id: "ghost", emoji: "👻", title: "NE TE RETOURNE PAS !", text: "Quelque chose vient d’apparaître..." },
    { id: "clown", emoji: "🤡", title: "JE T’AI TROUVÉ !", text: "Le clown attendait..." },
    { id: "spider", emoji: "🕷️", title: "ATTENTION !", text: "Il y a quelque chose à l'écran..." },
    { id: "skull", emoji: "💀", title: "JE T'AI VU !", text: "Tous les mots ne font pas peur." },
    { id: "pumpkin", emoji: "🎃", title: "LA CITROUILLE TE REGARDE", text: "Continue si tu l'oses." },
    { id: "vampire", emoji: "🧛", title: "LE VAMPIRE EST ARRIVÉ !", text: "Cette partie devient étrange..." },
  ],
};

export function isHalloweenPreview(): boolean {
  if (typeof window !== "undefined") {
    try {
      if (new URLSearchParams(window.location.search).get("halloweenPreview") === "1") return true;
    } catch {}
  }
  return typeof import.meta !== "undefined" && import.meta.env?.VITE_HALLOWEEN_PREVIEW === "true";
}

export function isHalloweenActive(now = new Date()): boolean {
  if (isHalloweenPreview()) return true;
  const start = new Date(HALLOWEEN_START);
  const end = new Date(HALLOWEEN_END);
  return now >= start && now < end;
}

export function getHalloweenCategory(lang: string, seed = Math.random()): string {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = HALLOWEEN_CATEGORIES[key];
  return list[Math.floor(Math.max(0, Math.min(0.999999, seed)) * list.length)];
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
  const list = HALLOWEEN_SCARES[key];
  return list[Math.floor(Math.max(0, Math.min(0.999999, seed)) * list.length)];
}

export function getHalloweenScareById(lang: string, id: HalloweenScareId): HalloweenScare {
  const key = lang === "en" || lang === "pt" || lang === "fr" ? lang : "es";
  const list = HALLOWEEN_SCARES[key];
  return list.find(s => s.id === id) ?? list[0];
}
