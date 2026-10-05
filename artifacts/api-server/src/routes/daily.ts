import { Router, type IRouter } from "express";
import { db, dailyResultsTable, playerScoresTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { sumVerifiedBasePersistent, consumeScoreVoucherJtis, ceilingFromBase } from "../lib/scoreToken";
import { recordAuthoritativeSeasonEvents } from "./season";

const router: IRouter = Router();

// ── Helpers ────────────────────────────────────────────────────────────────────

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function getDailyChallenge(dateStr: string, language: string) {
  const seed = dateStr.replace(/-/g, "").split("").reduce(
    (acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0
  );

  const alphabets: Record<string, string[]> = {
    es: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
    en: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
    pt: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
    fr: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
  };

  const allCategories: Record<string, string[]> = {
    es: ["Nombre", "Lugar", "Animal", "Objeto", "Color", "Fruta", "Marca"],
    en: ["Name", "Place", "Animal", "Object", "Color", "Fruit", "Brand"],
    pt: ["Nome", "Lugar", "Animal", "Objeto", "Cor", "Fruta", "Marca"],
    fr: ["Prénom", "Lieu", "Animal", "Objet", "Couleur", "Fruit", "Marque"],
  };

  const alphabet = alphabets[language] || alphabets.es;
  const letter = alphabet[seed % alphabet.length];

  const cats = allCategories[language] || allCategories.es;
  const startIdx = (seed * 3) % cats.length;
  const categories = [...cats.slice(startIdx), ...cats.slice(0, startIdx)].slice(0, 5);

  return { letter, categories, date: dateStr };
}

// ── Routes ─────────────────────────────────────────────────────────────────────

// GET /api/daily?language=es  → today's challenge (letter + categories)
router.get("/", (req, res) => {
  const requestedLanguage = typeof req.query.language === "string" ? req.query.language.trim().toLowerCase() : "es";
  const language = ["es", "en", "pt", "fr"].includes(requestedLanguage) ? requestedLanguage : "es";
  const today = getTodayUTC();
  const challenge = getDailyChallenge(today, language);
  res.json(challenge);
});

// GET /api/daily/status?playerId=...&language=es → authoritative completion state
router.get("/status", async (req, res) => {
  const playerId = typeof req.query.playerId === "string" ? req.query.playerId.trim() : "";
  if (!playerId) {
    res.status(400).json({ error: "Invalid daily status request" });
    return;
  }
  if (!await verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }
  const requestedLanguage = typeof req.query.language === "string" ? req.query.language.trim().toLowerCase() : "es";
  const language = ["es", "en", "pt", "fr"].includes(requestedLanguage) ? requestedLanguage : "es";
  const today = getTodayUTC();
  const rows = await db
    .select({ score: dailyResultsTable.score })
    .from(dailyResultsTable)
    .where(and(
      eq(dailyResultsTable.playerId, playerId),
      eq(dailyResultsTable.challengeDate, today),
      eq(dailyResultsTable.language, language),
    ))
    .limit(1);
  res.json({ played: rows.length > 0, score: rows[0]?.score ?? null, date: today });
});

// POST /api/daily/submit  → save a player's score for today
router.post("/submit", async (req, res) => {
  const { playerId, playerName, score, letter, language, scoreTokens } = req.body;
  if (!playerId || !playerName || score == null || !letter) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  // 🔒 Only the authenticated owner may submit a daily score for a logged-in id.
  if (!await verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const [canonicalPlayer] = await db
    .select({
      playerName: playerScoresTable.playerName,
      avatarColor: playerScoresTable.avatarColor,
    })
    .from(playerScoresTable)
    .where(eq(playerScoresTable.playerId, playerId))
    .limit(1);
  if (!canonicalPlayer) {
    res.status(404).json({ error: "Player not found" });
    return;
  }
  const canonicalPlayerName = canonicalPlayer.playerName;
  const canonicalAvatarColor = canonicalPlayer.avatarColor;

  // 🔒 Bind the submission to the server-generated challenge. A client must not
  // be able to submit a score under a different letter/language for today's
  // ranking. Unsupported languages fall back to Spanish for GET, but submissions
  // must explicitly use one of the supported challenge languages.
  const normalizedLanguage = typeof language === "string" ? language.trim().toLowerCase() : "";
  const supportedLanguages = new Set(["es", "en", "pt", "fr"]);
  if (!supportedLanguages.has(normalizedLanguage)) {
    res.status(400).json({ error: "Unsupported daily challenge language" });
    return;
  }
  const today = getTodayUTC();
  const expectedChallenge = getDailyChallenge(today, normalizedLanguage);
  if (typeof letter !== "string" || letter.trim().toUpperCase() !== expectedChallenge.letter) {
    res.status(422).json({ error: "Invalid daily challenge letter" });
    return;
  }

  // 🔒 Daily ranking is authoritative too: a client-calculated offline score
  // has no server proof and must not be accepted just because it is below the
  // absolute ceiling. Only server-issued round vouchers can authorize the write.
  const { base: verifiedBase, verified, voucherJtis } = await sumVerifiedBasePersistent(scoreTokens, 1);
  const suppliedTokens = Array.isArray(scoreTokens) && scoreTokens.length > 0;
  if (!suppliedTokens) {
    res.status(422).json({ error: "SCORE_VOUCHER_REQUIRED" });
    return;
  }
  if (verified === 0) {
    res.status(422).json({ error: "INVALID_SCORE_VOUCHER" });
    return;
  }
  const dailyCeiling = ceilingFromBase(verifiedBase);
  const safeScore = Math.max(0, Math.min(Number(score) || 0, dailyCeiling));

  // Only allow one submission per player per day. Voucher consumption and
  // the daily write share one transaction so a failed write cannot burn a valid
  // voucher and leave the player unable to retry.
  let alreadyPlayed = false;
  let submitted = false;
  try {
    await db.transaction(async (tx) => {
      const existing = await tx
        .select()
        .from(dailyResultsTable)
        .where(and(
          eq(dailyResultsTable.playerId, playerId),
          eq(dailyResultsTable.challengeDate, today),
          eq(dailyResultsTable.language, normalizedLanguage),
        ))
        .limit(1);

      if (existing.length > 0) {
        alreadyPlayed = true;
        return;
      }

      const inserted = await tx.insert(dailyResultsTable).values({
        playerId,
        playerName: canonicalPlayerName,
        avatarColor: canonicalAvatarColor || "#e53e3e",
        challengeDate: today,
        score: safeScore,
        letter,
        language: normalizedLanguage,
      }).onConflictDoNothing({
        target: [dailyResultsTable.playerId, dailyResultsTable.challengeDate, dailyResultsTable.language],
      }).returning({ id: dailyResultsTable.id });

      if (inserted.length === 0) {
        alreadyPlayed = true;
        return;
      }

      if (verified > 0 && voucherJtis.length > 0) {
        await consumeScoreVoucherJtis(tx, voucherJtis);
      }
      submitted = true;
    });
  } catch (error) {
    if (error instanceof Error && error.message === "SCORE_VOUCHER_CONFLICT") {
      res.status(422).json({ error: "INVALID_SCORE_VOUCHER" });
      return;
    }
    throw error;
  }

  if (submitted) {
    void recordAuthoritativeSeasonEvents(
      playerId,
      [{ type: "daily_done", value: 1 }],
      `daily:${today}:${normalizedLanguage}`,
    );
  }
  res.status(submitted ? 201 : 200).json({ submitted, alreadyPlayed });
});

// GET /api/daily/rankings?language=es  → top 10 players for today
router.get("/rankings", async (req, res) => {
  const requestedLanguage = typeof req.query.language === "string" ? req.query.language.trim().toLowerCase() : "es";
  const language = ["es", "en", "pt", "fr"].includes(requestedLanguage) ? requestedLanguage : "es";
  const today = getTodayUTC();

  const results = await db
    .select({
      id: dailyResultsTable.id,
      playerName: dailyResultsTable.playerName,
      avatarColor: dailyResultsTable.avatarColor,
      challengeDate: dailyResultsTable.challengeDate,
      score: dailyResultsTable.score,
      letter: dailyResultsTable.letter,
      language: dailyResultsTable.language,
      rank: sql<number>`RANK() OVER (ORDER BY ${dailyResultsTable.score} DESC)`,
    })
    .from(dailyResultsTable)
    .where(
      and(
        eq(dailyResultsTable.challengeDate, today),
        eq(dailyResultsTable.language, language)
      )
    )
    .orderBy(desc(dailyResultsTable.score))
    .limit(10);

  res.json({ date: today, rankings: results });
});

export default router;
