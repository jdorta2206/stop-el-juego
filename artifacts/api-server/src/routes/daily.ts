import { Router, type IRouter } from "express";
import { db, dailyResultsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { sumVerifiedBase, ceilingFromBase, absoluteCeiling } from "../lib/scoreToken";

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
  const language = (req.query.language as string) || "es";
  const today = getTodayUTC();
  const challenge = getDailyChallenge(today, language);
  res.json(challenge);
});

// POST /api/daily/submit  → save a player's score for today
router.post("/submit", async (req, res) => {
  const { playerId, playerName, avatarColor, score, letter, language, scoreTokens } = req.body;
  if (!playerId || !playerName || score == null || !letter) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  // 🔒 Only the authenticated owner may submit a daily score for a logged-in id.
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  // 🔒 Anti-cheat clamp — same scheme as the global leaderboard: clamp the
  // posted score to a ceiling derived from the verified round voucher(s), or a
  // flat absolute ceiling when none are present (offline play). Never reject,
  // only clamp, so a legit daily score is never lost.
  const { base: verifiedBase, verified } = sumVerifiedBase(scoreTokens);
  const dailyCeiling = verified > 0 ? ceilingFromBase(verifiedBase) : absoluteCeiling("daily");
  const safeScore = Math.max(0, Math.min(Number(score) || 0, dailyCeiling));

  const today = getTodayUTC();

  // Only allow one submission per player per day
  const existing = await db
    .select()
    .from(dailyResultsTable)
    .where(
      and(
        eq(dailyResultsTable.playerId, playerId),
        eq(dailyResultsTable.challengeDate, today)
      )
    )
    .limit(1);

  if (existing.length > 0) {
    // Update if new score is higher
    if (safeScore > existing[0].score) {
      await db
        .update(dailyResultsTable)
        .set({ score: safeScore, playerName, avatarColor: avatarColor || existing[0].avatarColor })
        .where(
          and(
            eq(dailyResultsTable.playerId, playerId),
            eq(dailyResultsTable.challengeDate, today)
          )
        );
    }
    res.json({ updated: true, alreadyPlayed: true });
    return;
  }

  await db.insert(dailyResultsTable).values({
    playerId,
    playerName,
    avatarColor: avatarColor || "#e53e3e",
    challengeDate: today,
    score: safeScore,
    letter,
    language: language || "es",
  });

  res.status(201).json({ submitted: true });
});

// GET /api/daily/rankings?language=es  → top 10 players for today
router.get("/rankings", async (req, res) => {
  const language = (req.query.language as string) || "es";
  const today = getTodayUTC();

  const results = await db
    .select()
    .from(dailyResultsTable)
    .where(
      and(
        eq(dailyResultsTable.challengeDate, today),
        eq(dailyResultsTable.language, language)
      )
    )
    .orderBy(desc(dailyResultsTable.score))
    .limit(10);

  res.json({ date: today, rankings: results.map((r, i) => ({ ...r, rank: i + 1 })) });
});

export default router;
