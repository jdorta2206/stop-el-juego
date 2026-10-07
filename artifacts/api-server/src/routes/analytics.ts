import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { presenceLimiter } from "../middlewares/rateLimit";
import { readPlayerId } from "../lib/playerAuth";

const router: IRouter = Router();
const PLATFORMS = new Set(["web", "android", "ios"]);
const TRUSTED_CLIENT_TELEMETRY_EVENTS = new Set(["game_lobby_view"]);
const SERVER_SESSION_COOKIE = "stop_analytics_session";
const CURRENT_TWA_ANALYTICS_VERSION = "1.3.6.8";
const CURRENT_WEB_ANALYTICS_VERSION = String(process.env.RAILWAY_GIT_COMMIT_SHA ?? "web-dev").slice(0, 12);

function isTwaRequest(req: Request): boolean {
  if (String(req.headers["x-client-twa"] ?? "") === "1") return true;
  const referrer = String(req.headers.referer ?? req.headers.referrer ?? "");
  if (referrer.startsWith("android-app://")) return true;
  return /STOPApp\/[0-9][0-9.]*/i.test(String(req.headers["user-agent"] ?? ""));
}

function appVersionFromRequest(req: Request): string | null {
  const clientVersion = String(req.headers["x-client-version"] ?? "").trim().slice(0, 32);
  if (clientVersion) return clientVersion;
  return isTwaRequest(req) ? CURRENT_TWA_ANALYTICS_VERSION : CURRENT_WEB_ANALYTICS_VERSION;
}

