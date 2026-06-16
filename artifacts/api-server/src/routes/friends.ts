import { Router, type IRouter } from "express";
import { db, followsTable, playerScoresTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/friends/list/:followerId — get all followed players with their latest cosmetics
router.get("/list/:followerId", async (req, res) => {
  const { followerId } = req.params;
  if (!followerId) return res.status(400).json({ error: "followerId required" });

  // Join with player_scores to get up‑to‑date names, colors, premium and equipped cosmetics
  const rows = await db
    .select({
      followerId: followsTable.followerId,
      followedId: followsTable.followedId,
      followedName: playerScoresTable.playerName,           // freshest name
      followedPicture: followsTable.followedPicture,        // kept from follow time
      followedAvatarColor: playerScoresTable.avatarColor,   // freshest color
      followedProvider: followsTable.followedProvider,
      // 🆕 COSMÉTICOS EQUIPADOS
      equippedAvatar: playerScoresTable.equippedAvatar,
      equippedFrame: playerScoresTable.equippedFrame,
      equippedBackground: playerScoresTable.equippedBackground,
      isPremium: playerScoresTable.isPremium,
    })
    .from(followsTable)
    .leftJoin(playerScoresTable, eq(followsTable.followedId, playerScoresTable.playerId))
    .where(eq(followsTable.followerId, followerId));

  return res.json({ friends: rows });
});

// POST /api/friends/follow — follow a player
router.post("/follow", async (req, res) => {
  const { followerId, followedId, followedName, followedPicture, followedAvatarColor, followedProvider } =
    req.body as {
      followerId: string;
      followedId: string;
      followedName: string;
      followedPicture?: string | null;
      followedAvatarColor?: string;
      followedProvider?: string | null;
    };

  if (!followerId || !followedId || !followedName) {
    return res.status(400).json({ error: "followerId, followedId and followedName required" });
  }
  if (followerId === followedId) {
    return res.status(400).json({ error: "Cannot follow yourself" });
  }

  // Check already following
  const existing = await db
    .select()
    .from(followsTable)
    .where(and(eq(followsTable.followerId, followerId), eq(followsTable.followedId, followedId)));

  if (existing.length > 0) {
    return res.json({ ok: true, alreadyFollowing: true });
  }

  // Store the follow relationship. We keep a snapshot of the followed player's
  // name/color at follow time as a fallback, but the GET endpoint will always
  // fetch the latest data from player_scores via the JOIN.
  await db.insert(followsTable).values({
    followerId,
    followedId,
    followedName,
    followedPicture: followedPicture || null,
    followedAvatarColor: followedAvatarColor || "#e53e3e",
    followedProvider: followedProvider || null,
  });

  return res.json({ ok: true });
});

// DELETE /api/friends/unfollow — unfollow a player
router.delete("/unfollow", async (req, res) => {
  const { followerId, followedId } = req.body as { followerId: string; followedId: string };

  if (!followerId || !followedId) {
    return res.status(400).json({ error: "followerId and followedId required" });
  }

  await db
    .delete(followsTable)
    .where(and(eq(followsTable.followerId, followerId), eq(followsTable.followedId, followedId)));

  return res.json({ ok: true });
});

export default router;
