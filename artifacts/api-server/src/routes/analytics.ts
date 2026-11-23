import { Router, type IRouter, type Request } from "express";
import { randomUUID } from "crypto";
import { db, pool } from "@workspace/db";
import { sql } from "drizzle-orm";
import { presenceLimiter } from "../middlewares/rateLimit";
import { readPlayerId } from "../lib/playerAuth";

const router: IRouter = Router();
const PLATFORMS = new Set(["web", "android", "ios"]);
const TRUSTED_CLIENT_TELEMETRY_EVENTS = new Set([
  "game_lobby_view",
  "lobby_view",
  "lobby_ready",
  "lobby_auth_resolved",
  "lobby_daily_status_started",
  "lobby_daily_status_succeeded",
  "lobby_daily_status_failed",
  "lobby_room_load_started",
  "lobby_room_loaded",
  "lobby_room_load_failed",
  "lobby_api_timeout",
  "lobby_auth_failed",
  "lobby_page_exit",
  "rewarded_ad_pending",
  "rewarded_ad_request_created",
  "game_complete",
  "rewarded_ad_requested",
  "rewarded_ad_completed",
  "rewarded_ad_failed",
  "powerup_used",
  "halloween_event_enter",
  "halloween_scare_seen",
  "halloween_scare_report_attempt",
  "halloween_scare_report_saved",
  "halloween_scare_report_failed",
]);
function redactClientDiagnostic(value: unknown, max: number): string | null {
  if (typeof value !== "string" || !value) return null;
  return value.slice(0, max)
    .replace(/\bBearer\s+[A-Za-z0-9._~+\/-]+=*/gi, "Bearer [redacted]")
    .replace(/\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g, "[token redacted]")
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, "[email redacted]")
    .replace(/([?&](?:token|access_token|refresh_token|authorization|key|api_key|code)=)[^&#\s]*/gi, "$1[redacted]")
    .replace(/(token|password|authorization|cookie|secret|api[_-]?key)\s*[:=]\s*[^\s,;]+/gi, "$1=[redacted]")
    .replace(/\b(?:\d{1,3}\.){3}\d{1,3}\b/g, "[ip redacted]")
    .replace(/\b[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\b/gi, "[id redacted]");
}

function sanitizeClientMetadata(value: unknown, depth = 0): unknown {
  if (depth > 4) return "[truncated]";
  if (typeof value === "string") return redactClientDiagnostic(value, 1000);
  if (Array.isArray(value)) return value.slice(0, 25).map((item) => sanitizeClientMetadata(item, depth + 1));
  if (value && typeof value === "object") {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>).slice(0, 40).map(([key, item]) => [
      key.slice(0, 64),
      /password|token|secret|authorization|cookie|api[_-]?key/i.test(key)
        ? "[redacted]"
        : sanitizeClientMetadata(item, depth + 1),
    ]));
  }
  return value;
}

const SERVER_SESSION_COOKIE = "stop_analytics_session";
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
  // Do not attribute an unknown TWA build to a hard-coded legacy version.
  return isTwaRequest(req) ? null : CURRENT_WEB_ANALYTICS_VERSION;
}

function platformFromRequest(req: Request): "web" | "android" | "ios" {
  const explicit = String(req.headers["x-client-platform"] ?? "").toLowerCase();
  const twa = isTwaRequest(req);
  if (twa) return "android";
  if (PLATFORMS.has(explicit)) return explicit as "web" | "android" | "ios";
  const ua = String(req.headers["user-agent"] ?? "").toLowerCase();
  if (/iphone|ipad|ipod/.test(ua)) return "ios";
  if (/android/.test(ua)) return "android";
  return "web";
}

