import OpenAI from "openai";
import { db, wordValidationCacheTable } from "@workspace/db";
import { and, eq, sql } from "drizzle-orm";

// Fallback word validator backed by an LLM. Used only when the static
// dictionary cannot answer (i.e. the word isn't in our hand-curated lists
// for a closed category like fruta/color/animal). Verdicts are cached
// permanently in `word_validation_cache` so any given (word, category, lang)
// triple is paid for at most once in the lifetime of the game.
//
// Cost model:
//   - gpt-5-nano is the cheapest model. A single-token "yes"/"no" answer
//     is on the order of $0.0001 per request.
//   - Two hard rate limits guard against runaway cost regardless of the
//     cache hit rate: a global daily cap, and a per-player daily cap. If
//     either is exceeded we degrade gracefully by returning `false` (i.e.
//     behave as if the word weren't in the dictionary), exactly as the
//     game has always done.

// gpt-5-mini: better judgement than -nano for nuanced category membership
// (regionalismos, tonos, especies). ~5x more expensive per call but still
// ~$0.0005 per validation, and the cache means each unique word is paid for
// at most once across all players.
const MODEL = "gpt-5-mini";

// Hard ceilings. Tuned to keep monthly bill < 1.5 € even in worst case.
const GLOBAL_DAILY_LIMIT = 500;
const PER_PLAYER_DAILY_LIMIT = 10;

// In-memory per-day counters. Reset at the start of every UTC day.
// Process-local: if the server restarts the counter resets, which is fine
// for our purposes — we are protecting against runaway loops, not enforcing
// strict billing.
let counterDay = currentUtcDay();
let globalCounter = 0;
const playerCounters = new Map<string, number>();

function currentUtcDay(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD UTC
}

function rolloverIfNewDay(): void {
  const today = currentUtcDay();
  if (today !== counterDay) {
    counterDay = today;
    globalCounter = 0;
    playerCounters.clear();
  }
}

function bumpAndCheckQuota(playerId: string | null): boolean {
  rolloverIfNewDay();
  if (globalCounter >= GLOBAL_DAILY_LIMIT) return false;
  if (playerId) {
    const used = playerCounters.get(playerId) ?? 0;
    if (used >= PER_PLAYER_DAILY_LIMIT) return false;
    playerCounters.set(playerId, used + 1);
  }
  globalCounter += 1;
  return true;
}

// Lazy client — instantiated on first use so the module loads even if the
// integration env vars haven't been provisioned yet (e.g. in test envs).
let _client: OpenAI | null = null;
function getClient(): OpenAI | null {
  if (_client) return _client;
  const baseURL = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL;
  const apiKey = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;
  if (!baseURL || !apiKey) return null;
  _client = new OpenAI({ baseURL, apiKey });
  return _client;
}

// Reverse map for the prompt: full readable names per ISO-ish lang code we
// already support in the game. Defaults to Spanish if unknown.
const LANG_NAMES: Record<string, string> = {
  es: "español",
  en: "English",
  pt: "português",
  fr: "français",
  it: "italiano",
};

function languageName(lang: string): string {
  return LANG_NAMES[lang] ?? LANG_NAMES.es;
}

// Categories that humans might see — kept short and unambiguous. The actual
// game uses far more variants ("personaje histórico", etc.); we pass the
// raw category through and let the LLM interpret it.
function categoryDescription(category: string, lang: string): string {
  return `categoría "${category}"`;
}

export interface AiValidationOptions {
  word: string;       // ALREADY normalized (lowercase, accents stripped)
  category: string;   // Raw category id as used in the round
  lang: string;       // Language code: es | en | pt | fr | it
  playerId?: string | null;
}

export interface AiValidationResult {
  isValid: boolean;
  source: "cache" | "ai" | "quota_blocked" | "no_client" | "error";
}

// Cache-first lookup. Returns `null` if there is no cached verdict.
export async function lookupCachedValidation(
  word: string,
  category: string,
  lang: string,
): Promise<boolean | null> {
  try {
    const rows = await db
      .select({ isValid: wordValidationCacheTable.isValid })
      .from(wordValidationCacheTable)
      .where(and(
        eq(wordValidationCacheTable.word, word),
        eq(wordValidationCacheTable.category, category),
        eq(wordValidationCacheTable.lang, lang),
      ))
      .limit(1);
    return rows[0]?.isValid ?? null;
  } catch (err) {
    console.error("[aiWordValidator] cache lookup failed:", err instanceof Error ? err.message : err);
    return null;
  }
}

