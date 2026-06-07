import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { getLang, getT } from "@/i18n/index";

/**
 * Returns the API base URL.
 * In production (Render), reads VITE_API_URL env var so the frontend knows
 * the separate API service. In development (Replit), falls back to origin.
 */
export function getApiUrl(): string {
  const env = (import.meta as { env?: { VITE_API_URL?: string } }).env;
  return env?.VITE_API_URL ?? window.location.origin;
}

/**
 * Headers that bind a request to the logged-in player's account. The server
 * uses the signed session token to reject anyone trying to act under another
 * player's id (Stripe billing, leaderboard, custom packs). Empty for guests /
 * when not logged in — those requests proceed unauthenticated as before.
 */
export function getSessionToken(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return (
      window.localStorage?.getItem("stop_session_token") ||
      window.sessionStorage?.getItem("stop_session_token") ||
      null
    );
  } catch {
    return null;
  }
}

export function authHeaders(): Record<string, string> {
  const tok = getSessionToken();
  return tok ? { "x-stop-token": tok } : {};
}

/**
 * Canonical public site URL for SHAREABLE links (invites, room/tournament/live
 * links, result shares). NEVER use window.location.origin for these: when a
 * link is created from inside the Replit editor preview it captures the dev
 * domain (e.g. *.replit.dev) and the link breaks once the workspace stops.
 * API/OAuth/push calls keep using getApiUrl()/origin — only user-facing share
 * links use this.
 */
export const PUBLIC_SITE_URL = "https://www.stopjuegodepalabras.com";

/** Build an absolute link on the public site (production is served at root). */
export function publicLink(path = ""): string {
  const clean = path.replace(/^\/+/, "");
  return clean ? `${PUBLIC_SITE_URL}/${clean}` : `${PUBLIC_SITE_URL}/`;
}

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
  "#b5301a",
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
