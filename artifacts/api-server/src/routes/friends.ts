import { Router, type IRouter } from "express";
import { db, followsTable, playerScoresTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/friends/list/:followerId — get all followed players with latest data
router.get("/list/:followerId", async (req, res) => {
  const { followerId } = req.params;
  if (!followerId) return res.status(400).json({ error: "followerId required" });

  // Primero obtenemos la lista de seguidos
  const follows = await db
    .select()
    .from(followsTable)
    .where(eq(followsTable.followerId, followerId));

  if (follows.length === 0) {
    return res.json({ friends: [] });
  }

  // Extraemos los IDs de los seguidos
  const followedIds = follows.map(f => f.followedId);

  // Obtenemos los datos actualizados de esos jugadores desde player_scores
  const playersData = await db
    .select({
      playerId: playerScoresTable.playerId,
      playerName: playerScoresTable.playerName,
      avatarColor: playerScoresTable.avatarColor,
      equippedAvatar: playerScoresTable.equippedAvatar,
      equippedFrame: playerScoresTable.equippedFrame,
      equippedBackground: playerScoresTable.equippedBackground,
      isPremium: playerScoresTable.isPremium,
    })
    .from(playerScoresTable)
    .where(inArray(playerScoresTable.playerId, followedIds));

  // Creamos un mapa para acceso rápido
  const playerMap = new Map();
  for (const p of playersData) {
    playerMap.set(p.playerId, p);
  }

  // Combinamos los datos de follows con los de player_scores
  const result = follows.map(f => {
    const p = playerMap.get(f.followedId);
    return {
      followerId: f.followerId,
      followedId: f.followedId,
      followedName: p?.playerName ?? f.followedName,
      followedPicture: f.followedPicture,
      followedAvatarColor: p?.avatarColor ?? f.followedAvatarColor,
      followedProvider: f.followedProvider,
      equippedAvatar: p?.equippedAvatar ?? null,
      equippedFrame: p?.equippedFrame ?? null,
      equippedBackground: p?.equippedBackground ?? null,
      isPremium: p?.isPremium ?? false,
    };
  });

  return res.json({ friends: result });
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

  const existing = await db
    .select()
    .from(followsTable)
    .where(and(eq(followsTable.followerId, followerId), eq(followsTable.followedId, followedId)));

  if (existing.length > 0) {
    return res.json({ ok: true, alreadyFollowing: true });
  }

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
