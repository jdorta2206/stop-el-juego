import { Router, type IRouter } from "express";
import { db, followsTable, playerScoresTable } from "@workspace/db";
import { and, eq, inArray } from "drizzle-orm";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router: IRouter = Router();

router.get("/list/:followerId", async (req, res) => {
  const { followerId } = req.params;
  if (!followerId) return res.status(400).json({ error: "followerId required" });
  if (!verifyClaimedIdentity(req, followerId)) return res.status(403).json({ error: "Invalid player identity" });

  let follows: any[] = [];
  try {
    follows = await db.select().from(followsTable).where(eq(followsTable.followerId, followerId));
    if (follows.length === 0) return res.json({ friends: [] });

    const followedIds = follows.map(f => f.followedId);
    let playersData: any[] = [];
    try {
      playersData = await db.select({
        playerId: playerScoresTable.playerId,
        playerName: playerScoresTable.playerName,
        avatarColor: playerScoresTable.avatarColor,
        equippedAvatar: playerScoresTable.equippedAvatar,
        equippedFrame: playerScoresTable.equippedFrame,
        equippedBackground: playerScoresTable.equippedBackground,
        equippedTitle: playerScoresTable.equippedTitle,
        profilePicture: playerScoresTable.profilePicture,
        isPremium: playerScoresTable.isPremium,
      }).from(playerScoresTable).where(inArray(playerScoresTable.playerId, followedIds));
    } catch {
      playersData = await db.select({
        playerId: playerScoresTable.playerId,
        playerName: playerScoresTable.playerName,
        avatarColor: playerScoresTable.avatarColor,
        isPremium: playerScoresTable.isPremium,
      }).from(playerScoresTable).where(inArray(playerScoresTable.playerId, followedIds));
    }

    const playerMap = new Map();
    for (const p of playersData) playerMap.set(p.playerId, p);

    const result = follows.map(f => {
      const p = playerMap.get(f.followedId);
      return {
        followerId: f.followerId,
        followedId: f.followedId,
        followedName: p?.playerName ?? f.followedName,
        followedPicture: p?.profilePicture ?? f.followedPicture,
        followedAvatarColor: p?.avatarColor ?? f.followedAvatarColor,
        followedProvider: f.followedProvider,
        equippedAvatar: p?.equippedAvatar ?? null,
        equippedFrame: p?.equippedFrame ?? null,
        equippedBackground: p?.equippedBackground ?? null,
        equippedTitle: p?.equippedTitle ?? null,
        isPremium: p?.isPremium ?? false,
      };
    });
    return res.json({ friends: result });
  } catch (error) {
    console.error("Error en /friends/list:", error);
    return res.status(500).json({ error: "Failed to load friends" });
  }
});

router.post("/follow", async (req, res) => {
  const { followerId, followedId, followedName, followedPicture, followedAvatarColor, followedProvider } =
    req.body as { followerId: string; followedId: string; followedName: string; followedPicture?: string | null; followedAvatarColor?: string; followedProvider?: string | null; };
  if (!followerId || !followedId || !followedName) return res.status(400).json({ error: "followerId, followedId and followedName required" });
  if (!verifyClaimedIdentity(req, followerId)) return res.status(403).json({ error: "Invalid player identity" });
  if (followerId === followedId) return res.status(400).json({ error: "Cannot follow yourself" });

  const existing = await db.select().from(followsTable).where(and(eq(followsTable.followerId, followerId), eq(followsTable.followedId, followedId)));
  if (existing.length > 0) return res.json({ ok: true, alreadyFollowing: true });

  await db.insert(followsTable).values({
    followerId, followedId, followedName,
    followedPicture: followedPicture || null,
    followedAvatarColor: followedAvatarColor || "#e53e3e",
    followedProvider: followedProvider || null,
  }).onConflictDoNothing({ target: [followsTable.followerId, followsTable.followedId] });

  return res.json({ ok: true });
});

router.delete("/unfollow", async (req, res) => {
  const { followerId, followedId } = req.body as { followerId: string; followedId: string };
  if (!followerId || !followedId) return res.status(400).json({ error: "followerId and followedId required" });
  if (!verifyClaimedIdentity(req, followerId)) return res.status(403).json({ error: "Invalid player identity" });

  await db.delete(followsTable).where(and(eq(followsTable.followerId, followerId), eq(followsTable.followedId, followedId)));
  return res.json({ ok: true });
});

export default router;
