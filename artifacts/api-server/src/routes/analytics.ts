import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { presenceLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();
const PLATFORMS = new Set(["web", "android", "ios"]);
const SERVER_SESSION_COOKIE = "stop_analytics_session";

function platformFromRequest(req: Request): "web" | "android" | "ios" {
  const explicit = String(req.headers["x-client-platform"] ?? "").toLowerCase();
  if (PLATFORMS.has(explicit)) return explicit as "web" | "android" | "ios";
  const ua = String(req.headers["user-agent"] ?? "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "web";
}

async function ensureAnalyticsTables(): Promise<void> {
  await db.execute(sql.raw(`
    CREATE TABLE IF NOT EXISTS analytics_sessions (
      session_id text PRIMARY KEY,
      player_id text,
      platform text NOT NULL DEFAULT 'web',
      app_version text,
      language text,
      last_seen timestamp NOT NULL DEFAULT NOW(),
      started_at timestamp NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS analytics_sessions_last_seen_idx ON analytics_sessions (last_seen);
    CREATE INDEX IF NOT EXISTS analytics_sessions_platform_last_seen_idx ON analytics_sessions (platform, last_seen);
    CREATE TABLE IF NOT EXISTS analytics_events (
      id serial PRIMARY KEY,
      event_name text NOT NULL,
      player_id text,
      session_id text,
      platform text NOT NULL DEFAULT 'web',
      app_version text,
      language text,
      mode text,
      ai_difficulty text,
      metadata_json text NOT NULL DEFAULT '{}',
      created_at timestamp NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at);
    CREATE INDEX IF NOT EXISTS analytics_events_platform_created_at_idx ON analytics_events (platform, created_at);
    CREATE INDEX IF NOT EXISTS analytics_events_name_created_at_idx ON analytics_events (event_name, created_at);
  `));
}

const analyticsTablesReady = ensureAnalyticsTables().catch((err) => {
  console.error("[analytics] schema initialization failed:", err);
  throw err;
});

function serverSessionId(req: Request, res: any): string {
  const raw = String(req.headers.cookie ?? "");
  const match = raw.match(/(?:^|;\s*)stop_analytics_session=([^;]+)/);
  if (match?.[1] && match[1].length <= 128) return match[1];
  const id = randomUUID();
  res.cookie(SERVER_SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 30 * 24 * 60 * 60 * 1000, path: "/" });
  return id;
}

// Fallback for cached clients: normal API/page requests also refresh a session.
// Analytics errors are swallowed and can never block gameplay.
router.use(async (req, res, next) => {
  if (req.path === "/summary" || req.path === "/event" || req.path === "/heartbeat") return next();
  try {
    await analyticsTablesReady;
    const sessionId = serverSessionId(req, res);
    const platform = platformFromRequest(req);
    await db.execute(sql`
      INSERT INTO analytics_sessions (session_id, platform, last_seen, started_at)
      VALUES (${sessionId}, ${platform}, NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE SET platform = EXCLUDED.platform, last_seen = NOW()
    `);
  } catch (err) {
    console.error("[analytics] passive heartbeat failed:", err);
  }
  next();
});

router.post("/heartbeat", presenceLimiter, async (req, res) => {
  try {
    await analyticsTablesReady;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.trim() : "";
    if (!sessionId || sessionId.length > 128) return res.status(400).json({ error: "sessionId required" });
    const playerId = typeof body.playerId === "string" ? body.playerId.trim() : null;
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const appVersion = String(req.headers["x-client-version"] ?? "").slice(0, 32) || null;
    const platform = platformFromRequest(req);
    await db.execute(sql`
      INSERT INTO analytics_sessions (session_id, player_id, platform, app_version, language, last_seen, started_at)
      VALUES (${sessionId}, ${playerId}, ${platform}, ${appVersion}, ${language}, NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE SET player_id = EXCLUDED.player_id, platform = EXCLUDED.platform, app_version = EXCLUDED.app_version, language = EXCLUDED.language, last_seen = NOW()
    `);
    await db.execute(sql`
      INSERT INTO analytics_events (event_name, session_id, platform, app_version, language, metadata_json)
      SELECT 'session_start', ${sessionId}, ${platform}, ${appVersion}, ${language}, '{}'
      WHERE NOT EXISTS (SELECT 1 FROM analytics_events WHERE event_name = 'session_start' AND session_id = ${sessionId})
    `);
    return res.json({ ok: true, platform, appVersion });
  } catch (err) {
    console.error("[analytics] heartbeat failed:", err);
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.post("/event", presenceLimiter, async (req, res) => {
  try {
    await analyticsTablesReady;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventName = typeof body.eventName === "string" ? body.eventName.trim().slice(0, 80) : "";
    if (!eventName) return res.status(400).json({ error: "eventName required" });
    const clean = (value: unknown, max: number): string | null => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const metadataJson = JSON.stringify(metadata).slice(0, 4000);
    await db.execute(sql`
      INSERT INTO analytics_events (event_name, player_id, session_id, platform, app_version, language, mode, ai_difficulty, metadata_json)
      VALUES (${eventName}, ${clean(body.playerId, 128)}, ${clean(body.sessionId, 128)}, ${platformFromRequest(req)}, ${String(req.headers["x-client-version"] ?? "").slice(0, 32) || null}, ${clean(body.language, 16)}, ${clean(body.mode, 32)}, ${clean(body.aiDifficulty, 32)}, ${metadataJson})
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[analytics] event failed:", err);
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    await analyticsTablesReady;
    const rows = await db.execute(sql`SELECT platform, COUNT(*)::int AS active FROM analytics_sessions WHERE last_seen >= NOW() - INTERVAL '90 seconds' GROUP BY platform ORDER BY platform`);
    return res.json({ platforms: rows.rows });
  } catch (err) {
    console.error("[analytics] summary failed:", err);
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

export default router;
