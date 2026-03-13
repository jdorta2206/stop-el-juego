import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getLang, getT } from "@/i18n/index";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// Legacy export kept for backward compat — prefer getCategories() at call site
export const CATEGORIES_ES = ["Nombre", "Lugar", "Animal", "Objeto", "Color", "Fruta", "Marca"];
export const ALPHABET_ES = "ABCDEFGHIJKLMNÑOPRSTUVWYZ".split("");

/** Returns categories for the currently selected language */
export function getCategories(): string[] {
  return [...getT().categories];
}

/** Returns alphabet for the currently selected language */
export function getAlphabet(): string[] {
  return [...getT().alphabet];
}

/** Current language code (for API calls) */
export function getCurrentLang(): string {
  return getLang();
}

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export function isVowel(letter: string): boolean {
  return VOWELS.has(letter.toUpperCase());
}

export const AVATAR_COLORS = [
  "#e63012",
  "#1a237e",
  "#f9a825",
  "#2e7d32",
  "#8e24aa",
  "#0097a7",
  "#e64a19",
  "#37474f",
  "#ad1457",
  "#00838f",
];

export function shareText(text: string, url: string) {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    instagram: `https://www.instagram.com/`,
    twitter: `https://twitter.com/intent/tweet?text=${encodedText}&url=${encodedUrl}`,
    native: () => {
      if (navigator.share) {
        navigator.share({ title: "STOP - El Juego", text, url });
      } else {
        navigator.clipboard.writeText(`${text} ${url}`);
      }
    },
  };
}