function platformFromRequest(req: Request): "web" | "android" | "ios" {
  const explicit = String(req.headers["x-client-platform"] ?? "").toLowerCase();
  const twa = String(req.headers["x-client-twa"] ?? "") === "1";
  if (twa) return "android";
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
    ALTER TABLE analytics_sessions ADD COLUMN IF NOT EXISTS login_method text;
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
      trusted boolean NOT NULL DEFAULT FALSE,
      created_at timestamp NOT NULL DEFAULT NOW()
    );
    CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at);
    CREATE INDEX IF NOT EXISTS analytics_events_platform_created_at_idx ON analytics_events (platform, created_at);
    CREATE INDEX IF NOT EXISTS analytics_events_name_created_at_idx ON analytics_events (event_name, created_at);
    ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS metadata_json text NOT NULL DEFAULT '{}';
    ALTER TABLE analytics_events ADD COLUMN IF NOT EXISTS trusted boolean NOT NULL DEFAULT FALSE;
  `));
}

const analyticsTablesReady = ensureAnalyticsTables().catch((err) => {
  console.error("[analytics] schema initialization failed:", err);
  throw err;
});

async function latestPlatformForPlayer(playerId: string | null | undefined): Promise<"web" | "android" | "ios" | null> {
  if (!playerId) return null;
  const rows = await db.execute(sql`
    SELECT platform
    FROM analytics_sessions
    WHERE player_id = ${playerId}
      AND platform IN ('web', 'android', 'ios')
    ORDER BY last_seen DESC
    LIMIT 1
  `);
  const platform = String((rows.rows[0] as any)?.platform ?? "");
  return platform === "android" || platform === "ios" || platform === "web" ? platform : null;
}

export async function recordTrustedAnalyticsEvent(input: {
  eventName: string;
  playerId?: string | null;
  platform?: "web" | "android" | "ios";
  appVersion?: string | null;
  language?: string | null;
  mode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await analyticsTablesReady;
  const resolvedPlatform = input.platform ?? await latestPlatformForPlayer(input.playerId);
  const metadataJson = JSON.stringify(input.metadata ?? {}).slice(0, 4000);
  await db.execute(sql`
    INSERT INTO analytics_events
      (event_name, player_id, platform, app_version, language, mode, metadata_json, trusted)
    VALUES
      (${input.eventName}, ${input.playerId ?? null}, ${resolvedPlatform ?? "web"},
       ${input.appVersion ?? null}, ${input.language ?? null}, ${input.mode ?? null},
       ${metadataJson}, TRUE)
  `);
}

function serverSessionId(req: Request, res: any): string {
  const raw = String(req.headers.cookie ?? "");
  const match = raw.match(/(?:^|;\s*)stop_analytics_session=([^;]+)/);
  if (match?.[1] && match[1].length <= 128) return match[1];
  const id = randomUUID();
  res.cookie(SERVER_SESSION_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: true, maxAge: 30 * 24 * 60 * 60 * 1000, path: "/" });
  return id;
}

router.use(async (req, res, next) => {
  if (req.path === "/summary" || req.path === "/event" || req.path === "/heartbeat") return next();
  try {
    await analyticsTablesReady;
    const sessionId = serverSessionId(req, res);
    const platform = platformFromRequest(req);
    const appVersion = appVersionFromRequest(req);
    await db.execute(sql`
      INSERT INTO analytics_sessions (session_id, platform, app_version, last_seen, started_at)
      VALUES (${sessionId}, ${platform}, ${appVersion}, NOW(), NOW())
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
    const sessionId = serverSessionId(req, res);
    // OAuth/player identity is always taken from the verified server token.
    // For guests there is no authenticated identity, so only the non-sensitive
    // login-method label "guest" is accepted for analytics classification.
    const playerId = readPlayerId(req);
    const loginMethod =
      !playerId && body.loginMethod === "guest"
        ? "guest"
        : null;
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const platform = platformFromRequest(req);
    const appVersion = appVersionFromRequest(req);
    await db.execute(sql`
      INSERT INTO analytics_sessions (session_id, player_id, login_method, platform, app_version, language, last_seen, started_at)
      VALUES (${sessionId}, ${playerId}, ${loginMethod}, ${platform}, ${appVersion}, ${language}, NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE SET player_id = EXCLUDED.player_id, login_method = EXCLUDED.login_method, platform = EXCLUDED.platform, app_version = EXCLUDED.app_version, language = EXCLUDED.language, last_seen = NOW()
    `);
    await db.transaction(async (tx) => {
      // Serialize the one-time session_start claim per session. The lock is
      // transaction-scoped, so concurrent heartbeats cannot both insert it.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`);
      await tx.execute(sql`
        INSERT INTO analytics_events (event_name, session_id, platform, app_version, language, metadata_json, trusted)
        SELECT 'session_start', ${sessionId}, ${platform}, ${appVersion}, ${language}, '{}', TRUE
        WHERE NOT EXISTS (
          SELECT 1 FROM analytics_events
          WHERE event_name = 'session_start' AND session_id = ${sessionId}
        )
      `);
    });
    return res.json({ ok: true, platform, appVersion });
  } catch (err) {
    console.error("[analytics] heartbeat failed:", err);
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.post("/game-start", presenceLimiter, async (req, res) => {
  try {
    await analyticsTablesReady;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = serverSessionId(req, res);
    const playerId = readPlayerId(req);
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const mode = typeof body.mode === "string" ? body.mode.slice(0, 32) : null;
    const appVersion = appVersionFromRequest(req);
    const platform = platformFromRequest(req);
    await db.execute(sql`
      INSERT INTO analytics_events
        (event_name, player_id, session_id, platform, app_version, language, mode, metadata_json, trusted)
      VALUES
        ('game_start', ${playerId}, ${sessionId}, ${platform}, ${appVersion}, ${language}, ${mode}, '{"source":"client_game_start"}', TRUE)
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[analytics] trusted game-start failed:", err);
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.post("/client-error", presenceLimiter, async (req, res) => {
  try {
    await analyticsTablesReady;
    const body = (req.body ?? {}) as Record<string, unknown>;
    const message = typeof body.message === "string" ? body.message.slice(0, 500) : "Unknown client error";
    const stack = typeof body.stack === "string" ? body.stack.slice(0, 2500) : null;
    const componentStack = typeof body.componentStack === "string" ? body.componentStack.slice(0, 2500) : null;
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null;
    const playerId = readPlayerId(req);
    const platform = platformFromRequest(req);
    const appVersion = String(req.headers["x-client-version"] ?? "").slice(0, 32) || null;
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const metadataJson = JSON.stringify({ message, stack, componentStack }).slice(0, 4000);
    await db.execute(sql`
      INSERT INTO analytics_events
        (event_name, player_id, session_id, platform, app_version, language, metadata_json, trusted)
      VALUES
        ('client_error', ${playerId}, ${sessionId}, ${platform}, ${appVersion}, ${language}, ${metadataJson}, TRUE)
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[analytics] client-error failed:", err);
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
    const playerId = readPlayerId(req);
    const sessionId = clean(body.sessionId, 128);
    const trusted = TRUSTED_CLIENT_TELEMETRY_EVENTS.has(eventName);
    await db.execute(sql`
      INSERT INTO analytics_events (event_name, player_id, session_id, platform, app_version, language, mode, ai_difficulty, metadata_json, trusted)
      VALUES (${eventName}, ${playerId}, ${sessionId}, ${platformFromRequest(req)}, ${String(req.headers["x-client-version"] ?? "").slice(0, 32) || null}, ${clean(body.language, 16)}, ${clean(body.mode, 32)}, ${clean(body.aiDifficulty, 32)}, ${metadataJson}, ${trusted})
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
