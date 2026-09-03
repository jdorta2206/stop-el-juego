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

  res.json({
    date: today,
    language,
    letter: combo.letter,
    category: combo.category,
    stats: { attempts, wins },
  });
});

// ── GET /api/impossible/me/:playerId?language=es ────────────────────────────
router.get("/me/:playerId", async (req, res) => {
  const playerId = req.params.playerId;
  const language = (req.query.language as string) || "es";
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
// Guest clients remain supported. For logged-in OAuth ids, the claimed id
// must match the signed player token so one account cannot submit for another.
router.post("/submit", async (req, res) => {
  const { playerId, playerName, language = "es", word = "", timeMs = 60000, surrendered = false } = req.body ?? {};
  if (!playerId || !playerName) {
    res.status(400).json({ error: "Missing playerId or playerName" }); return;
  }

  if (!verifyClaimedIdentity(req, String(playerId))) {
    res.status(403).json({ error: "Identidad del jugador no válida" });
    return;
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
        // Infrastructure failure is never a win. The attempt is recorded as a
        // loss so the validator cannot be abused as a fail-open reward path.
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
