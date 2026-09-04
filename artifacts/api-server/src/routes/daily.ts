import { Router, type IRouter } from "express";
import { db, dailyResultsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { sumVerifiedBase, ceilingFromBase, absoluteCeiling } from "../lib/scoreToken";

const router: IRouter = Router();

function getTodayUTC(): string {
  return new Date().toISOString().slice(0, 10);
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

router.get("/", (req, res) => {
  const language = (req.query.language as string) || "es";
  const today = getTodayUTC();
  res.json(getDailyChallenge(today, language));
});

router.post("/submit", async (req, res) => {
  const { playerId, playerName, avatarColor, score, letter, language, scoreTokens } = req.body;
  if (!playerId || !playerName || score == null || !letter) {
    res.status(400).json({ error: "Missing required fields" });
    return;
  }
  if (!verifyClaimedIdentity(req, playerId)) {
    res.status(403).json({ error: "Identity verification failed" });
    return;
  }

  const { base: verifiedBase, verified } = await sumVerifiedBase(scoreTokens, 1);
  const dailyCeiling = verified > 0 ? ceilingFromBase(verifiedBase) : absoluteCeiling("daily");
  const safeScore = Math.max(0, Math.min(Number(score) || 0, dailyCeiling));
  const today = getTodayUTC();

  try {
    const result = await db.transaction(async (tx) => {
      // Serialize this player's daily submission so two concurrent requests
      // cannot both pass the read-before-insert check and create duplicates.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext(${`${playerId}:${today}`}))`);

      const existing = await tx.select().from(dailyResultsTable).where(and(
        eq(dailyResultsTable.playerId, playerId),
        eq(dailyResultsTable.challengeDate, today)
      )).limit(1);

      if (existing.length > 0) {
        if (safeScore > existing[0].score) {
          await tx.update(dailyResultsTable).set({
            score: safeScore,
            playerName,
            avatarColor: avatarColor || existing[0].avatarColor,
          }).where(and(
            eq(dailyResultsTable.playerId, playerId),
            eq(dailyResultsTable.challengeDate, today)
          ));
        }
        return { status: 200 as const, body: { updated: true, alreadyPlayed: true } };
      }

      await tx.insert(dailyResultsTable).values({
        playerId,
        playerName,
        avatarColor: avatarColor || "#e53e3e",
        challengeDate: today,
        score: safeScore,
        letter,
        language: language || "es",
      });

      return { status: 201 as const, body: { submitted: true } };
    });

    res.status(result.status).json(result.body);
  } catch (e: unknown) {
    console.error("[daily/submit] error:", e instanceof Error ? e.message : String(e));
    res.status(500).json({ error: "Failed to submit daily challenge" });
  }
});

router.get("/rankings", async (req, res) => {
  const language = (req.query.language as string) || "es";
  const today = getTodayUTC();
  const results = await db.select().from(dailyResultsTable).where(and(
    eq(dailyResultsTable.challengeDate, today),
    eq(dailyResultsTable.language, language)
  )).orderBy(desc(dailyResultsTable.score)).limit(10);
  res.json({ date: today, rankings: results.map((r, i) => ({ ...r, rank: i + 1 })) });
});

export default router;
