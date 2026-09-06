import { Router, type IRouter } from "express";
import { db, followsTable, playerScoresTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

// GET /api/friends/list/:followerId — get all followed players
router.get("/list/:followerId", async (req, res) => {
  const { followerId } = req.params;
  if (!followerId) return res.status(400).json({ error: "followerId required" });
  if (!verifyClaimedIdentity(req, followerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }

  try {
    // 1. Obtener la lista de seguidos
    const follows = await db
      .select()
      .from(followsTable)
      .where(eq(followsTable.followerId, followerId));

    if (follows.length === 0) {
      return res.json({ friends: [] });
    }

    // 2. Obtener los IDs de los seguidos
    const followedIds = follows.map(f => f.followedId);

    // 3. Obtener datos actualizados de player_scores para esos IDs
    let playersData: any[] = [];
    try {
      // Intentamos obtener datos, pero si falla (por columnas que no existen), seguimos con datos vacíos
      playersData = await db
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
    } catch (err) {
      // Si falla (por columnas faltantes), intentamos solo con los campos básicos
      playersData = await db
        .select({
          playerId: playerScoresTable.playerId,
          playerName: playerScoresTable.playerName,
          avatarColor: playerScoresTable.avatarColor,
          isPremium: playerScoresTable.isPremium,
        })
        .from(playerScoresTable)
        .where(inArray(playerScoresTable.playerId, followedIds));
    }

    // 4. Crear mapa para acceso rápido
    const playerMap = new Map();
    for (const p of playersData) {
      playerMap.set(p.playerId, p);
    }

    // 5. Combinar datos
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
  } catch (error) {
    console.error("Error en /friends/list:", error);
    // En caso de error, devolver al menos la lista básica con los datos guardados en follows
    const fallback = follows.map(f => ({
      followerId: f.followerId,
      followedId: f.followedId,
      followedName: f.followedName,
      followedPicture: f.followedPicture,
      followedAvatarColor: f.followedAvatarColor,
      followedProvider: f.followedProvider,
      equippedAvatar: null,
      equippedFrame: null,
      equippedBackground: null,
      isPremium: false,
    }));
    return res.json({ friends: fallback });
  }
});

// POST /api/friends/follow — follow a player (sin cambios)
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
  if (!verifyClaimedIdentity(req, followerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
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

// DELETE /api/friends/unfollow — unfollow a player (sin cambios)
router.delete("/unfollow", async (req, res) => {
  const { followerId, followedId } = req.body as { followerId: string; followedId: string };

  if (!followerId || !followedId) {
    return res.status(400).json({ error: "followerId and followedId required" });
  }
  if (!verifyClaimedIdentity(req, followerId)) {
    return res.status(403).json({ error: "Invalid player identity" });
  }

  await db
    .delete(followsTable)
    .where(and(eq(followsTable.followerId, followerId), eq(followsTable.followedId, followedId)));

  return res.json({ ok: true });
});

export default router;
