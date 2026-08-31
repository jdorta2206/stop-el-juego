import { Router, type Request, type Response } from "express";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router = Router();
const PLATFORMS = new Set(["web", "android", "ios"]);
const EVENTS = new Set(["session_start", "heartbeat", "game_start", "game_complete", "game_abandon", "login", "register", "premium", "ad_impression"]);
function clean(value: unknown, max = 120): string | null { if (typeof value !== "string") return null; const v = value.trim(); return v ? v.slice(0, max) : null; }
function platform(req: Request): string { const value = String(req.header("x-client-platform") || "web").toLowerCase(); return PLATFORMS.has(value) ? value : "web"; }
router.post("/event", async (req, res) => {
  try {
    const event = clean(req.body?.event, 64);
    if (!event || !EVENTS.has(event)) return res.status(400).json({ error: "Invalid event" });
    await db.execute(sql`INSERT INTO analytics_events (event_name, platform, player_id, app_version, language, game_mode, ai_difficulty, session_id, created_at) VALUES (${event}, ${platform(req)}, ${clean(req.body?.playerId, 128)}, ${clean(req.body?.appVersion, 32)}, ${clean(req.body?.language, 16)}, ${clean(req.body?.mode, 64)}, ${clean(req.body?.aiDifficulty, 32)}, ${clean(req.body?.sessionId, 128)}, now())`);
    return res.status(204).end();
  } catch (error) { console.error("[analytics] event ignored:", error instanceof Error ? error.message : error); return res.status(204).end(); }
});
router.get("/summary", async (_req, res) => {
  try {
    const platforms = (await db.execute(sql`SELECT platform, COUNT(*) FILTER (WHERE created_at >= now() - interval '24 hours') AS events_24h, COUNT(*) FILTER (WHERE event_name = 'session_start' AND created_at >= now() - interval '24 hours') AS sessions_24h, COUNT(*) FILTER (WHERE event_name = 'game_start' AND created_at >= now() - interval '24 hours') AS games_24h, COUNT(*) FILTER (WHERE event_name = 'game_complete' AND created_at >= now() - interval '24 hours') AS completed_24h, COUNT(*) FILTER (WHERE event_name = 'game_abandon' AND created_at >= now() - interval '24 hours') AS abandoned_24h, COUNT(*) FILTER (WHERE event_name = 'ad_impression' AND created_at >= now() - interval '24 hours') AS ad_impressions_24h, COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'heartbeat' AND created_at >= now() - interval '5 minutes') AS active_sessions FROM analytics_events GROUP BY platform ORDER BY platform`)).rows;
    const ai = (await db.execute(sql`SELECT platform, ai_difficulty, COUNT(*) AS games FROM analytics_events WHERE event_name IN ('game_start','game_complete') AND created_at >= now() - interval '30 days' AND ai_difficulty IS NOT NULL GROUP BY platform, ai_difficulty ORDER BY platform, ai_difficulty`)).rows;
    return res.json({ generatedAt: new Date().toISOString(), platforms, ai });
  } catch (error) { console.error("[analytics] summary error:", error instanceof Error ? error.message : error); return res.status(500).json({ error: "Analytics unavailable" }); }
});
export default router;
