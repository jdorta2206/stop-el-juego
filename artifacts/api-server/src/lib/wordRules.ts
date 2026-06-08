// Pure, dependency-free word-rule helpers shared by the game routes and the
// offline bundle logic. Kept in their own module (no DB / router / dictionary
// imports) so they can be unit-tested in isolation and reused without side
// effects.

/**
 * Normalize a player's answer for comparison: lowercase, trim, strip accents
 * and non-letters, collapse whitespace. Ñ/ñ is protected with a placeholder
 * BEFORE NFD decomposition — otherwise "ñ" → "n" + combining-tilde → "n",
 * which would make it indistinguishable from a plain N.
 */
export function normalizeWord(word: string): string {
  return word.toLowerCase().trim()
    .replace(/ñ/g, "~")               // protect ñ from NFD
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")  // strip other accent marks
    .replace(/[^a-z~\s]/g, "")        // strip numbers, emojis, symbols
    .replace(/\s+/g, " ")             // collapse multiple spaces into one
    .replace(/~/g, "ñ")               // restore ñ
    .trim();
}

/** Hard limits to prevent abuse: max 60 chars, must contain a real letter, no absurd repetitions */
export function isSafeInput(word: string): boolean {
  if (!word || word.trim().length === 0) return false;
  if (word.length > 60) return false;
  if (!/[a-záéíóúàèìòùäëïöüñ]/i.test(word)) return false;
  // Reject keyboard-mashing: 4+ consecutive identical characters (e.g. "aaaa", "bbbbb")
  if (/(.)\1{3,}/.test(word.toLowerCase())) return false;
  return true;
}
