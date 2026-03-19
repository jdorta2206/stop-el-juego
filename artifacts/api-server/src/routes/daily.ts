import { Router, type IRouter } from "express";
import { db, dailyResultsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";

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
  const { playerId, playerName, avatarColor, score, letter, language } = req.body;
  if (!playerId || !playerName || score == null || !letter) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }

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
    if (score > existing[0].score) {
      await db
        .update(dailyResultsTable)
        .set({ score, playerName, avatarColor: avatarColor || existing[0].avatarColor })
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
    score,
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
