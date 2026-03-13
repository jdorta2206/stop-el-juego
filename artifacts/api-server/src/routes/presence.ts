import { Router, type IRouter } from "express";

const router: IRouter = Router();

// In-memory presence store: playerId → presence data
interface PresenceEntry {
  name: string;
  picture: string | null;
  avatarColor: string;
  provider: string | null;
  roomCode: string | null;
  lastSeen: number;
}

const presenceMap = new Map<string, PresenceEntry>();

// Clean up stale entries every 2 minutes
setInterval(() => {
  const cutoff = Date.now() - 3 * 60 * 1000;
  for (const [id, data] of presenceMap) {
    if (data.lastSeen < cutoff) presenceMap.delete(id);
  }
}, 2 * 60 * 1000);

// POST /api/presence/ping
// Body: { playerId, name, picture?, avatarColor?, provider?, roomCode? }
router.post("/ping", (req, res) => {
  const { playerId, name, picture, avatarColor, provider, roomCode } = req.body as {
    playerId: string;
    name: string;
    picture?: string | null;
    avatarColor?: string;
    provider?: string | null;
    roomCode?: string | null;
  };

  if (!playerId || !name) {
    return res.status(400).json({ error: "playerId and name required" });
  }

  presenceMap.set(playerId, {
    name,
    picture: picture || null,
    avatarColor: avatarColor || "#e53e3e",
    provider: provider || null,
    roomCode: roomCode || null,
    lastSeen: Date.now(),
  });

  return res.json({ ok: true });
});

// GET /api/presence/online
// Returns all players seen in last 90 seconds
router.get("/online", (_req, res) => {
  const cutoff = Date.now() - 90 * 1000;
  const online: Array<{
    playerId: string;
    name: string;
    picture: string | null;
    avatarColor: string;
    provider: string | null;
    roomCode: string | null;
    lastSeen: number;
  }> = [];

  for (const [playerId, data] of presenceMap) {
    if (data.lastSeen >= cutoff) {
      online.push({ playerId, ...data });
    }
  }

  // Sort: most recently seen first
  online.sort((a, b) => b.lastSeen - a.lastSeen);
  return res.json({ online });
});

export default router;
