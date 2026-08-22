// Cliente offline: replica la lógica de validación / generación de respuesta
// IA del servidor (artifacts/api-server/src/routes/game.ts) usando el bundle
// que se descarga y cachea desde GET /api/game/offline-bundle.
//
// Si el jugador entra al avión sin internet pero ya jugó antes, las partidas
// solo siguen funcionando con esta copia local del diccionario.
import { getApiUrl } from "./utils";
import { createAiRoundPlan, shouldAiAnswer, type AiDifficulty } from "./aiDifficulty";

export type OfflineBundle = {
  version: string;
  dictionary: Record<string, Record<string, string[]>>;
  openCategories: string[];
  neverValidWords: string[];
};

export type OfflineValidateRequest = {
  letter: string;
  language: string;
  playerResponses: { category: string; word: string }[];
  difficulty?: AiDifficulty;
  elapsedMs?: number;
};

export type OfflineValidateResponse = {
  results: Record<string, {
    player: { response: string; isValid: boolean; score: number };
    ai:     { response: string; isValid: boolean; score: number };
  }>;
  playerTotalScore: number;
  aiTotalScore: number;
};

const STORAGE_KEY = "stop-offline-bundle-v1";

let memoryBundle: OfflineBundle | null = null;

function readFromStorage(): OfflineBundle | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as OfflineBundle;
    if (!parsed?.dictionary) return null;
    return parsed;
  } catch {
    return null;
  }
}

function writeToStorage(bundle: OfflineBundle) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bundle));
  } catch {
    // Quota exceeded or storage disabled — ignore, the SW cache still has it.
  }
}

/** Returns the cached bundle synchronously (memory or localStorage). */
export function getCachedOfflineBundle(): OfflineBundle | null {
  if (memoryBundle) return memoryBundle;
  memoryBundle = readFromStorage();
  return memoryBundle;
}

/**
 * Fetches the offline bundle from the server and persists it. If the network
 * call fails, returns the previously cached copy (or null).
 * Safe to call on every app load — runs in the background.
 */
export async function ensureOfflineBundle(): Promise<OfflineBundle | null> {
  try {
    const res = await fetch(`${getApiUrl()}/api/game/offline-bundle`, {
      // Hint the SW to revalidate when possible.
      cache: "no-cache",
    });
    if (!res.ok) throw new Error("bundle fetch failed");
    const data = (await res.json()) as OfflineBundle;
    if (data?.dictionary) {
      memoryBundle = data;
      writeToStorage(data);
      return data;
    }
  } catch {
    // fall through to cached copy
  }
  return getCachedOfflineBundle();
}

// ───────── Helpers (mirror of server logic) ─────────

function normalizeWord(word: string): string {
  return word.toLowerCase().trim()
    .replace(/ñ/g, "~")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z~\s]/g, "")
    .replace(/\s+/g, " ")
    .replace(/~/g, "ñ")
    .trim();
}

function isSafeInput(word: string): boolean {
  if (!word || word.trim().length === 0) return false;
  if (word.length > 60) return false;
  if (!/[a-záéíóúàèìòùäëïöüñ]/i.test(word)) return false;
  if (/(.)\1{3,}/.test(word.toLowerCase())) return false;
  return true;
}

function findCategoryWords(langDict: Record<string, string[]>, category: string): string[] {
  const norm = normalizeWord(category);
  for (const [key, words] of Object.entries(langDict)) {
    if (normalizeWord(key) === norm) return words;
  }
  let best: { key: string; words: string[] } | null = null;
  for (const [key, words] of Object.entries(langDict)) {
    const normKey = normalizeWord(key);
    if (norm.startsWith(normKey) || normKey.startsWith(norm)) {
      if (!best || normKey.length > normalizeWord(best.key).length) {
        best = { key, words };
      }
    }
  }
  return best ? best.words : [];
}

function isWordValid(
  bundle: OfflineBundle,
  word: string,
  letter: string,
  category: string,
  language = "es",
): boolean {
  if (!isSafeInput(word)) return false;
  const normalizedWord = normalizeWord(word);
  const normalizedLetter = normalizeWord(letter);
  if (!normalizedWord.startsWith(normalizedLetter)) return false;
  if (normalizedWord.length < 2) return false;

  if (bundle.neverValidWords.includes(normalizedWord)) return false;

  const normCategory = normalizeWord(category);
  if (bundle.openCategories.includes(normCategory)) return normalizedWord.length >= 3;

  const primaryDict = bundle.dictionary[language] || bundle.dictionary["es"];
  let categoryWords = findCategoryWords(primaryDict || {}, category);
  if (categoryWords.length === 0 && language !== "es" && bundle.dictionary["es"]) {
    categoryWords = findCategoryWords(bundle.dictionary["es"], category);
  }
  if (categoryWords.length === 0) return normalizedWord.length >= 3;

  return categoryWords.some(w => {
    const nw = normalizeWord(w);
    return nw === normalizedWord ||
      normalizedWord.startsWith(nw) ||
      nw.startsWith(normalizedWord);
  });
}

export function getAiWordOffline(
  letter: string,
  category: string,
  language = "es",
): string {
  const bundle = getCachedOfflineBundle();
  if (!bundle) return "";
  const langDict = bundle.dictionary[language] || bundle.dictionary["es"] || {};
  let categoryWords = findCategoryWords(langDict, category);
  if (categoryWords.length === 0 && language !== "es" && bundle.dictionary["es"]) {
    categoryWords = findCategoryWords(bundle.dictionary["es"], category);
  }
  const normalizedLetter = normalizeWord(letter);
  const matches = categoryWords.filter(w => normalizeWord(w).startsWith(normalizedLetter));
  if (matches.length === 0) return "";
  return matches[Math.floor(Math.random() * Math.min(matches.length, 5))];
}

