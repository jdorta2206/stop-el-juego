import { Router, type IRouter } from "express";
import { db, followsTable } from "@workspace/db";
import { and, eq } from "drizzle-orm";

const router: IRouter = Router();

// GET /api/friends/list/:followerId — get all followed players
router.get("/list/:followerId", async (req, res) => {
  const { followerId } = req.params;
  if (!followerId) return res.status(400).json({ error: "followerId required" });

  const rows = await db
    .select()
    .from(followsTable)
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