async function ensureAnalyticsTables(): Promise<void> {
  const client = await pool.connect();
  try {
    const stmts = [
      `CREATE TABLE IF NOT EXISTS public.analytics_sessions (
        session_id text PRIMARY KEY,
        player_id text,
        platform text NOT NULL DEFAULT 'web',
        app_version text,
        language text,
        last_seen timestamp NOT NULL DEFAULT NOW(),
        started_at timestamp NOT NULL DEFAULT NOW()
      )`,
      `ALTER TABLE public.analytics_sessions ADD COLUMN IF NOT EXISTS login_method text`,
      `CREATE INDEX IF NOT EXISTS analytics_sessions_last_seen_idx ON analytics_sessions (last_seen)`,
      `CREATE INDEX IF NOT EXISTS analytics_sessions_platform_last_seen_idx ON analytics_sessions (platform, last_seen)`,
      `CREATE TABLE IF NOT EXISTS public.analytics_events (
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
      )`,
      `ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS session_id text`,
      `ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS metadata_json text NOT NULL DEFAULT '{}'`,
      `ALTER TABLE public.analytics_events ADD COLUMN IF NOT EXISTS trusted boolean NOT NULL DEFAULT FALSE`,
      `CREATE INDEX IF NOT EXISTS analytics_events_created_at_idx ON analytics_events (created_at)`,
      `CREATE INDEX IF NOT EXISTS analytics_events_platform_created_at_idx ON analytics_events (platform, created_at)`,
      `CREATE INDEX IF NOT EXISTS analytics_events_name_created_at_idx ON analytics_events (event_name, created_at)`,
    ];

    for (const stmt of stmts) await client.query(stmt);

    const check = await client.query(`
      SELECT
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'analytics_events'
            AND column_name = 'metadata_json'
        ) AS metadata_json,
        EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_schema = current_schema()
            AND table_name = 'analytics_events'
            AND column_name = 'trusted'
        ) AS trusted
    `);
    const row = check.rows[0] as { metadata_json?: boolean; trusted?: boolean } | undefined;
    if (!row?.metadata_json || !row?.trusted) {
      throw new Error("Analytics schema verification failed: analytics_events columns are missing");
    }
    console.log("[analytics] schema ready: analytics_events.metadata_json/trusted verified");
  } finally {
    client.release();
  }
}

// Share one initialization attempt between concurrent requests. A failed attempt
// is discarded so a later request can retry after a transient database outage.
let analyticsTablesReady: Promise<void> | null = null;
let analyticsRetryAfter = 0;
let analyticsInitError: unknown = null;

export async function ensureAnalyticsReady(): Promise<void> {
  if (!analyticsTablesReady) {
    if (Date.now() < analyticsRetryAfter) {
      throw analyticsInitError ?? new Error("Analytics schema initialization is cooling down");
    }
    analyticsTablesReady = ensureAnalyticsTables().then(() => {
      analyticsRetryAfter = 0;
      analyticsInitError = null;
    }).catch((err) => {
      analyticsTablesReady = null;
      analyticsRetryAfter = Date.now() + 5_000;
      analyticsInitError = err;
      console.error("[analytics] schema initialization failed; retrying after cooldown; details withheld.");
      throw err;
    });
  }
  await analyticsTablesReady;
}

async function latestPlatformForPlayer(playerId: string | null | undefined): Promise<"web" | "android" | "ios" | null> {
  if (!playerId) return null;
  const rows = await db.execute(sql`
    SELECT platform
    FROM public.analytics_sessions
    WHERE player_id = ${playerId}
      AND platform IN ('web', 'android', 'ios')
    ORDER BY last_seen DESC
    LIMIT 1
  `);
  const platform = String((rows.rows[0] as any)?.platform ?? "");
  return platform === "android" || platform === "ios" || platform === "web" ? platform : null;
}

export function getAnalyticsSessionId(req: Request, res: any): string {
  return serverSessionId(req, res);
}

export async function recordTrustedAnalyticsEvent(input: {
  eventName: string;
  playerId?: string | null;
  sessionId?: string | null;
  platform?: "web" | "android" | "ios";
  appVersion?: string | null;
  language?: string | null;
  mode?: string | null;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await ensureAnalyticsReady();
  const resolvedPlatform = input.platform ?? await latestPlatformForPlayer(input.playerId);
  const metadataJson = JSON.stringify(sanitizeClientMetadata(input.metadata ?? {})).slice(0, 4000);
  await db.execute(sql`
    INSERT INTO public.analytics_events
      (event_name, player_id, session_id, platform, app_version, language, mode, metadata_json, trusted)
    VALUES
      (${input.eventName}, ${input.playerId ?? null}, ${input.sessionId ?? null}, ${resolvedPlatform ?? "web"},
       ${input.appVersion ?? null}, ${input.language ?? null}, ${input.mode ?? null},
       ${metadataJson}, TRUE)
  `);
}

function clientAnalyticsSessionId(body: Record<string, unknown>): string | null {
  const value = body.sessionId;
  return typeof value === "string" && /^[a-zA-Z0-9_-]{1,128}$/.test(value) ? value : null;
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
    await ensureAnalyticsReady();
    const sessionId = serverSessionId(req, res);
    const platform = platformFromRequest(req);
    const appVersion = appVersionFromRequest(req);
    await db.execute(sql`
      INSERT INTO public.analytics_sessions (session_id, platform, app_version, last_seen, started_at)
      VALUES (${sessionId}, ${platform}, ${appVersion}, NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE SET platform = EXCLUDED.platform, app_version = EXCLUDED.app_version, last_seen = NOW()
    `);
  } catch (err) {
    console.error("[analytics] passive heartbeat failed; details withheld.");
  }
  next();
});

