import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { db, indexesReady } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authLimiter } from "../middlewares/rateLimit";

const router: IRouter = Router();

router.use((_req, res, next) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    return res.status(503).json({ error: "Server warming up", ready: false });
  }
  next();
});

function safeEqual(a: string, b: string): boolean {
  const aa = Buffer.from(a, "utf8");
  const bb = Buffer.from(b, "utf8");
  if (aa.length !== bb.length) {
    timingSafeEqual(aa, aa);
    return false;
  }
  return timingSafeEqual(aa, bb);
}

function basicAuth(req: Request, res: Response, next: NextFunction) {
  const user = process.env["ADMIN_PANEL_USER"];
  const pass = process.env["ADMIN_PANEL_PASSWORD"];
  if (!user || !pass) return res.status(503).send("Panel no configurado");
  const [scheme, encoded] = String(req.headers.authorization ?? "").split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const i = decoded.indexOf(":");
    const okUser = safeEqual(decoded.slice(0, i), user);
    const okPass = safeEqual(decoded.slice(i + 1), pass);
    if (okUser && okPass) return next();
  }
  res.set("WWW-Authenticate", 'Basic realm="STOP Analytics", charset="UTF-8"').status(401).send("Acceso restringido");
}

function n(value: unknown): number { return Number(value ?? 0); }
function esc(value: unknown): string {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

router.get("/", authLimiter, basicAuth, async (req, res) => {
  try {
    const online = await db.execute(sql`
      SELECT platform, COUNT(*)::int AS active
      FROM public.analytics_sessions
      WHERE last_seen >= NOW() - INTERVAL '90 seconds'
      GROUP BY platform
      ORDER BY platform
    `);

    // "game_start" no es directamente una partida: Multiplayer puede emitirlo
    // por participante y por ronda. Para STOP Control lo normalizamos a una
    // unidad comparable con game_complete: una partida-jugador.
    // Solo contamos una vez cada jugador y sala para los starts de servidor.
    const today = await db.execute(sql`
      WITH day_events AS (
        SELECT *
        FROM public.analytics_events
        WHERE trusted = TRUE
          AND created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      ),
      normalized_starts AS (
        SELECT DISTINCT ON (platform, COALESCE(player_id, session_id))
               platform, session_id, player_id, created_at
        FROM day_events
        WHERE event_name = 'game_start'
        ORDER BY platform, COALESCE(player_id, session_id), created_at
      )
      SELECT platform,
             COUNT(*) FILTER (WHERE event_name = 'session_start')::int AS sessions,
             (SELECT COUNT(*) FROM normalized_starts ns WHERE ns.platform = de.platform)::int AS games_started,
             COUNT(*) FILTER (WHERE event_name = 'game_complete')::int AS games_completed,
             COUNT(*) FILTER (WHERE event_name IN ('ad_impression','rewarded_ad_completed'))::int AS ad_impressions
      FROM day_events de
      GROUP BY platform
      ORDER BY platform
    `);

    const loginMethods = await db.execute(sql`
      WITH methods(method) AS (
        VALUES ('google'), ('facebook'), ('account'), ('guest')
      ),
      observed AS (
        SELECT s.session_id, s.player_id, s.last_seen,
          CASE
            WHEN s.login_method IN ('google','gmail') OR s.player_id LIKE 'google_%' THEN 'google'
            WHEN s.login_method = 'facebook' OR s.player_id LIKE 'fb_%' THEN 'facebook'
            WHEN s.player_id IS NOT NULL THEN 'account'
            ELSE 'guest'
          END AS method
        FROM public.analytics_sessions s
        WHERE s.started_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      )
      SELECT m.method,
             COUNT(*) FILTER (WHERE o.last_seen >= NOW() - INTERVAL '90 seconds')::int AS active,
             COUNT(o.session_id)::int AS sessions
      FROM methods m
      LEFT JOIN observed o ON o.method = m.method
      GROUP BY m.method
      ORDER BY CASE m.method WHEN 'facebook' THEN 1 WHEN 'google' THEN 2 WHEN 'account' THEN 3 ELSE 4 END
    `);

    const events = await db.execute(sql`
      SELECT event_name, COUNT(*)::int AS total
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND created_at >= NOW() - INTERVAL '7 days'
      GROUP BY event_name
      ORDER BY total DESC, event_name
      LIMIT 30
    `);

    const powerups = await db.execute(sql`
      SELECT event_name, COUNT(*)::int AS total
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND created_at >= NOW() - INTERVAL '7 days'
        AND event_name IN ('rewarded_ad_requested','rewarded_ad_completed','rewarded_ad_failed','powerup_used','game_start','game_complete')
      GROUP BY event_name
      ORDER BY CASE event_name
        WHEN 'rewarded_ad_requested' THEN 1
        WHEN 'rewarded_ad_completed' THEN 2
        WHEN 'rewarded_ad_failed' THEN 3
        WHEN 'powerup_used' THEN 4
        WHEN 'game_start' THEN 5
        WHEN 'game_complete' THEN 6
        ELSE 99 END
    `);

    const activeSessions = await db.execute(sql`
      SELECT
        s.player_id,
        COALESCE(ps.player_name, CASE WHEN s.player_id IS NULL THEN 'Invitado' ELSE s.player_id END) AS player_name,
        s.platform,
        s.app_version,
        s.language,
        s.last_seen,
        CASE
          WHEN s.player_id LIKE 'google_%' THEN 'Google / Gmail'
          WHEN s.player_id LIKE 'fb_%' THEN 'Facebook'
          WHEN s.player_id LIKE 'apple_%' THEN 'Apple'
          WHEN s.player_id LIKE 'ig_%' THEN 'Instagram'
          WHEN s.player_id LIKE 'tt_%' THEN 'TikTok'
          WHEN s.player_id IS NULL THEN 'Invitado'
          WHEN s.player_id IS NOT NULL THEN 'Cuenta'
          ELSE 'Sin identificar'
        END AS login_method
      FROM public.analytics_sessions s
      LEFT JOIN player_scores ps ON ps.player_id = s.player_id
      WHERE s.last_seen >= NOW() - INTERVAL '90 seconds'
      ORDER BY s.last_seen DESC
      LIMIT 200
    `);

    const adViewers = await db.execute(sql`
      SELECT
        COALESCE(ps.player_name, CASE WHEN e.player_id IS NULL THEN 'Invitado' ELSE e.player_id END) AS player_name,
        e.platform,
        e.event_name,
        MAX(e.created_at) AS last_seen,
        COUNT(*)::int AS events
      FROM public.analytics_events e
      LEFT JOIN player_scores ps ON ps.player_id = e.player_id
      WHERE e.trusted = TRUE
        AND e.created_at >= NOW() - INTERVAL '7 days'
        AND e.event_name IN ('rewarded_ad_requested','rewarded_ad_completed','rewarded_ad_failed','ad_impression')
      GROUP BY e.player_id, ps.player_name, e.platform, e.event_name
      ORDER BY last_seen DESC
      LIMIT 300
    `);

    const adUnique = await db.execute(sql`
      SELECT
        COUNT(DISTINCT CASE WHEN event_name = 'ad_impression' THEN COALESCE(player_id, session_id) END)::int AS impression_viewers,
        COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_requested' THEN COALESCE(player_id, session_id) END)::int AS rewarded_requesters,
        COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_completed' THEN COALESCE(player_id, session_id) END)::int AS rewarded_viewers,
        COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_failed' THEN COALESCE(player_id, session_id) END)::int AS rewarded_failures
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND created_at >= NOW() - INTERVAL '7 days'
        AND event_name IN ('ad_impression','rewarded_ad_requested','rewarded_ad_completed','rewarded_ad_failed')
    `);

    // Read-only diagnostics for solo-vs-AI play. game_start stores its mode in
    // the mode column; game_complete stores it in metadata_json.mode. The
    // client/server session identifiers are not guaranteed to match, so we
    // deliberately report separate totals instead of fabricating abandoned
    // games or claiming a per-game join.
    const queryText = (value: unknown, max: number) =>
      typeof value === "string" ? value.trim().slice(0, max) : "";
    const requestedDays = Number.parseInt(queryText(req.query.days, 2), 10);
    const diagnosticDays = Number.isFinite(requestedDays) ? Math.min(30, Math.max(1, requestedDays)) : 7;
    const requestedPlatform = queryText(req.query.platform, 12);
    const diagnosticPlatform = ["web", "android", "ios"].includes(requestedPlatform) ? requestedPlatform : "all";
    const diagnosticVersion = queryText(req.query.version, 32);
    const diagnosticLanguage = queryText(req.query.language, 16);
    const requestedMode = queryText(req.query.mode, 16);
    const diagnosticMode = ["solo", "multiplayer"].includes(requestedMode) ? requestedMode : "all";

    const soloDiagnostics = await db.execute(sql`
      WITH normalized AS (
        SELECT event_name, player_id, session_id, platform, app_version, language,
               CASE
                 WHEN event_name = 'game_start' THEN NULLIF(mode, '')
                 ELSE NULLIF(metadata_json::jsonb ->> 'mode', '')
               END AS game_mode
        FROM public.analytics_events
        WHERE trusted = TRUE
          AND event_name IN ('game_start', 'game_complete')
          AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
          AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
          AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
          AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      )
      SELECT platform, app_version, language, COALESCE(game_mode, '(sin modo)') AS game_mode,
             COUNT(*) FILTER (WHERE event_name = 'game_start')::int AS starts,
             COUNT(*) FILTER (WHERE event_name = 'game_complete')::int AS completions,
             COUNT(DISTINCT COALESCE(player_id, session_id)) FILTER (WHERE event_name = 'game_start')::int AS starters,
             COUNT(DISTINCT COALESCE(player_id, session_id)) FILTER (WHERE event_name = 'game_complete')::int AS completers
      FROM normalized
      WHERE (
        ${diagnosticMode} = 'all'
        OR (${diagnosticMode} = 'solo' AND game_mode IN ('normal', 'quick', 'chaos', 'random', 'daily'))
        OR (${diagnosticMode} = 'multiplayer' AND COALESCE(game_mode, '') NOT IN ('', 'normal', 'quick', 'chaos', 'random', 'daily'))
      )
      GROUP BY platform, app_version, language, game_mode
      ORDER BY starts DESC, completions DESC
      LIMIT 150
    `);

    const diagnosticErrors = await db.execute(sql`
      SELECT event_name, platform, app_version, language, created_at,
             LEFT(COALESCE(metadata_json::jsonb ->> 'message', metadata_json), 600) AS details
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND event_name IN ('client_error', 'api_error')
        AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
        AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
        AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
        AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      ORDER BY created_at DESC
      LIMIT 100
    `);

    const diagnosticRows = (soloDiagnostics.rows as any[]).map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      return `<tr><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${esc(row.language || "—")}</td><td>${esc(row.game_mode)}</td><td>${n(row.starts)}</td><td>${n(row.completions)}</td><td>${n(row.starters)}</td><td>${n(row.completers)}</td></tr>`;
    }).join("");

    const diagnosticErrorRows = (diagnosticErrors.rows as any[]).map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const when = row.created_at ? new Date(String(row.created_at)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${when}</td><td>${esc(row.event_name)}</td><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${esc(row.language || "—")}</td><td><code>${esc(row.details || "Sin detalle")}</code></td></tr>`;
    }).join("");

    const rootCauseEvents = await db.execute(sql`
      SELECT event_name, platform, app_version, language, created_at,
             LEFT(metadata_json, 700) AS details
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND event_name IN ('api_error','client_error','lobby_view','lobby_ready','lobby_auth_resolved','lobby_daily_status_started','lobby_daily_status_succeeded','lobby_daily_status_failed','lobby_room_load_started','lobby_room_loaded','lobby_room_load_failed','lobby_api_timeout','lobby_auth_failed','lobby_page_exit','rewarded_ad_pending','rewarded_ad_failed','solo_round_validation')
        AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
        AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
        AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
        AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      ORDER BY created_at DESC
      LIMIT 150
    `);

    const lobbyLatency = await db.execute(sql`
      WITH samples AS (
        SELECT CASE
          WHEN (metadata_json::jsonb ->> 'durationMs') ~ '^[0-9]+$'
          THEN (metadata_json::jsonb ->> 'durationMs')::double precision
          ELSE NULL
        END AS duration_ms
        FROM public.analytics_events
        WHERE trusted = TRUE
          AND event_name = 'lobby_ready'
          AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
          AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
          AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
          AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      )
      SELECT COUNT(duration_ms)::int AS samples,
             percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50,
             percentile_cont(0.75) WITHIN GROUP (ORDER BY duration_ms) AS p75,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95
      FROM samples
    `);

    const lobbyStageLatency = await db.execute(sql`
      SELECT event_name,
             COUNT(CASE WHEN (metadata_json::jsonb ->> 'durationMs') ~ '^[0-9]+$' THEN 1 END)::int AS samples,
             percentile_cont(0.50) WITHIN GROUP (ORDER BY CASE WHEN (metadata_json::jsonb ->> 'durationMs') ~ '^[0-9]+$' THEN (metadata_json::jsonb ->> 'durationMs')::double precision ELSE NULL END) AS p50,
             percentile_cont(0.95) WITHIN GROUP (ORDER BY CASE WHEN (metadata_json::jsonb ->> 'durationMs') ~ '^[0-9]+$' THEN (metadata_json::jsonb ->> 'durationMs')::double precision ELSE NULL END) AS p95
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND event_name IN ('lobby_auth_resolved','lobby_daily_status_succeeded','lobby_daily_status_failed')
        AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
        AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
        AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
        AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      GROUP BY event_name
      ORDER BY event_name
    `);

    const lobbyStageLatencyRows = (lobbyStageLatency.rows as any[]).map((row) => {
      const labels: Record<string, string> = {
        lobby_auth_resolved: "Restauración de sesión",
        lobby_daily_status_succeeded: "Respuesta estado diario OK",
        lobby_daily_status_failed: "Respuesta estado diario fallida",
      };
      return `<tr><td>${labels[String(row.event_name)] ?? esc(row.event_name)}</td><td>${n(row.samples)}</td><td>${latencyValue(row.p50)}</td><td>${latencyValue(row.p95)}</td></tr>`;
    }).join("");


    const soloRoundLatency = await db.execute(sql`
      WITH samples AS (
        SELECT
          CASE WHEN (metadata_json::jsonb ->> 'durationMs') ~ '^[0-9]+$' THEN (metadata_json::jsonb ->> 'durationMs')::double precision ELSE NULL END AS duration_ms,
          CASE WHEN (metadata_json::jsonb ->> 'validationDurationMs') ~ '^[0-9]+$' THEN (metadata_json::jsonb ->> 'validationDurationMs')::double precision ELSE NULL END AS validation_duration_ms,
          CASE WHEN (metadata_json::jsonb ->> 'p95WordValidationMs') ~ '^[0-9]+$' THEN (metadata_json::jsonb ->> 'p95WordValidationMs')::double precision ELSE NULL END AS p95_word_ms,
          CASE WHEN (metadata_json::jsonb ->> 'slowWordValidationCount') ~ '^[0-9]+$' THEN (metadata_json::jsonb ->> 'slowWordValidationCount')::int ELSE 0 END AS slow_words,
          CASE WHEN (metadata_json::jsonb ->> 'wordValidationCount') ~ '^[0-9]+$' THEN (metadata_json::jsonb ->> 'wordValidationCount')::int ELSE 0 END AS word_count
        FROM public.analytics_events
        WHERE trusted = TRUE AND event_name = 'solo_round_validation'
          AND (${diagnosticMode} = 'all' OR mode = ${diagnosticMode})
          AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
          AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
          AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
          AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      )
      SELECT COUNT(duration_ms)::int AS samples,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY duration_ms) AS p50_round,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY duration_ms) AS p95_round,
        percentile_cont(0.50) WITHIN GROUP (ORDER BY validation_duration_ms) AS p50_validation,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY validation_duration_ms) AS p95_validation,
        percentile_cont(0.95) WITHIN GROUP (ORDER BY p95_word_ms) AS p95_slowest_word,
        COALESCE(SUM(slow_words), 0)::int AS slow_word_validations,
        COALESCE(SUM(word_count), 0)::int AS words_checked
      FROM samples
    `);
    const soloRoundLatencyRows = (soloRoundLatency.rows as any[]).map((row) =>
      `<tr><td>${n(row.samples)}</td><td>${latencyValue(row.p50_round)}</td><td>${latencyValue(row.p95_round)}</td><td>${latencyValue(row.p50_validation)}</td><td>${latencyValue(row.p95_validation)}</td><td>${latencyValue(row.p95_slowest_word)}</td><td>${n(row.slow_word_validations)} / ${n(row.words_checked)}</td></tr>`
    ).join("");

    const adFlow = await db.execute(sql`
      SELECT event_name, platform, COUNT(*)::int AS total
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND event_name IN ('rewarded_ad_requested','rewarded_ad_request_created','rewarded_ad_pending','rewarded_ad_completed','rewarded_ad_failed')
        AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
        AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
        AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
        AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      GROUP BY event_name, platform
      ORDER BY event_name, platform
    `);

    const adAttempts = await db.execute(sql`
      SELECT metadata_json::jsonb ->> 'requestId' AS request_id,
             COALESCE(MAX(metadata_json::jsonb ->> 'placement'), '—') AS placement,
             ARRAY_AGG(DISTINCT event_name ORDER BY event_name) AS observed_events,
             MIN(created_at) AS first_seen,
             MAX(created_at) AS last_seen
      FROM public.analytics_events
      WHERE trusted = TRUE
        AND event_name IN ('rewarded_ad_request_created','rewarded_ad_pending','rewarded_ad_completed','rewarded_ad_failed')
        AND NULLIF(metadata_json::jsonb ->> 'requestId', '') IS NOT NULL
        AND created_at >= NOW() - (${diagnosticDays}::int * INTERVAL '1 day')
        AND (${diagnosticPlatform} = 'all' OR platform = ${diagnosticPlatform})
        AND (${diagnosticVersion} = '' OR COALESCE(app_version, '') = ${diagnosticVersion})
        AND (${diagnosticLanguage} = '' OR COALESCE(language, '') = ${diagnosticLanguage})
      GROUP BY metadata_json::jsonb ->> 'requestId'
      ORDER BY MAX(created_at) DESC
      LIMIT 100
    `);

    const adAttemptRows = (adAttempts.rows as any[]).map((row) => {
      const events = Array.isArray(row.observed_events) ? row.observed_events.map(String) : [];
      const state = events.includes("rewarded_ad_completed") ? "Completado"
        : events.includes("rewarded_ad_failed") ? "Fallido"
        : events.includes("rewarded_ad_pending") ? "Pendiente SSV"
        : "Sin desenlace registrado";
      const when = row.last_seen ? new Date(String(row.last_seen)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td><code>${esc(row.request_id)}</code></td><td>${esc(row.placement)}</td><td>${state}</td><td>${when}</td></tr>`;
    }).join("");

    const rootCauseRows = (rootCauseEvents.rows as any[]).map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const when = row.created_at ? new Date(String(row.created_at)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${when}</td><td>${esc(row.event_name)}</td><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${esc(row.language || "—")}</td><td><code>${esc(row.details || "{}")}</code></td></tr>`;
    }).join("");
    const adFlowRows = (adFlow.rows as any[]).map((row) => {
      const labels: Record<string, string> = {
        rewarded_ad_requested: "Solicitados",
        rewarded_ad_request_created: "Solicitud nativa creada",
        rewarded_ad_pending: "Pendientes de confirmación SSV",
        rewarded_ad_completed: "Completados",
        rewarded_ad_failed: "Fallidos",
      };
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      return `<tr><td>${labels[String(row.event_name)] ?? esc(row.event_name)}</td><td>${platform}</td><td>${n(row.total)}</td></tr>`;
    }).join("");
    const latencyRow = (lobbyLatency.rows as any[])[0] as any;
    const latencyValue = (value: unknown) => value == null || !Number.isFinite(Number(value)) ? "Sin datos" : `${Math.round(Number(value))} ms`;

    const halloweenSummary = await db.execute(sql`
      SELECT event_name, platform, COUNT(*)::int AS total,
             COUNT(DISTINCT COALESCE(player_id, session_id))::int AS players
      FROM public.analytics_events
      WHERE event_name IN ('halloween_event_enter','halloween_scare_seen','halloween_scare_report_attempt','halloween_scare_report_saved','halloween_scare_report_failed')
        AND created_at >= NOW() - INTERVAL '24 hours'
      GROUP BY event_name, platform
      ORDER BY event_name, platform
    `);

    const halloweenEntrants = await db.execute(sql`
      WITH event_activity AS (
        SELECT COALESCE(session_id, player_id, 'anon:' || id::text) AS actor_key,
               player_id, session_id, platform,
               MAX(app_version) AS app_version, MAX(language) AS language,
               MIN(created_at) FILTER (WHERE event_name = 'halloween_event_enter') AS entered_at,
               COUNT(*) FILTER (WHERE event_name = 'halloween_scare_seen')::int AS scares_seen,
               COUNT(*) FILTER (WHERE event_name = 'halloween_scare_report_saved')::int AS scares_saved,
               COUNT(*) FILTER (WHERE event_name = 'halloween_scare_report_failed')::int AS scares_failed
        FROM public.analytics_events
        WHERE event_name IN ('halloween_event_enter','halloween_scare_seen','halloween_scare_report_saved','halloween_scare_report_failed')
          AND created_at >= NOW() - INTERVAL '24 hours'
        GROUP BY COALESCE(session_id, player_id, 'anon:' || id::text), player_id, session_id, platform
      )
      SELECT COALESCE(ps.player_name, CASE WHEN a.player_id IS NULL THEN 'Invitado / sesión anónima' ELSE 'Cuenta registrada' END) AS player_label,
             a.platform, a.app_version, a.language, a.entered_at, a.scares_seen, a.scares_saved, a.scares_failed
      FROM event_activity a
      LEFT JOIN player_scores ps ON ps.player_id = a.player_id
      WHERE a.entered_at IS NOT NULL
      ORDER BY a.entered_at DESC
      LIMIT 100
    `);

    const halloweenFailures = await db.execute(sql`
      SELECT platform, app_version, language, created_at, metadata_json
      FROM public.analytics_events
      WHERE event_name = 'halloween_scare_report_failed'
        AND created_at >= NOW() - INTERVAL '24 hours'
      ORDER BY created_at DESC
      LIMIT 30
    `);

    const halloweenTotals = new Map<string, number>();
    for (const row of halloweenSummary.rows as any[]) {
      const key = String(row.event_name);
      halloweenTotals.set(key, (halloweenTotals.get(key) ?? 0) + n(row.total));
    }
    const halloweenSummaryRows = (halloweenSummary.rows as any[]).map((row) => {
      const labels: Record<string, string> = {
        halloween_event_enter: "Entradas al evento / partida Halloween",
        halloween_scare_seen: "Sustos detectados en la partida (cliente)",
        halloween_scare_report_attempt: "Envíos intentados al servidor",
        halloween_scare_report_saved: "Envíos aceptados (HTTP OK)",
        halloween_scare_report_failed: "Envíos fallidos",
      };
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      return `<tr><td>${labels[String(row.event_name)] ?? esc(row.event_name)}</td><td>${platform}</td><td>${n(row.total)}</td><td>${n(row.players)}</td></tr>`;
    }).join("");
    const halloweenFailureRows = (halloweenFailures.rows as any[]).map((row) => {
      let metadata = "{}";
      try { metadata = JSON.stringify(JSON.parse(String(row.metadata_json ?? "{}"))); } catch { metadata = String(row.metadata_json ?? "{}"); }
      const when = row.created_at ? new Date(String(row.created_at)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      return `<tr><td>${when}</td><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${esc(row.language || "—")}</td><td><code>${esc(metadata)}</code></td></tr>`;
    }).join("");
    const halloweenEntrantRows = (halloweenEntrants.rows as any[]).map((row) => {
      const when = row.entered_at ? new Date(String(row.entered_at)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      return `<tr><td>${when}</td><td>${esc(row.player_label)}</td><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${n(row.scares_seen)}</td><td>${n(row.scares_saved)}</td><td>${n(row.scares_failed)}</td></tr>`;
    }).join("");
    const halloweenSeen = halloweenTotals.get("halloween_scare_seen") ?? 0;
    const halloweenAttempts = halloweenTotals.get("halloween_scare_report_attempt") ?? 0;
    const halloweenSaved = halloweenTotals.get("halloween_scare_report_saved") ?? 0;
    const halloweenFailed = halloweenTotals.get("halloween_scare_report_failed") ?? 0;

    const platformMap = new Map<string, { active: number; sessions: number; started: number; completed: number; ads: number }>();
    for (const row of online.rows as any[]) platformMap.set(String(row.platform), { active: n(row.active), sessions: 0, started: 0, completed: 0, ads: 0 });
    for (const row of today.rows as any[]) {
      const key = String(row.platform);
      const current = platformMap.get(key) ?? { active: 0, sessions: 0, started: 0, completed: 0, ads: 0 };
      current.sessions = n(row.sessions); current.started = n(row.games_started); current.completed = n(row.games_completed); current.ads = n(row.ad_impressions);
      platformMap.set(key, current);
    }

    const platformRows = ["web", "android", "ios"].map((platform) => {
      const p = platformMap.get(platform) ?? { active: 0, sessions: 0, started: 0, completed: 0, ads: 0 };
      return `<tr><td>${platform === "ios" ? "🍎 iOS" : platform === "android" ? "🤖 Android" : "🌐 Web"}</td><td>${p.active}</td><td>${p.sessions}</td><td>${p.started}</td><td>${p.completed}</td><td>${p.ads}</td></tr>`;
    }).join("");

    const loginRows = (loginMethods.rows as any[]).map((row) => {
      const labels: Record<string, string> = { google: "🔵 Google / Gmail", facebook: "🔵 Facebook", apple: "🍎 Apple", guest: "👤 Invitado", instagram: "📸 Instagram", tiktok: "🎵 TikTok", unknown: "❓ Sin identificar" };
      return `<tr><td>${labels[String(row.method)] ?? esc(row.method)}</td><td>${n(row.active)}</td><td>${n(row.sessions)}</td></tr>`;
    }).join("");

    const eventRows = (events.rows as any[]).map((row) => `<tr><td>${esc(row.event_name)}</td><td>${n(row.total)}</td></tr>`).join("");
    const powerupLabels: Record<string, string> = {
      rewarded_ad_requested: "📺 Anuncio solicitado",
      rewarded_ad_completed: "✅ Anuncio completado",
      rewarded_ad_failed: "❌ Anuncio fallido",
      powerup_used: "🎁 Recompensa utilizada",
      game_start: "🎮 Inicio de partida · telemetría",
      game_complete: "🏁 Partida terminada · resultado real",
    };
    const powerupRows = (powerups.rows as any[]).map((row) => `<tr><td>${powerupLabels[String(row.event_name)] ?? esc(row.event_name)}</td><td>${n(row.total)}</td></tr>`).join("");

    const activeSessionRows = (activeSessions.rows as any[]).map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const lastSeen = row.last_seen ? new Date(String(row.last_seen)).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${esc(row.player_name)}</td><td>${esc(row.login_method)}</td><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${esc(row.language || "—")}</td><td>${lastSeen}</td></tr>`;
    }).join("");

    const adViewerRows = (adViewers.rows as any[]).map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const labels: Record<string,string> = {
        ad_impression: "📺 Anuncio visto",
        rewarded_ad_requested: "▶️ Rewarded solicitado",
        rewarded_ad_completed: "✅ Rewarded completado",
        rewarded_ad_failed: "❌ Rewarded fallido",
      };
      const lastSeen = row.last_seen ? new Date(String(row.last_seen)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${esc(row.player_name)}</td><td>${labels[String(row.event_name)] ?? esc(row.event_name)}</td><td>${platform}</td><td>${n(row.events)}</td><td>${lastSeen}</td></tr>`;
    }).join("");

    const adUniqueRow = (adUnique.rows as any[])[0] as any;
    const adImpressionViewers = n(adUniqueRow?.impression_viewers);
    const rewardedRequesters = n(adUniqueRow?.rewarded_requesters);
    const rewardedViewers = n(adUniqueRow?.rewarded_viewers);
    const rewardedFailures = n(adUniqueRow?.rewarded_failures);

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>STOP · Analytics</title><style>
      :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;padding:20px;background:#0f1216;color:#e8edf2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}h1{font-size:1.4rem;margin:0 0 4px}.sub{color:#8a98a8;font-size:.85rem;margin:0 0 20px}.card{background:#1a2029;border:1px solid #283140;border-radius:14px;padding:16px;margin-bottom:18px}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{padding:10px 12px;border-bottom:1px solid #232b36;text-align:left}th{background:#222a35;color:#9fb0c2;font-size:.76rem;text-transform:uppercase}td:not(:first-child),th:not(:first-child){text-align:right}tr:last-child td{border-bottom:0}.grid{display:grid;grid-template-columns:repeat(4,1fr);gap:12px}.kpiBox{background:#141922;border:1px solid #283140;border-radius:12px;padding:12px}.kpi{font-size:1.8rem;font-weight:700}.kpi{font-size:1.8rem;font-weight:700}.label{font-size:.76rem;color:#8a98a8;text-transform:uppercase}@media(max-width:700px){.grid{grid-template-columns:1fr}}
a{color:#4ade80;text-decoration:none}
    </style></head><body><h1>📊 Analytics de STOP</h1><p class="sub">Panel privado · plataforma y comportamiento · últimos 7 días</p>
    <div class="grid"><div class="card"><div class="label">🍎 iOS conectados</div><div class="kpi">${platformMap.get("ios")?.active ?? 0}</div></div><div class="card"><div class="label">🤖 Android conectados</div><div class="kpi">${platformMap.get("android")?.active ?? 0}</div></div><div class="card"><div class="label">🌐 Web conectados</div><div class="kpi">${platformMap.get("web")?.active ?? 0}</div></div></div>
    <div class="card"><h2>👥 Quién está conectado ahora</h2><p class="sub">Sesiones activas en los últimos 90 segundos. No se muestran correos ni credenciales.</p><table><thead><tr><th>Jugador</th><th>Cómo conecta</th><th>Plataforma</th><th>Versión</th><th>Idioma</th><th>Última señal</th></tr></thead><tbody>${activeSessionRows || '<tr><td colspan="6">No hay jugadores conectados ahora.</td></tr>'}</tbody></table></div>
    <div class="card"><h2>📺 Publicidad · últimos 7 días</h2><div class="grid">
      <div class="kpiBox"><div class="label">Usuarios con anuncio</div><div class="kpi">${adImpressionViewers}</div></div>
      <div class="kpiBox"><div class="label">Rewarded solicitados</div><div class="kpi">${rewardedRequesters}</div></div>
      <div class="kpiBox"><div class="label">Rewarded completados</div><div class="kpi">${rewardedViewers}</div></div>
      <div class="kpiBox"><div class="label">Rewarded fallidos</div><div class="kpi">${rewardedFailures}</div></div>
    </div>
    <table><thead><tr><th>Jugador</th><th>Evento</th><th>Plataforma</th><th>Eventos</th><th>Último</th></tr></thead><tbody>${adViewerRows || '<tr><td colspan="5">No hay eventos de publicidad.</td></tr>'}</tbody></table></div>
    <div class="card"><h2>🎃 Halloween · diagnóstico de sustos (últimas 24 h)</h2>
      <p class="sub">“Detectados” es una señal del cliente; “aceptados” confirma que el endpoint respondió correctamente. Los fallos muestran código HTTP (401/403/410/500) o 0 si fue un error de red.</p>
      <div class="grid">
        <div class="kpiBox"><div class="label">Sustos detectados</div><div class="kpi">${halloweenSeen}</div></div>
        <div class="kpiBox"><div class="label">Envíos intentados</div><div class="kpi">${halloweenAttempts}</div></div>
        <div class="kpiBox"><div class="label">Envíos aceptados</div><div class="kpi">${halloweenSaved}</div></div>
        <div class="kpiBox"><div class="label">Envíos fallidos</div><div class="kpi">${halloweenFailed}</div></div>
      </div>
      <h3>Jugadores/sesiones que entraron y sus sustos</h3><p class="sub">Últimas 24 h. “Detectados” es señal del cliente; “guardados” son respuestas correctas del servidor. Invitados pueden aparecer como sesión anónima.</p>
      <table><thead><tr><th>Entrada (Madrid)</th><th>Jugador / sesión</th><th>Plataforma</th><th>Versión</th><th>Detectados</th><th>Guardados</th><th>Fallidos</th></tr></thead><tbody>${halloweenEntrantRows || '<tr><td colspan="7">No hay entradas instrumentadas todavía. Se empezarán a ver tras publicar este cambio y entrar en una partida con Halloween activo.</td></tr>'}</tbody></table>
      <h3>Desglose por plataforma</h3><table><thead><tr><th>Señal</th><th>Plataforma</th><th>Eventos</th><th>Jugadores/sesiones</th></tr></thead><tbody>${halloweenSummaryRows || '<tr><td colspan="4">Aún no hay telemetría de Halloween. Los eventos nuevos empezarán a registrarse cuando se publique este cambio.</td></tr>'}</tbody></table>
      <h3>Últimos fallos de registro</h3><table><thead><tr><th>Fecha (Madrid)</th><th>Plataforma</th><th>Versión</th><th>Idioma</th><th>Diagnóstico</th></tr></thead><tbody>${halloweenFailureRows || '<tr><td colspan="5">No hay fallos registrados en las últimas 24 horas.</td></tr>'}</tbody></table>
    </div>
    <div class="card"><h2>🔎 Investigación de partidas individuales y modos</h2>
      <p class="sub">Consulta de solo lectura. Filtra por periodo, plataforma, versión e idioma. “Individual / IA” usa exactamente los modos registrados por SoloGame: normal, quick, chaos, random y daily. “Multijugador” agrupa los demás modos con valor.</p>
      <form method="get" style="display:flex;flex-wrap:wrap;gap:10px;align-items:end;margin:12px 0 18px">
        <label>Periodo<br><select name="days"><option value="1" ${diagnosticDays === 1 ? "selected" : ""}>24 horas</option><option value="7" ${diagnosticDays === 7 ? "selected" : ""}>7 días</option><option value="14" ${diagnosticDays === 14 ? "selected" : ""}>14 días</option><option value="30" ${diagnosticDays === 30 ? "selected" : ""}>30 días</option></select></label>
        <label>Modo<br><select name="mode"><option value="all" ${diagnosticMode === "all" ? "selected" : ""}>Todos</option><option value="solo" ${diagnosticMode === "solo" ? "selected" : ""}>Individual / IA</option><option value="multiplayer" ${diagnosticMode === "multiplayer" ? "selected" : ""}>Multijugador</option></select></label>
        <label>Plataforma<br><select name="platform"><option value="all" ${diagnosticPlatform === "all" ? "selected" : ""}>Todas</option><option value="android" ${diagnosticPlatform === "android" ? "selected" : ""}>Android</option><option value="web" ${diagnosticPlatform === "web" ? "selected" : ""}>Web</option><option value="ios" ${diagnosticPlatform === "ios" ? "selected" : ""}>iOS</option></select></label>
        <label>Versión<br><input name="version" maxlength="32" value="${esc(diagnosticVersion)}" placeholder="p. ej. 1.3.6.9"></label>
        <label>Idioma<br><input name="language" maxlength="16" value="${esc(diagnosticLanguage)}" placeholder="p. ej. pt"></label>
        <button type="submit">Aplicar filtros</button>
        <a href="/test/analytics">Limpiar</a>
      </form>
      <h3>Inicios y partidas terminadas por modo</h3>
      <p class="sub">Los inicios y finales se cuentan por separado. No se calcula “abandono” porque el game_start usa una sesión de servidor y el game_complete puede usar otra sesión de cliente; no existe una unión fiable entre ambos.</p>
      <table><thead><tr><th>Plataforma</th><th>Versión</th><th>Idioma</th><th>Modo registrado</th><th>Inicios</th><th>Finales</th><th>Jugadores/sesiones inicio</th><th>Jugadores/sesiones fin</th></tr></thead><tbody>${diagnosticRows || '<tr><td colspan="8">No hay partidas registradas con estos filtros.</td></tr>'}</tbody></table>
      <h3>Validación de partidas individuales (solo)</h3>
      <p class="sub">Tiempos de validación del servidor; no se guardan palabras ni categorías. Una demora no identifica por sí sola su origen.</p>
      <table><thead><tr><th>Muestras</th><th>Ronda P50</th><th>Ronda P95</th><th>Validación P50</th><th>Validación P95</th><th>P95 de P95 por ronda</th><th>Validaciones ≥1 s / total</th></tr></thead><tbody>${soloRoundLatencyRows || '<tr><td colspan="7">Sin muestras todavía</td></tr>'}</tbody></table>
      <h3>Latencia del Lobby (primer render útil)</h3>
      <p class="sub">Medición cliente desde el montaje de Home hasta el primer frame. No representa el tiempo completo de autenticación ni garantiza que todas las llamadas API hayan terminado. Muestra solo muestras instrumentadas.</p>
      <div class="grid">
        <div class="kpiBox"><div class="label">Muestras</div><div class="kpi">${n(latencyRow?.samples)}</div></div>
        <div class="kpiBox"><div class="label">P50</div><div class="kpi">${latencyValue(latencyRow?.p50)}</div></div>
        <div class="kpiBox"><div class="label">P75</div><div class="kpi">${latencyValue(latencyRow?.p75)}</div></div>
        <div class="kpiBox"><div class="label">P95</div><div class="kpi">${latencyValue(latencyRow?.p95)}</div></div>
      </div>
      <h3>Flujo de anuncios rewarded</h3>
      <p class="sub">Solicitudes, pendientes SSV, completados y fallidos por plataforma. Son recuentos de eventos, no una conciliación por solicitud única: los reintentos pueden generar más de un evento.</p>
      <table><thead><tr><th>Estado</th><th>Plataforma</th><th>Eventos</th></tr></thead><tbody>${adFlowRows || '<tr><td colspan="3">Sin eventos con estos filtros.</td></tr>'}</tbody></table>
      <h3>Seguimiento por solicitud nativa</h3>
      <p class="sub">Agrupa eventos por requestId de AdMob para ver si una solicitud nativa terminó, quedó pendiente de SSV o no registró desenlace. Los fallos anteriores a la creación del requestId aparecen en el diagnóstico general.</p>
      <table><thead><tr><th>Request ID</th><th>Ubicación</th><th>Estado observado</th><th>Última señal</th></tr></thead><tbody>${adAttemptRows || '<tr><td colspan="4">No hay solicitudes nativas correlacionables todavía.</td></tr>'}</tbody></table>
      <h3>Errores del mismo periodo y filtros</h3>
      <p class="sub">Estos errores coinciden en periodo, plataforma, versión e idioma; la instrumentación actual no permite asegurar que pertenezcan a una partida concreta.</p>
      <table><thead><tr><th>Fecha (Madrid)</th><th>Tipo</th><th>Plataforma</th><th>Versión</th><th>Idioma</th><th>Detalle</th></tr></thead><tbody>${diagnosticErrorRows || '<tr><td colspan="6">No hay errores registrados con estos filtros.</td></tr>'}</tbody></table>
      <h3>Eventos de diagnóstico y causa raíz</h3>
      <p class="sub">Incluye etapas del Lobby, errores API/cliente y resultados de anuncios. Los motivos solo aparecen cuando el cliente o servidor los registra explícitamente; una salida sin señal no se etiqueta como abandono voluntario.</p>
      <table><thead><tr><th>Fecha (Madrid)</th><th>Evento</th><th>Plataforma</th><th>Versión</th><th>Idioma</th><th>Contexto técnico</th></tr></thead><tbody>${rootCauseRows || '<tr><td colspan="6">No hay eventos instrumentados con estos filtros.</td></tr>'}</tbody></table>
    </div>
    <div class="card"><h2>Plataformas · hoy</h2><table><thead><tr><th>Plataforma</th><th>Ahora</th><th>Sesiones</th><th>Jugadores que iniciaron</th><th>Resultados terminados</th><th>Impresiones publicidad</th></tr></thead><tbody>${platformRows}</tbody></table></div>
    <div class="card"><h2>Conexiones por método · hoy</h2><table><thead><tr><th>Método</th><th>Ahora</th><th>Sesiones</th></tr></thead><tbody>${loginRows || '<tr><td colspan="3">Todavía no hay conexiones identificadas.</td></tr>'}</tbody></table></div>
    <div class="card"><h2>Uso del juego y publicidad · últimos 7 días</h2><table><thead><tr><th>Métrica</th><th>Total</th></tr></thead><tbody>${powerupRows || '<tr><td colspan="2">Todavía no hay datos.</td></tr>'}</tbody></table></div>
    <div class="card"><h2>Eventos · últimos 7 días</h2><table><thead><tr><th>Evento</th><th>Total</th></tr></thead><tbody>${eventRows || '<tr><td colspan="2">Todavía no hay eventos.</td></tr>'}</tbody></table></div>
    <p><a href="/test">← Volver al panel principal</a></p></body></html>`;
    return res.type("html").send(html);
  } catch (err) {
    console.error("[admin analytics] error:", err);
    return res.status(500).type("html").send("<h1>Analytics no disponible</h1><p>Las tablas de analítica todavía no están inicializadas.</p>");
  }
});

export default router;
