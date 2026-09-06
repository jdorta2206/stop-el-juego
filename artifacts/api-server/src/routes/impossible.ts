import { Router, type IRouter } from "express";
import { db, impossibleResultsTable } from "@workspace/db";
import { eq, and, count, sql } from "drizzle-orm";
import { getImpossibleCombo } from "../lib/impossibleCombos";
import { validateWordWithAi } from "../lib/aiWordValidator";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

// ── GET /api/impossible?language=es ─────────────────────────────────────────
// Returns today's brutal combo plus global stats (how many won vs attempted).
router.get("/", async (req, res) => {
  const language = (req.query.language as string) || "es";
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

  return res.json({
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
  const language = (req.query.language as string) || "es";
  const today = getTodayUTC();

  if (!verifyClaimedIdentity(req, playerId)) {
    return res.status(403).json({ error: "Identity verification failed" });
  }

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
  return res.json({ played: true, result: rows[0] });
});

// ── POST /api/impossible/submit ─────────────────────────────────────────────
// One attempt per player per day. Body: { playerId, playerName, language,
// word, timeMs, surrendered }. We validate `word` against today's combo
// using the existing AI validator (cached). `surrendered=true` skips
// validation and counts as a loss.
router.post("/submit", async (req, res) => {
  const { playerId, playerName, language = "es", word = "", timeMs = 60000, surrendered = false } = req.body ?? {};
  if (!playerId || !playerName) {
    res.status(400).json({ error: "Missing playerId or playerName" }); return;
  }
  if (!verifyClaimedIdentity(req, playerId)) {
    return res.status(403).json({ error: "Identity verification failed" });
  }

  const today = getTodayUTC();

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
  let won = false;

  if (!surrendered && trimmed.length >= 2) {
    const normalize = (s: string) => s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase();
    const startsRight = normalize(trimmed).startsWith(normalize(combo.letter));
    if (startsRight) {
      try {
        const r = await validateWordWithAi({
          word: trimmed,
          category: combo.category,
          lang: language,
          playerId,
        });
        won = r.isValid === true;
      } catch {
        // AI failure must not turn an invalid/unverified answer into a win.
        // The safe result is a loss; the player can retry on a future day.
        won = false;
      }
    }
  }

  const inserted = await db.insert(impossibleResultsTable).values({
    playerId,
    playerName,
    challengeDate: today,
    language,
    letter: combo.letter,
    category: combo.category,
    attemptedWord: surrendered ? "" : trimmed,
    won,
    timeMs: Math.max(0, Math.min(60000, Math.floor(Number(timeMs) || 60000))),
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

  return res.status(201).json({
    submitted: true,
    won,
    word: trimmed,
    timeMs,
    stats: { attempts: Number(rows[0]?.attempts ?? 0), wins: Number(rows[0]?.wins ?? 0) },
  });
});

export default router;