router.post("/heartbeat", presenceLimiter, async (req, res) => {
  try {
    await ensureAnalyticsReady();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = clientAnalyticsSessionId(body) ?? serverSessionId(req, res);
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
      INSERT INTO public.analytics_sessions (session_id, player_id, login_method, platform, app_version, language, last_seen, started_at)
      VALUES (${sessionId}, ${playerId}, ${loginMethod}, ${platform}, ${appVersion}, ${language}, NOW(), NOW())
      ON CONFLICT (session_id) DO UPDATE SET player_id = EXCLUDED.player_id, login_method = EXCLUDED.login_method, platform = EXCLUDED.platform, app_version = EXCLUDED.app_version, language = EXCLUDED.language, last_seen = NOW()
    `);
    await db.transaction(async (tx) => {
      // Serialize the one-time session_start claim per session. The lock is
      // transaction-scoped, so concurrent heartbeats cannot both insert it.
      await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${sessionId}, 0))`);
      await tx.execute(sql`
        INSERT INTO public.analytics_events (event_name, session_id, platform, app_version, language, metadata_json, trusted)
        SELECT 'session_start', ${sessionId}, ${platform}, ${appVersion}, ${language}, '{}', TRUE
        WHERE NOT EXISTS (
          SELECT 1 FROM public.analytics_events
          WHERE event_name = 'session_start' AND session_id = ${sessionId}
        )
      `);
    });
    return res.json({ ok: true, platform, appVersion });
  } catch (err) {
    console.error("[analytics] heartbeat failed; details withheld.");
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.post("/game-start", presenceLimiter, async (req, res) => {
  try {
    await ensureAnalyticsReady();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const sessionId = clientAnalyticsSessionId(body) ?? serverSessionId(req, res);
    const playerId = readPlayerId(req);
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const mode = typeof body.mode === "string" ? body.mode.slice(0, 32) : null;
    const appVersion = appVersionFromRequest(req);
    const platform = platformFromRequest(req);
    const eventId = typeof body.eventId === "string" && /^[a-zA-Z0-9_-]{1,80}$/.test(body.eventId)
      ? body.eventId
      : null;
    if (eventId) {
      // Serialize retries for this logical start and persist at most one event.
      await db.transaction(async (tx) => {
        await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtextextended(${eventId}, 0))`);
        await tx.execute(sql`
          INSERT INTO public.analytics_events
            (event_name, player_id, session_id, platform, app_version, language, mode, metadata_json, trusted)
          SELECT 'game_start', ${playerId}, ${sessionId}, ${platform}, ${appVersion}, ${language}, ${mode},
                 ${JSON.stringify({ source: "client_game_start", eventId })}, TRUE
          WHERE NOT EXISTS (
            SELECT 1 FROM public.analytics_events
            WHERE event_name = 'game_start'
              AND metadata_json::jsonb->>'eventId' = ${eventId}
          )
        `);
      });
    } else {
      await db.execute(sql`
        INSERT INTO public.analytics_events
          (event_name, player_id, session_id, platform, app_version, language, mode, metadata_json, trusted)
        VALUES
          ('game_start', ${playerId}, ${sessionId}, ${platform}, ${appVersion}, ${language}, ${mode}, '{"source":"client_game_start"}', TRUE)
      `);
    }
    return res.json({ ok: true });
  } catch (err) {
    console.error("[analytics] trusted game-start failed; details withheld.");
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.post("/client-error", presenceLimiter, async (req, res) => {
  try {
    await ensureAnalyticsReady();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const message = redactClientDiagnostic(body.message, 500) ?? "Unknown client error";
    const stack = redactClientDiagnostic(body.stack, 1200);
    const componentStack = redactClientDiagnostic(body.componentStack, 1200);
    const rawContext = body.context && typeof body.context === "object" && !Array.isArray(body.context)
      ? body.context as Record<string, unknown>
      : {};
    // Persist only bounded diagnostic fields. Resource URLs are reduced to
    // origin + pathname so query strings, fragments and credentials never enter analytics.
    const diagnosticContext: Record<string, unknown> = {};
    for (const key of ["source", "error_kind", "phase", "resource_tag", "lazy_page", "module_exports"] as const) {
      const value = rawContext[key];
      if (typeof value === "string" && value.trim()) diagnosticContext[key] = redactClientDiagnostic(value, 80);
    }
    for (const key of ["resource_url", "filename"] as const) {
      const value = rawContext[key];
      if (typeof value === "string" && value.trim()) {
        try {
          const parsed = new URL(value);
          diagnosticContext[key] = (parsed.origin + parsed.pathname).slice(0, 400);
        } catch {
          // Ignore malformed locations rather than persisting arbitrary text.
        }
      }
    }
    for (const key of ["line", "column"] as const) {
      const value = rawContext[key];
      if (typeof value === "number" && Number.isFinite(value) && value >= 0) diagnosticContext[key] = Math.floor(value);
    }
    const sessionId = typeof body.sessionId === "string" ? body.sessionId.slice(0, 128) : null;
    const playerId = readPlayerId(req);
    const platform = platformFromRequest(req);
    const appVersion = String(req.headers["x-client-version"] ?? "").slice(0, 32) || null;
    const language = typeof body.language === "string" ? body.language.slice(0, 16) : null;
    const metadataJson = JSON.stringify({ message, stack, componentStack, context: diagnosticContext }).slice(0, 4000);
    await db.execute(sql`
      INSERT INTO public.analytics_events
        (event_name, player_id, session_id, platform, app_version, language, metadata_json, trusted)
      VALUES
        ('client_error', ${playerId}, ${sessionId}, ${platform}, ${appVersion}, ${language}, ${metadataJson}, TRUE)
    `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[analytics] client-error failed; details withheld.");
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.post("/event", presenceLimiter, async (req, res) => {
  try {
    await ensureAnalyticsReady();
    const body = (req.body ?? {}) as Record<string, unknown>;
    const eventName = typeof body.eventName === "string" ? body.eventName.trim().slice(0, 80) : "";
    if (!eventName) return res.status(400).json({ error: "eventName required" });
    const clean = (value: unknown, max: number): string | null => typeof value === "string" && value.trim() ? value.trim().slice(0, max) : null;
    const metadata = body.metadata && typeof body.metadata === "object" ? body.metadata : {};
    const metadataJson = JSON.stringify(sanitizeClientMetadata(metadata)).slice(0, 4000);
    const playerId = readPlayerId(req);
    const sessionId = clean(body.sessionId, 128) ?? serverSessionId(req, res);
    const trusted = TRUSTED_CLIENT_TELEMETRY_EVENTS.has(eventName);
    await db.execute(sql`
      INSERT INTO public.analytics_events (event_name, player_id, session_id, platform, app_version, language, mode, ai_difficulty, metadata_json, trusted)
      VALUES (${eventName}, ${playerId}, ${sessionId}, ${platformFromRequest(req)}, ${String(req.headers["x-client-version"] ?? "").slice(0, 32) || null}, ${clean(body.language, 16)}, ${clean(body.mode, 32)}, ${clean(body.aiDifficulty, 32)}, ${metadataJson}, ${trusted})
  `);
    return res.json({ ok: true });
  } catch (err) {
    console.error("[analytics] event failed; details withheld.");
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

router.get("/summary", async (_req, res) => {
  try {
    await ensureAnalyticsReady();
    const rows = await db.execute(sql`SELECT platform, COUNT(*)::int AS active FROM public.analytics_sessions WHERE last_seen >= NOW() - INTERVAL '90 seconds' GROUP BY platform ORDER BY platform`);
    return res.json({ platforms: rows.rows });
  } catch (err) {
    console.error("[analytics] summary failed; details withheld.");
    return res.status(500).json({ error: "Analytics unavailable" });
  }
});

export default router;
