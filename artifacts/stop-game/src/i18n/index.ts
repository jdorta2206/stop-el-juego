import es from "./es";
import en from "./en";
import pt from "./pt";
import fr from "./fr";

export type LangCode = "es" | "en" | "pt" | "fr";
export type LangDict = typeof es;

export const LANGUAGES = { es, en, pt, fr } as unknown as Record<LangCode, LangDict>;

const STORAGE_KEY = "stop_lang";

function detectLang(): LangCode {
  const stored = localStorage.getItem(STORAGE_KEY) as LangCode | null;
  if (stored && LANGUAGES[stored]) return stored;
  const browser = navigator.language.slice(0, 2).toLowerCase();
  if (browser === "pt") return "pt";
  if (browser === "fr") return "fr";
  if (browser === "en") return "en";
  return "es";
}

let current: LangCode = "es";
const listeners = new Set<() => void>();

function init() {
  try {
    current = detectLang();
  } catch {
    current = "es";
  }
}

export function getLang(): LangCode {
  return current;
}

export function getT(): LangDict {
  return LANGUAGES[current];
}

export function setLang(code: LangCode) {
  current = code;
  try {
    localStorage.setItem(STORAGE_KEY, code);
  } catch {}
  listeners.forEach((fn) => fn());
}

export function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

init();
