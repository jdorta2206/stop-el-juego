import { Router } from "express";
import { db, playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router = Router();

type CollectionMap = Record<string, unknown>;

function parseCollection(raw: string | null | undefined): CollectionMap {
  try {
    const parsed = JSON.parse(raw || "{}");
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed as CollectionMap : {};
  } catch {
    return {};
  }
}

/**
 * Collection/progress compatibility endpoint used by the web client.
 *
 * This data belongs to player_scores.collected_words_json. The endpoint is
 * intentionally separate from /ranking/scores so collection sync cannot
 * accidentally mutate leaderboard totals.
 */
router.get("/progress/:playerId", async (req, res) => {
  const playerId = String(req.params.playerId || "").trim();
  if (!playerId) return res.status(400).json({ error: "Missing playerId", collectedWords: {} });

  try {
    const rows = await db
      .select({ collectedWordsJson: playerScoresTable.collectedWordsJson })
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, playerId))
      .limit(1);

    // A newly created/guest player may not have a player_scores row yet.
    // Returning an empty progress object is safer for the client than a 404:
    // collection sync is best-effort and must never break the game UI.
    if (rows.length === 0) return res.json({ playerId, collectedWords: {} });

    return res.json({
      playerId,
      collectedWords: parseCollection(rows[0].collectedWordsJson),
    });
  } catch (error) {
    console.error("[ranking/progress] GET failed:", error);
    return res.status(500).json({ error: "Could not load progress", collectedWords: {} });
  }
});

router.post("/progress/:playerId", async (req, res) => {
  const playerId = String(req.params.playerId || "").trim();
  if (!playerId) return res.status(400).json({ error: "Missing playerId" });

  if (!verifyClaimedIdentity(req, playerId)) {
    return res.status(403).json({ error: "Identity verification failed" });
  }

  const incoming = req.body?.collectedWords;
  if (!incoming || typeof incoming !== "object" || Array.isArray(incoming)) {
    return res.status(400).json({ error: "Invalid collectedWords" });
  }

  try {
    const rows = await db
      .select({ id: playerScoresTable.id, collectedWordsJson: playerScoresTable.collectedWordsJson })
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, playerId))
      .limit(1);

    if (rows.length === 0) return res.status(404).json({ error: "Player not found" });

    // Collection is append-only. Never replace server discoveries with a
    // stale client snapshot; merge keys and preserve the server copy.
    const current = parseCollection(rows[0].collectedWordsJson);
    const merged: CollectionMap = { ...current };
    for (const [key, value] of Object.entries(incoming as CollectionMap)) {
      if (!(key in merged)) merged[key] = value;
    }

    await db
      .update(playerScoresTable)
      .set({ collectedWordsJson: JSON.stringify(merged), updatedAt: new Date() })
      .where(eq(playerScoresTable.id, rows[0].id));

    return res.json({ ok: true, playerId, collectedWords: merged });
  } catch (error) {
    console.error("[ranking/progress] POST failed:", error);
    return res.status(500).json({ error: "Could not save progress" });
  }
});

export default router;
