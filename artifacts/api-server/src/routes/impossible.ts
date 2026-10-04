import { Router, type IRouter } from "express";
import { db, impossibleResultsTable, playerScoresTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { getImpossibleCombo } from "../lib/impossibleCombos";
import { validateWordWithAi } from "../lib/aiWordValidator";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { normalizeWord } from "../lib/wordRules";

const router: IRouter = Router();
const SUPPORTED_LANGUAGES = new Set(["es", "en", "pt", "fr"]);

function parseLanguage(value: unknown): string | null {
  const language = typeof value === "string" ? value.trim().toLowerCase() : "";
  return SUPPORTED_LANGUAGES.has(language) ? language : null;
}

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── GET /api/impossible?language=es ─────────────────────────────────────────
// Returns today's brutal combo plus global stats (how many won vs attempted).
router.get("/", async (req, res) => {
  const language = parseLanguage(req.query.language) ?? "es";
  const today = getTodayUTC();
  const combo = getImpossibleCombo(today, language);

  const rows = await db
    .select({
      attempts: count(),
      wins: sql<number>`sum(case when ${impossibleResultsTable.won} then 1 else 0 end)::int`,
    })
    .from(impossibleResultsTable)
    .where(and(
      eq(impossibleResultsTable.challengeDate, today),
      eq(impossibleResultsTable.language, language),
    ));

  const attempts = Number(rows[0]?.attempts ?? 0);
  const wins = Number(rows[0]?.wins ?? 0);

  res.json({
    date: today,
    language,
    letter: combo.letter,
    category: combo.category,
    stats: { attempts, wins },
  });
});

// ── GET /api/impossible/me/:playerId?language=es ────────────────────────────
// Has this player already attempted today? Returns their attempt if so.
router.get("/me/:playerId", async (req, res) => {
  const playerId = req.params.playerId;
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "PLAYER_ID_MISMATCH" });
    return;
  }

  const language = parseLanguage(req.query.language) ?? "es";
  const today = getTodayUTC();

  const rows = await db
    .select()
    .from(impossibleResultsTable)
    .where(and(
      eq(impossibleResultsTable.playerId, playerId),
      eq(impossibleResultsTable.challengeDate, today),
      eq(impossibleResultsTable.language, language),
    ))
    .limit(1);

  if (!rows.length) { res.json({ played: false }); return; }
  res.json({ played: true, result: rows[0] });
});

// ── POST /api/impossible/submit ─────────────────────────────────────────────
// One attempt per player per day and supported language.
router.post("/submit", async (req, res) => {
  const { playerId, word = "", timeMs = 60000, surrendered = false } = req.body ?? {};
  const language = parseLanguage(req.body?.language) ?? null;
  if (!playerId) {
    res.status(400).json({ error: "Missing playerId or playerName" }); return;
  }
  if (!language) {
    res.status(400).json({ error: "Unsupported language" }); return;
  }
  if (!verifyClaimedIdentity(req, String(playerId))) {
    res.status(403).json({ error: "PLAYER_ID_MISMATCH" });
    return;
  }

  const [canonicalPlayer] = await db
    .select({ playerName: playerScoresTable.playerName })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, String(playerId)))
    .limit(1);
  if (!canonicalPlayer) {
    res.status(404).json({ error: "Player not found" });
    return;
  }

  const today = getTodayUTC();

  // Idempotency: if they already submitted today, return the prior result.
  const existing = await db
    .select()
    .from(impossibleResultsTable)
    .where(and(
      eq(impossibleResultsTable.playerId, playerId),
      eq(impossibleResultsTable.challengeDate, today),
      eq(impossibleResultsTable.language, language),
    ))
    .limit(1);
  if (existing.length) {
    res.json({ alreadyPlayed: true, result: existing[0] });
    return;
  }

  const combo = getImpossibleCombo(today, language);
  const trimmed = String(word).trim();
  const normalizedWord = normalizeWord(trimmed);
  let won = false;

  if (!surrendered && normalizedWord.length >= 2) {
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const startsRight = normalize(normalizedWord).startsWith(normalize(combo.letter));
    if (startsRight) {
      try {
        const r = await validateWordWithAi({
          word: normalizedWord,
          category: combo.category,
          lang: language,
          playerId,
        });
        won = r.isValid === true;
      } catch {
        won = false;
      }
    }
  }

  const inserted = await db.insert(impossibleResultsTable).values({
    playerId,
    playerName: canonicalPlayer.playerName,
    challengeDate: today,
    language,
    letter: combo.letter,
    category: combo.category,
    attemptedWord: surrendered ? "" : trimmed,
    won,
    timeMs: Math.max(0, Math.min(60000, Math.floor(timeMs))),
  }).onConflictDoNothing().returning();

  if (inserted.length === 0) {
    const prior = await db.select().from(impossibleResultsTable).where(and(
      eq(impossibleResultsTable.playerId, playerId),
      eq(impossibleResultsTable.challengeDate, today),
      eq(impossibleResultsTable.language, language),
    )).limit(1);
    res.json({ alreadyPlayed: true, result: prior[0] });
    return;
  }

  const rows = await db
    .select({
      attempts: count(),
      wins: sql<number>`sum(case when ${impossibleResultsTable.won} then 1 else 0 end)::int`,
    })
    .from(impossibleResultsTable)
    .where(and(
      eq(impossibleResultsTable.challengeDate, today),
      eq(impossibleResultsTable.language, language),
    ));

  res.status(201).json({
    submitted: true,
    won,
    word: trimmed,
    timeMs,
    stats: { attempts: Number(rows[0]?.attempts ?? 0), wins: Number(rows[0]?.wins ?? 0) },
  });
});

export default router;
