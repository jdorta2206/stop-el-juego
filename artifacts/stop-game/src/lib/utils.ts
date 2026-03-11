import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const CATEGORIES_ES = [
  "Nombre",
  "Lugar",
  "Animal",
  "Objeto",
  "Color",
  "Fruta",
  "Marca"
];

// Spanish alphabet including Ñ - skip Q, X (hard letters), keep all standard ones
export const ALPHABET_ES = "ABCDEFGHIJKLMNÑOPQRSTUVWXYZ".split("").filter(
  l => !["Q", "X"].includes(l)
);

export const VOWELS = new Set(["A", "E", "I", "O", "U"]);

export function isVowel(letter: string): boolean {
  return VOWELS.has(letter.toUpperCase());
}

export const AVATAR_COLORS = [
  "#e63012", // STOP red
  "#1a237e", // dark blue
  "#f9a825", // yellow
  "#2e7d32", // green
  "#8e24aa", // purple
  "#0097a7", // teal
  "#e64a19", // deep orange
  "#37474f", // slate
  "#ad1457", // pink
  "#00838f", // cyan
];

export function shareText(text: string, url: string) {
  const encodedText = encodeURIComponent(text);
  const encodedUrl = encodeURIComponent(url);
  return {
    whatsapp: `https://wa.me/?text=${encodedText}%20${encodedUrl}`,
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodedUrl}&quote=${encodedText}`,
    instagram: `https://www.instagram.com/`, // IG doesn't support direct URL share
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
