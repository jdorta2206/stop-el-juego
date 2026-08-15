import { Router, type IRouter } from "express";
import { db, dailyResultsTable } from "@workspace/db";
import { eq, and, desc } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { sumVerifiedBase, ceilingFromBase } from "../lib/scoreToken";

const router: IRouter = Router();

const SUPPORTED_LANGUAGES = ["es", "en", "pt", "fr"] as const;
type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number];

function normalizeLanguage(value: unknown): SupportedLanguage | null {
  const language = typeof value === "string" ? value.toLowerCase().trim() : "";
  return (SUPPORTED_LANGUAGES as readonly string[]).includes(language)
    ? language as SupportedLanguage
    : null;
}

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
}

function getDailyChallenge(dateStr: string, language: SupportedLanguage) {
  const seed = dateStr.replace(/-/g, "").split("").reduce(
    (acc, c, i) => acc + c.charCodeAt(0) * (i + 1), 0
  );

  const alphabets: Record<SupportedLanguage, string[]> = {
    es: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
    en: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
    pt: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
    fr: "ABCDEFGHIJKLMNOPRSTUVWYZ".split(""),
  };

  const allCategories: Record<SupportedLanguage, string[]> = {
    es: ["Nombre", "Lugar", "Animal", "Objeto", "Color", "Fruta", "Marca"],
    en: ["Name", "Place", "Animal", "Object", "Color", "Fruit", "Brand"],
    pt: ["Nome", "Lugar", "Animal", "Objeto", "Cor", "Fruta", "Marca"],
    fr: ["Prénom", "Lieu", "Animal", "Objet", "Couleur", "Fruit", "Marque"],
  };

  const alphabet = alphabets[language];
  const letter = alphabet[seed % alphabet.length];
  const cats = allCategories[language];
  const startIdx = (seed * 3) % cats.length;
  const categories = [...cats.slice(startIdx), ...cats.slice(0, startIdx)].slice(0, 5);

  return { letter, categories, date: dateStr };
}

router.get("/", (req, res) => {
  const language = normalizeLanguage(req.query.language) ?? "es";
  const today = getTodayUTC();
  res.json(getDailyChallenge(today, language));
});

router.post("/submit", async (req, res) => {
  const { playerId, playerName, avatarColor, score, letter, language, scoreTokens } = req.body ?? {};
  const normalizedLanguage = normalizeLanguage(language);

  if (
    typeof playerId !== "string" || !playerId.trim() ||
    typeof playerName !== "string" || !playerName.trim() ||
    typeof letter !== "string" || !letter.trim() ||
    normalizedLanguage === null
  ) {
    res.status(400).json({ error: "Invalid request" });
    return;
  }

  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const today = getTodayUTC();
  const challenge = getDailyChallenge(today, normalizedLanguage);
  if (letter.toUpperCase() !== challenge.letter) {
    res.status(400).json({ error: "Invalid daily challenge letter" });
    return;
  }

  const numericScore = typeof score === "number" ? score : Number(score);
  if (!Number.isSafeInteger(numericScore) || numericScore < 0) {
    res.status(400).json({ error: "Invalid score" });
    return;
  }

  // A ranked daily result must be backed by a server-issued voucher. Do not
  // fall back to a client-controlled absolute ceiling: that is still a way to
  // submit fabricated scores. Offline play can remain local-only.
  const { base: verifiedBase, verified } = sumVerifiedBase(scoreTokens, 1);
  if (verified !== 1) {
    res.status(403).json({ error: "Valid score voucher required" });
    return;
  }
  const safeScore = Math.max(0, Math.min(numericScore, ceilingFromBase(verifiedBase)));

  const existing = await db
    .select()
    .from(dailyResultsTable)
    .where(and(
      eq(dailyResultsTable.playerId, playerId),
      eq(dailyResultsTable.challengeDate, today),
      eq(dailyResultsTable.language, normalizedLanguage),
    ))
    .limit(1);

  if (existing.length > 0) {
    if (safeScore > existing[0].score) {
      await db.update(dailyResultsTable)
        .set({ score: safeScore, playerName: playerName.trim().slice(0, 40), avatarColor: avatarColor || existing[0].avatarColor })
        .where(eq(dailyResultsTable.id, existing[0].id));
    }
    res.json({ updated: true, alreadyPlayed: true });
    return;
  }

  try {
    await db.insert(dailyResultsTable).values({
      playerId,
      playerName: playerName.trim().slice(0, 40),
      avatarColor: avatarColor || "#e53e3e",
      challengeDate: today,
      score: safeScore,
      letter: challenge.letter,
      language: normalizedLanguage,
    });
  } catch (err: unknown) {
    // A unique DB constraint handles concurrent first submissions. Return the
    // same idempotent response rather than creating a second result.
    const message = err instanceof Error ? err.message : String(err);
    if (/unique|duplicate/i.test(message)) {
      res.json({ updated: false, alreadyPlayed: true });
      return;
    }
    throw err;
  }

  res.status(201).json({ submitted: true });
});

router.get("/rankings", async (req, res) => {
  const language = normalizeLanguage(req.query.language) ?? "es";
  const today = getTodayUTC();
  const results = await db
    .select()
    .from(dailyResultsTable)
    .where(and(
      eq(dailyResultsTable.challengeDate, today),
      eq(dailyResultsTable.language, language),
    ))
    .orderBy(desc(dailyResultsTable.score))
    .limit(10);

  res.json({
    date: today,
    rankings: results.map((r, i) => ({
      rank: i + 1,
      playerName: r.playerName,
      avatarColor: r.avatarColor,
      score: r.score,
    })),
  });
});

export default router;