/**
 * Local equivalent of POST /api/game/validate.
 * Returns null if no offline bundle is available (player has never been online).
 */
export function validateRoundOffline(req: OfflineValidateRequest): OfflineValidateResponse | null {
  const bundle = getCachedOfflineBundle();
  if (!bundle) return null;

  const { letter, language, playerResponses } = req;
  const results: OfflineValidateResponse["results"] = {};
  const aiPlan = createAiRoundPlan(
    playerResponses.map((p) => p.category),
    req.difficulty ?? "easy",
    req.elapsedMs ?? 60000,
  );
  let playerTotalScore = 0;
  let aiTotalScore = 0;

  for (const pr of playerResponses) {
    const playerWord = pr.word?.trim() || "";
    const aiWord = shouldAiAnswer(aiPlan, pr.category) ? getAiWordOffline(letter, pr.category, language) : "";
    const normPlayerWord = normalizeWord(playerWord);

    const isPlayerWordValid = isWordValid(bundle, playerWord, letter, pr.category, language);
    const isAiWordValid = aiWord.length > 0 && isWordValid(bundle, aiWord, letter, pr.category, language);

    let playerScore = 0;
    let aiScore = 0;

    if (isPlayerWordValid && isAiWordValid) {
      const normAi = normalizeWord(aiWord);
      if (normPlayerWord === normAi) {
        playerScore = 5;
        aiScore = 5;
      } else {
        playerScore = 10;
        aiScore = 10;
      }
    } else if (isPlayerWordValid) {
      playerScore = 10;
    } else if (isAiWordValid) {
      aiScore = 10;
    }

    const formattedAiWord = aiWord ? aiWord.charAt(0).toUpperCase() + aiWord.slice(1) : "";
    results[pr.category] = {
      player: { response: playerWord, isValid: isPlayerWordValid, score: playerScore },
      ai:     { response: formattedAiWord, isValid: isAiWordValid, score: aiScore },
    };

    playerTotalScore += playerScore;
    aiTotalScore += aiScore;
  }

  return { results, playerTotalScore, aiTotalScore };
}

// ───────── Score submission outbox ─────────
//
// Cuando el jugador termina una partida sin conexión, el envío a
// /api/ranking/scores falla. Lo guardamos aquí para reintentarlo cuando
// vuelva la red (evento `online`) o en el próximo arranque.
//
// Anti-duplicados: cada entrada se "reclama" (se elimina del array) ANTES
// de enviar. Así, si una segunda llamada a flushScoreOutbox arranca en
// paralelo (otra pestaña, evento online + arranque, etc.), no encontrará
// la misma entrada para reenviarla. Si el envío falla, se vuelve a meter
// al principio de la cola.

const OUTBOX_KEY = "stop-score-outbox-v1";

export type OutboxScorePayload = {
  playerId: string;
  playerName: string;
  avatarColor?: string;
  score: number;
  letter: string;
  mode: string;
  won: boolean;
  bonus?: boolean;
  // 🔒 Anti-cheat vouchers gathered during the game. Usually empty for queued
  // (offline) submissions since offline rounds are validated locally and get
  // no token — those fall back to the server's absolute ceiling.
  scoreTokens?: string[];
};

export type OutboxEntry = {
  id: string;
  payload: OutboxScorePayload;
  createdAt: number;
};

function readOutbox(): OutboxEntry[] {
  try {
    const raw = localStorage.getItem(OUTBOX_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((e) => e && typeof e === "object" && e.payload) : [];
  } catch {
    return [];
  }
}

function writeOutbox(entries: OutboxEntry[]) {
  try {
    if (entries.length === 0) localStorage.removeItem(OUTBOX_KEY);
    else localStorage.setItem(OUTBOX_KEY, JSON.stringify(entries));
  } catch {
    // Storage disabled / quota — nothing we can do; we'll just lose retries.
  }
}

export function enqueueScoreOutbox(payload: OutboxScorePayload): OutboxEntry {
  const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  const entry: OutboxEntry = { id, payload, createdAt: Date.now() };
  const cur = readOutbox();
  cur.push(entry);
  writeOutbox(cur);
  return entry;
}

export function getScoreOutboxSize(): number {
  return readOutbox().length;
}

let flushing = false;

export async function flushScoreOutbox(
  submit: (payload: OutboxScorePayload) => Promise<unknown>,
): Promise<{ flushed: number; remaining: number }> {
  if (flushing) return { flushed: 0, remaining: readOutbox().length };
  flushing = true;
  let flushed = 0;
  try {
    // Each iteration claims and removes the head entry BEFORE sending so a
    // second concurrent flush can't pick up the same item and create a
    // duplicate score on the server.
    while (true) {
      const cur = readOutbox();
      if (cur.length === 0) break;
      const [next, ...rest] = cur;
      writeOutbox(rest);
      try {
        await submit(next.payload);
        flushed++;
      } catch {
        // Likely still offline / server unreachable — restore the entry at
        // the head and stop retrying for this round. Other queued entries
        // would presumably fail too.
        const after = readOutbox();
        writeOutbox([next, ...after]);
        break;
      }
    }
  } finally {
    flushing = false;
  }
  return { flushed, remaining: readOutbox().length };
}