// Write-through cache. Uses an ON CONFLICT DO NOTHING so concurrent writes
// for the same triple don't error out.
async function writeCache(
  word: string,
  category: string,
  lang: string,
  isValid: boolean,
  model: string,
): Promise<void> {
  try {
    await db.execute(sql`
      INSERT INTO word_validation_cache (word, category, lang, is_valid, source, model)
      VALUES (${word}, ${category}, ${lang}, ${isValid}, 'ai', ${model})
      ON CONFLICT (word, category, lang) DO NOTHING
    `);
  } catch (err) {
    console.error("[aiWordValidator] cache write failed:", err instanceof Error ? err.message : err);
  }
}

// Main entry point. Always cache-first. If no cache hit and quota allows,
// asks the LLM and caches the verdict. On any failure returns `false` so
// the player simply gets the same answer they would have gotten before this
// feature existed — never a 500.
export async function validateWordWithAi(opts: AiValidationOptions): Promise<AiValidationResult> {
  const { word, category, lang, playerId = null } = opts;

  if (!word || !category) return { isValid: false, source: "error" };

  const cached = await lookupCachedValidation(word, category, lang);
  if (cached !== null) return { isValid: cached, source: "cache" };

  const client = getClient();
  if (!client) return { isValid: false, source: "no_client" };

  if (!bumpAndCheckQuota(playerId)) {
    return { isValid: false, source: "quota_blocked" };
  }

  // Prompt is deliberately strict and one-shot. We ask for a single token
  // ("si"/"no") so the answer is cheap to generate and trivial to parse.
  // We do NOT trust the model's first-letter check (the caller already did
  // that); we only ask: "is this a real member of the category?".
  // Permisivo a propósito: el objetivo es NO penalizar al jugador por
  // palabras reales que simplemente no estén en nuestro diccionario estático.
  // Aceptamos regionalismos, variantes sin tilde, sinónimos, nombres comunes
  // de tonos/especies/etc. Solo rechazamos basura clara (random keyboard
  // mashing, palabras de otra categoría, nombres propios de personas/marcas
  // cuando la categoría no es nombre/marca).
  const systemPrompt =
    `Eres un validador permisivo para un juego de palabras tipo "Stop"/"Tutti Frutti". ` +
    `Decides si una palabra puede aceptarse como ejemplo razonable de una categoría. ` +
    `Responde SOLO con "si" o "no", sin nada más. ` +
    `Sé generoso: acepta regionalismos, variantes sin tilde, formas coloquiales, tonos/matices/especies/subtipos y cualquier palabra que un hablante nativo aceptaría sin discutir. ` +
    `Si dudas entre aceptar o rechazar, acepta. ` +
    `Rechaza solo: palabras inventadas/aleatorias, palabras claramente de otra categoría, errores ortográficos graves que cambian la palabra.`;

  const userPrompt =
    `Idioma: ${languageName(lang)}.\n` +
    `Categoría: ${category}.\n` +
    `Palabra: "${word}".\n` +
    `¿Podría aceptarse "${word}" como ${category} en ${languageName(lang)}? Responde "si" o "no".`;

  try {
    const resp = await Promise.race([
      client.chat.completions.create({
        model: MODEL,
        // gpt-5-mini is a reasoning model — `max_completion_tokens` counts
        // reasoning tokens too. Set high enough to leave room for thought;
        // the actual answer is just one word so output cost stays minimal.
        max_completion_tokens: 8192,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: userPrompt },
        ],
      }),
      // 12s timeout — gpt-5-mini reasoning is slower than chat models but
      // we still cap it so a slow LLM never blocks the player's scoreboard.
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("ai_validator_timeout")), 12_000),
      ),
    ]);

    const raw = resp.choices?.[0]?.message?.content?.toLowerCase().trim() ?? "";
    // Accept "si", "sí", "yes", "true", "1" as positive verdicts. Anything
    // else (including the model refusing to answer) counts as "no".
    const isValid = /^(si|sí|s|yes|y|true|1)$/.test(raw);

    // Cache both positive AND negative answers — the whole point is to
    // never ask twice. Negatives are arguably the more valuable cache
    // entries since they prevent a player from grinding the API.
    await writeCache(word, category, lang, isValid, MODEL);

    return { isValid, source: "ai" };
  } catch (err) {
    console.error("[aiWordValidator] ai call failed:", err instanceof Error ? err.message : err);
    return { isValid: false, source: "error" };
  }
}
