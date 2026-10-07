import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { db, indexesReady } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authLimiter } from "../middlewares/rateLimit";
import { sendLocalizedBroadcast, type PushPayload } from "../lib/pushHelper";

const router: IRouter = Router();

router.use((_req, res, next) => {
  if (!indexesReady()) {
    res.setHeader("Retry-After", "2");
    return res.status(503).json({ error: "Server warming up", ready: false });
  }
  next();
});

// Timing-safe string compare that tolerates length differences.
function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a, "utf8");
  const bufB = Buffer.from(b, "utf8");
  if (bufA.length !== bufB.length) {
    // Still run a comparison to keep timing roughly constant.
    timingSafeEqual(bufA, bufA);
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

// HTTP Basic Auth gate. Reads credentials from env. Fails CLOSED: if the
// credentials are not configured the panel returns 503 (never open access).
function basicAuth(req: Request, res: Response, next: NextFunction) {
  const user = process.env["ADMIN_PANEL_USER"];
  const pass = process.env["ADMIN_PANEL_PASSWORD"];

  if (!user || !pass) {
    res
      .status(503)
      .type("html")
      .send(
        "<h1>Panel no configurado</h1><p>Falta definir ADMIN_PANEL_USER y ADMIN_PANEL_PASSWORD.</p>",
      );
    return;
  }

  const header = req.headers.authorization || "";
  const [scheme, encoded] = header.split(" ");
  if (scheme === "Basic" && encoded) {
    const decoded = Buffer.from(encoded, "base64").toString("utf8");
    const idx = decoded.indexOf(":");
    const gotUser = decoded.slice(0, idx);
    const gotPass = decoded.slice(idx + 1);
    // Compute BOTH comparisons unconditionally (no short-circuit) so a failing
    // username can't be distinguished from a failing password by timing.
    const okUser = safeEqual(gotUser, user);
    const okPass = safeEqual(gotPass, pass);
    if (okUser && okPass) {
      next();
      return;
    }
  }

  res
    .set("WWW-Authenticate", 'Basic realm="STOP Panel", charset="UTF-8"')
    .status(401)
    .type("html")
    .send("<h1>Acceso restringido</h1><p>Credenciales requeridas.</p>");
}

function num(v: unknown): number {
  return Number(v ?? 0);
}


function svgLineChart(rows: Array<{ label: string; value: number }>, title: string): string {
  const safeRows = rows.filter((r) => Number.isFinite(r.value));
  if (!safeRows.length) return '<div class="emptyChart">Sin datos suficientes para el gráfico.</div>';
  const max = Math.max(...safeRows.map((r) => r.value), 1);
  const width = 760, height = 220, left = 42, right = 18, top = 26, bottom = 34;
  const innerW = width - left - right, innerH = height - top - bottom;
  const points = safeRows.map((r, i) => {
    const x = safeRows.length === 1 ? left + innerW / 2 : left + (i * innerW) / (safeRows.length - 1);
    const y = top + innerH - (r.value / max) * innerH;
    return { x, y, label: r.label, value: r.value };
  });
  const poly = points.map((p) => p.x.toFixed(1) + "," + p.y.toFixed(1)).join(" ");
  const dots = points.map((p) => '<circle cx="' + p.x.toFixed(1) + '" cy="' + p.y.toFixed(1) + '" r="3.5" fill="#4ade80"><title>' + esc(p.label) + ': ' + p.value + '</title></circle>').join("");
  const labels = points.map((p) => '<text x="' + p.x.toFixed(1) + '" y="' + (height - 10) + '" text-anchor="middle">' + esc(p.label) + '</text>').join("");
  return '<div class="chart"><div class="chartTitle">' + esc(title) + '</div><svg viewBox="0 0 ' + width + ' ' + height + '" role="img" aria-label="' + esc(title) + '"><line x1="' + left + '" y1="' + (top + innerH) + '" x2="' + (width - right) + '" y2="' + (top + innerH) + '" stroke="#334155"/><polyline points="' + poly + '" fill="none" stroke="#4ade80" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>' + dots + labels + '</svg></div>';
}

function svgBars(rows: Array<{ label: string; value: number }>, title: string): string {
  const safeRows = rows.filter((r) => Number.isFinite(r.value));
  if (!safeRows.length) return '<div class="emptyChart">Sin datos suficientes para el gráfico.</div>';
  const max = Math.max(...safeRows.map((r) => r.value), 1);
  const bars = safeRows.map((r) => '<div class="barRow"><div class="barLabel">' + esc(r.label) + '</div><div class="barTrack"><div class="barFill" style="width:' + Math.max(0, Math.min(100, (r.value / max) * 100)).toFixed(1) + '%"></div></div><div class="barValue">' + r.value + '</div></div>').join("");
  return '<div class="chart"><div class="chartTitle">' + esc(title) + '</div>' + bars + '</div>';
}

function esc(v: unknown): string {
  return String(v ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

// "today" boundary in Europe/Madrid, returned as an instant comparable to the
// UTC-naive timestamp columns (which store UTC wall time).
const MADRID_TODAY = sql`(date_trunc('day', now() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid')`;
const NOT_BOT = sql`player_id NOT LIKE 'bot_%'`;

router.get("/", authLimiter, basicAuth, async (_req: Request, res: Response) => {
  try {
    // ── KPIs de hoy (zona horaria de España) ──────────────────────────────
    const todayRows = (
      await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM player_scores
             WHERE ${NOT_BOT} AND (updated_at AT TIME ZONE 'UTC') >= ${MADRID_TODAY}) AS active,
          (SELECT COUNT(*) FROM player_scores
             WHERE ${NOT_BOT} AND (created_at AT TIME ZONE 'UTC') >= ${MADRID_TODAY}) AS new_users,
          (SELECT COUNT(*) FROM game_history
             WHERE ${NOT_BOT} AND (created_at AT TIME ZONE 'UTC') >= ${MADRID_TODAY}) AS games
      `)
    ).rows[0] as Record<string, unknown>;

    // Invitados de hoy. Usamos el día de Europe/Madrid para que TODAS las
    // tarjetas de "Hoy" cambien de día a la vez (medianoche española).
    const guestToday = (
      await db.execute(sql`
        SELECT COALESCE(games,0) AS games, COALESCE(conversions,0) AS conversions
        FROM guest_stats
        WHERE day = to_char(now() AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD')
      `)
    ).rows[0] as Record<string, unknown> | undefined;

    // ── Totales históricos ────────────────────────────────────────────────
    const totals = (
      await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM player_scores WHERE ${NOT_BOT}) AS users,
          (SELECT COUNT(*) FROM player_scores ps WHERE ${NOT_BOT} AND EXISTS (\n             SELECT 1 FROM play_subscriptions sub\n             WHERE sub.player_id = ps.player_id\n               AND sub.product_id = 'premium_monthly'\n               AND sub.state IN ('ACTIVE', 'IN_GRACE_PERIOD')\n               AND sub.expiry_time_ms > (EXTRACT(EPOCH FROM NOW()) * 1000)\n           )) AS premium,
          (SELECT COUNT(*) FROM game_history WHERE ${NOT_BOT}) AS games
      `)
    ).rows[0] as Record<string, unknown>;

    // ── Series de los últimos 14 días ─────────────────────────────────────
    const dayExpr = sql`to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD')`;
    const gamesByDay = (
      await db.execute(sql`
        SELECT ${dayExpr} AS d, COUNT(*) AS games, COUNT(DISTINCT player_id) AS players
        FROM game_history
        WHERE ${NOT_BOT} AND created_at >= now() - interval '14 days'
        GROUP BY d ORDER BY d DESC
      `)
    ).rows as Record<string, unknown>[];
    const regsByDay = (
      await db.execute(sql`
        SELECT ${dayExpr} AS d, COUNT(*) AS regs
        FROM player_scores
        WHERE ${NOT_BOT} AND created_at >= now() - interval '14 days'
        GROUP BY d ORDER BY d DESC
      `)
    ).rows as Record<string, unknown>[];
    const guestsByDay = (
      await db.execute(sql`
        SELECT day AS d, games, conversions FROM guest_stats
        WHERE day >= to_char(now() AT TIME ZONE 'Europe/Madrid' - interval '14 days', 'YYYY-MM-DD')
        ORDER BY day DESC
      `)
    ).rows as Record<string, unknown>[];

    const analyticsStartsByDay = (await db.execute(sql`
      SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS d,
             COUNT(*)::int AS starts,
             COUNT(*) FILTER (WHERE app_version IS NOT NULL AND app_version <> '')::int AS starts_with_version
      FROM analytics_events
      WHERE trusted = TRUE AND event_name = 'game_start' AND created_at >= NOW() - INTERVAL '14 days'
      GROUP BY d ORDER BY d DESC
    `)).rows as Record<string, unknown>[];

    const analyticsVersionCoverage = (await db.execute(sql`
      SELECT COUNT(*)::int AS sessions,
             COUNT(*) FILTER (WHERE app_version IS NOT NULL AND app_version <> '')::int AS sessions_with_version
      FROM analytics_sessions WHERE started_at >= NOW() - INTERVAL '7 days'
    `)).rows[0] as Record<string, unknown> | undefined;

    const analyticsStartCoverage = (await db.execute(sql`
      SELECT COUNT(*)::int AS starts,
             COUNT(*) FILTER (WHERE app_version IS NOT NULL AND app_version <> '')::int AS starts_with_version,
             COUNT(*) FILTER (WHERE platform IN ('web','android','ios'))::int AS starts_with_platform
      FROM analytics_events
      WHERE trusted = TRUE AND event_name = 'game_start' AND created_at >= NOW() - INTERVAL '7 days'
    `)).rows[0] as Record<string, unknown> | undefined;

    // ── Retención y embudo real (analytics_sessions / trusted events) ────────
    // DAU/WAU/MAU usa player_id para cuentas y session_id para invitados.
    const retentionKpis = (
      await db.execute(sql`
        SELECT
          COUNT(DISTINCT CASE WHEN s.last_seen >= (date_trunc('day', NOW() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid') THEN COALESCE(s.player_id, s.session_id) END)::int AS dau,
          COUNT(DISTINCT CASE WHEN s.last_seen >= NOW() - INTERVAL '7 days' THEN COALESCE(s.player_id, s.session_id) END)::int AS wau,
          COUNT(DISTINCT CASE WHEN s.last_seen >= NOW() - INTERVAL '30 days' THEN COALESCE(s.player_id, s.session_id) END)::int AS mau,
          COUNT(DISTINCT CASE WHEN s.started_at >= NOW() - INTERVAL '7 days' AND s.player_id IS NOT NULL THEN s.player_id END)::int AS account_active_7d,
          COUNT(DISTINCT CASE WHEN s.started_at >= NOW() - INTERVAL '7 days' AND s.player_id IS NULL THEN s.session_id END)::int AS guest_active_7d
        FROM analytics_sessions s
        WHERE s.started_at >= NOW() - INTERVAL '30 days'
      `)
    ).rows[0] as Record<string, unknown> | undefined;

    const funnel = (
      await db.execute(sql`
        SELECT
          COUNT(DISTINCT CASE WHEN event_name = 'session_start' THEN COALESCE(player_id, session_id) END)::int AS sessions,
          COUNT(DISTINCT CASE WHEN event_name = 'game_start' THEN COALESCE(player_id, session_id) END)::int AS game_players,
          COUNT(DISTINCT CASE WHEN event_name = 'game_complete' THEN COALESCE(player_id, session_id) END)::int AS completed_players,
          COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_requested' THEN COALESCE(player_id, session_id) END)::int AS ad_players,
          COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_failed' THEN COALESCE(player_id, session_id) END)::int AS ad_failed_players
        FROM analytics_events
        WHERE trusted = TRUE AND created_at >= NOW() - INTERVAL '7 days'
      `)
    ).rows[0] as Record<string, unknown> | undefined;

    const activityByDay = (
      await db.execute(sql`
        SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid', 'YYYY-MM-DD') AS d,
               COUNT(DISTINCT COALESCE(player_id, session_id)) FILTER (WHERE event_name = 'session_start')::int AS active,
               COUNT(DISTINCT COALESCE(player_id, session_id)) FILTER (WHERE event_name = 'game_start')::int AS starters,
               COUNT(DISTINCT COALESCE(player_id, session_id)) FILTER (WHERE event_name = 'game_complete')::int AS completers
        FROM analytics_events
        WHERE trusted = TRUE AND created_at >= NOW() - INTERVAL '14 days'
          AND event_name IN ('session_start','game_start','game_complete')
        GROUP BY d ORDER BY d DESC
      `)
    ).rows as Record<string, unknown>[];

    const churnBuckets = (
      await db.execute(sql`
        SELECT
          COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '1 day')::int AS active_1d,
          COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '1 day' AND last_seen >= NOW() - INTERVAL '3 days')::int AS away_1_3d,
          COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '3 days' AND last_seen >= NOW() - INTERVAL '7 days')::int AS away_3_7d,
          COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '7 days' AND last_seen >= NOW() - INTERVAL '14 days')::int AS away_7_14d,
          COUNT(*) FILTER (WHERE last_seen < NOW() - INTERVAL '14 days')::int AS away_14d
        FROM (
          SELECT player_id, MAX(last_seen) AS last_seen
          FROM analytics_sessions
          WHERE player_id IS NOT NULL AND player_id NOT LIKE 'bot_%'
          GROUP BY player_id
        ) x
      `)
    ).rows[0] as Record<string, unknown> | undefined;

    const platformVersions = (
      await db.execute(sql`
        SELECT platform, COALESCE(app_version, '—') AS app_version,
               COUNT(DISTINCT COALESCE(player_id, session_id)) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days')::int AS active_7d
        FROM analytics_sessions
        WHERE started_at >= NOW() - INTERVAL '7 days'
        GROUP BY platform, app_version
        ORDER BY active_7d DESC, platform, app_version
        LIMIT 30
      `)
    ).rows as Record<string, unknown>[];

    const activityRows = activityByDay.map((row) =>
      `<tr><td>${esc(row.d)}</td><td>${num(row.active)}</td><td>${num(row.starters)}</td><td>${num(row.completers)}</td><td>${num(row.starters) > 0 ? Math.round((num(row.completers) / num(row.starters)) * 100) : 0}%</td></tr>`
    ).join('');


    const errorSummary = (
      await db.execute(sql`
        SELECT event_name, COUNT(*)::int AS total
        FROM analytics_events
        WHERE trusted = TRUE
          AND event_name IN ('client_error','api_error')
          AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY event_name ORDER BY total DESC
      `)
    ).rows as Record<string, unknown>[];

    const recentErrors = (
      await db.execute(sql`
        SELECT event_name, platform, app_version, created_at,
               metadata_json
        FROM analytics_events
        WHERE trusted = TRUE
          AND event_name IN ('client_error','api_error')
          AND created_at >= NOW() - INTERVAL '24 hours'
        ORDER BY created_at DESC
        LIMIT 100
      `)
    ).rows as Record<string, unknown>[];

    const errorChart = errorSummary.map((row) => ({
      label: String(row.event_name) === 'client_error' ? 'Fallos del juego' : 'Fallos API',
      value: num(row.total),
    }));
    const errorRows = recentErrors.map((row) => {
      let message = '—';
      try {
        const meta = JSON.parse(String(row.metadata_json || '{}')) as Record<string, unknown>;
        message = String(meta.message ?? meta.path ?? '—').slice(0, 180);
      } catch {}
      const time = row.created_at ? new Date(String(row.created_at)).toLocaleString('es-ES', { timeZone: 'Europe/Madrid' }) : '—';
      return `<tr><td>${String(row.event_name) === "client_error" ? "🐛 Juego" : "⚠️ API"}</td><td>${esc(row.platform)}</td><td>${esc(row.app_version || "—")}</td><td>${esc(message)}</td><td>${time}</td></tr>`;
    }).join('');

    const modeUsage = (
      await db.execute(sql`
        SELECT COALESCE(mode, 'sin modo') AS mode, COUNT(*)::int AS total
        FROM analytics_events
        WHERE trusted = TRUE AND event_name = 'game_start' AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY mode ORDER BY total DESC LIMIT 10
      `)
    ).rows as Record<string, unknown>[];

    const powerupUsage = (
      await db.execute(sql`
        SELECT COALESCE(metadata_json::jsonb->>'powerup', 'sin identificar') AS powerup, COUNT(*)::int AS total
        FROM analytics_events
        WHERE trusted = TRUE AND event_name = 'powerup_used' AND created_at >= NOW() - INTERVAL '7 days'
        GROUP BY powerup ORDER BY total DESC LIMIT 10
      `)
    ).rows as Record<string, unknown>[];

    const chartActivity = [...activityByDay].reverse().map((row) => ({ label: String(row.d).slice(5), value: num(row.active) }));
    const chartCompletions = [...activityByDay].reverse().map((row) => ({ label: String(row.d).slice(5), value: num(row.starters) > 0 ? Math.round((num(row.completers) / num(row.starters)) * 100) : 0 }));
    const modeChart = modeUsage.map((row) => ({ label: String(row.mode), value: num(row.total) }));
    const powerupChart = powerupUsage.map((row) => ({ label: String(row.powerup), value: num(row.total) }));
    const funnelChart = [
      { label: "Sesión", value: num(funnel?.sessions) },
      { label: "Partida", value: num(funnel?.game_players) },
      { label: "Finalizada", value: num(funnel?.completed_players) },
    ];
    const adUnique = (await db.execute(sql`
      SELECT
        COUNT(DISTINCT CASE WHEN event_name = 'ad_impression' THEN COALESCE(player_id, session_id) END)::int AS impressions,
        COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_requested' THEN COALESCE(player_id, session_id) END)::int AS requested,
        COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_completed' THEN COALESCE(player_id, session_id) END)::int AS completed,
        COUNT(DISTINCT CASE WHEN event_name = 'rewarded_ad_failed' THEN COALESCE(player_id, session_id) END)::int AS failed
      FROM analytics_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
        AND event_name IN ('ad_impression','rewarded_ad_requested','rewarded_ad_completed','rewarded_ad_failed')
    `)).rows[0] as Record<string, unknown> | undefined;

    const adChart = [
      { label: "Solicitados", value: num(adUnique?.requested) },
      { label: "Completados", value: num(adUnique?.completed) },
      { label: "Fallidos", value: num(adUnique?.failed) },
    ];

    const platformVersionRows = platformVersions.map((row) => {
      const platform = String(row.platform) === 'android' ? '🤖 Android' : String(row.platform) === 'ios' ? '🍎 iOS' : '🌐 Web';
      return `<tr><td>${platform}</td><td>${esc(row.app_version)}</td><td>${num(row.active_7d)}</td></tr>`;
    }).join('');

    // Top 10 jugadores
    const top = (
      await db.execute(sql`
        SELECT player_name, total_score, games_played, is_premium
        FROM player_scores
        WHERE ${NOT_BOT}
        ORDER BY total_score DESC
        LIMIT 10
      `)
    ).rows as Record<string, unknown>[];

    // Merge daily series by date key.
    const byDay = new Map<string, { regs: number; games: number; players: number; guestGames: number; conversions: number; starts: number; startsWithVersion: number }>();
    const ensure = (d: string) => {
      if (!byDay.has(d)) byDay.set(d, { regs: 0, games: 0, players: 0, guestGames: 0, conversions: 0, starts: 0, startsWithVersion: 0 });
      return byDay.get(d)!;
    };
    for (const r of gamesByDay) { const e = ensure(String(r.d)); e.games = num(r.games); e.players = num(r.players); }
    for (const r of regsByDay) { ensure(String(r.d)).regs = num(r.regs); }
    for (const r of guestsByDay) { const e = ensure(String(r.d)); e.guestGames = num(r.games); e.conversions = num(r.conversions); }
    for (const r of analyticsStartsByDay) { const e = ensure(String(r.d)); e.starts = num(r.starts); e.startsWithVersion = num(r.starts_with_version); }
    const days = [...byDay.keys()].sort().reverse();

    const now = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

    const dailyRows = days
      .map((d) => {
        const e = byDay.get(d)!;
        return `<tr><td>${esc(d)}</td><td>${e.regs}</td><td>${e.players}</td><td>${e.games}</td><td>${e.guestGames}</td><td>${e.conversions}</td></tr>`;
      })
      .join("");

    const dailyQualityRows = days.map((d) => {\n      const e = byDay.get(d)!;\n      const startsVersion = e.starts > 0 ? `${Math.round((e.startsWithVersion / e.starts) * 100)}%` : "—";\n      const warning = (e.games + e.guestGames) > 0 && e.starts === 0 ? " 🔴" : "";\n      return `<tr><td>${esc(d)}</td><td>${e.games}</td><td>${e.guestGames}</td><td>${e.starts}${warning}</td><td>${startsVersion}</td></tr>`;\n    }).join("");\n\n    const topRows = top
      .map(
        (p, i) =>
          `<tr><td>${i + 1}</td><td>${esc(p.player_name)}${p.is_premium ? " ⭐" : ""}</td><td>${num(p.total_score).toLocaleString("es-ES")}</td><td>${num(p.games_played)}</td></tr>`,
      )
      .join("");

    // Conexiones, login y publicidad directamente en /test.
    const activeSessions = (await db.execute(sql`
      SELECT s.player_id, COALESCE(ps.player_name, CASE WHEN s.player_id IS NULL THEN 'Invitado' ELSE s.player_id END) AS player_name,
             s.platform, s.app_version, s.language, s.last_seen,
             CASE
               WHEN s.login_method IN ('google','gmail') OR s.player_id LIKE 'google_%' THEN 'Google / Gmail'
               WHEN s.login_method = 'facebook' OR s.player_id LIKE 'fb_%' THEN 'Facebook'
               WHEN s.login_method = 'apple' OR s.player_id LIKE 'apple_%' THEN 'Apple'
               WHEN s.login_method = 'instagram' OR s.player_id LIKE 'ig_%' THEN 'Instagram'
               WHEN s.login_method = 'tiktok' OR s.player_id LIKE 'tt_%' THEN 'TikTok'
               WHEN s.player_id IS NULL THEN 'Invitado'
               ELSE 'Cuenta'
             END AS login_method
      FROM analytics_sessions s
      LEFT JOIN player_scores ps ON ps.player_id = s.player_id
      WHERE s.last_seen >= NOW() - INTERVAL '90 seconds'
      ORDER BY s.last_seen DESC LIMIT 200
    `)).rows as Record<string, unknown>[];

    const loginMethods = (await db.execute(sql`
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
        FROM analytics_sessions s
        WHERE s.started_at >= NOW() - INTERVAL '24 hours'
      )
      SELECT m.method,
             COUNT(DISTINCT CASE WHEN o.last_seen >= NOW() - INTERVAL '90 seconds'
               THEN COALESCE(o.player_id, o.session_id) END)::int AS active,
             COUNT(DISTINCT COALESCE(o.player_id, o.session_id))::int AS unique_users,
             COUNT(o.session_id)::int AS sessions
      FROM methods m
      LEFT JOIN observed o ON o.method = m.method
      GROUP BY m.method
      ORDER BY CASE m.method WHEN 'facebook' THEN 1 WHEN 'google' THEN 2 WHEN 'account' THEN 3 ELSE 4 END
    `)).rows as Record<string, unknown>[];

    // Desglose de plataforma y cruce plataforma + método de acceso.
    // Las cuentas se cuentan por player_id; los invitados por session_id.
    const platformMethods = (await db.execute(sql`
      SELECT
        CASE WHEN s.platform = 'android' THEN 'android' WHEN s.platform = 'ios' THEN 'ios' ELSE 'web' END AS platform,
        CASE WHEN s.login_method = 'google' OR s.player_id LIKE 'google_%' THEN 'google'
             WHEN s.login_method = 'facebook' OR s.player_id LIKE 'fb_%' THEN 'facebook'
             WHEN s.login_method = 'apple' OR s.player_id LIKE 'apple_%' THEN 'apple'
             WHEN s.login_method = 'instagram' OR s.player_id LIKE 'ig_%' THEN 'instagram'
             WHEN s.login_method = 'tiktok' OR s.player_id LIKE 'tt_%' THEN 'tiktok'
             WHEN s.player_id IS NOT NULL THEN 'account' ELSE 'guest' END AS method,
        COUNT(DISTINCT COALESCE(s.player_id, s.session_id)) FILTER (WHERE s.last_seen >= NOW() - INTERVAL '90 seconds')::int AS active,
        COUNT(DISTINCT COALESCE(s.player_id, s.session_id))::int AS unique_users,
        COUNT(*)::int AS sessions
      FROM analytics_sessions s
      WHERE s.started_at >= NOW() - INTERVAL '24 hours'
      GROUP BY platform, method
      ORDER BY unique_users DESC, platform, method
    `)).rows as Record<string, unknown>[];

    const platformTotals = (await db.execute(sql`
      SELECT
        CASE WHEN s.platform = 'android' THEN 'android' WHEN s.platform = 'ios' THEN 'ios' ELSE 'web' END AS platform,
        COUNT(DISTINCT COALESCE(s.player_id, s.session_id)) FILTER (WHERE s.last_seen >= NOW() - INTERVAL '90 seconds')::int AS active,
        COUNT(DISTINCT COALESCE(s.player_id, s.session_id))::int AS unique_users,
        COUNT(*)::int AS sessions
      FROM analytics_sessions s
      WHERE s.started_at >= NOW() - INTERVAL '24 hours'
      GROUP BY platform
      ORDER BY unique_users DESC, platform
    `)).rows as Record<string, unknown>[];

    const platformLabels: Record<string, string> = { android: '🤖 Android', ios: '🍎 iOS', web: '🌐 Web' };
    const methodLabels: Record<string, string> = { google: '🔵 Google / Gmail', facebook: '🔵 Facebook', apple: '🍎 Apple', instagram: '📸 Instagram', tiktok: '🎵 TikTok', account: '👤 Cuenta', guest: '👤 Invitado' };
    const platformTotalRows = platformTotals.map((row) =>
      `<tr><td>${platformLabels[String(row.platform)] ?? esc(row.platform)}</td><td>${num(row.active)}</td><td>${num(row.unique_users)}</td><td>${num(row.sessions)}</td></tr>`,
    ).join('');
    const platformMethodRows = platformMethods.map((row) =>
      `<tr><td>${platformLabels[String(row.platform)] ?? esc(row.platform)}</td><td>${methodLabels[String(row.method)] ?? esc(row.method)}</td><td>${num(row.active)}</td><td>${num(row.unique_users)}</td><td>${num(row.sessions)}</td></tr>`,
    ).join('');

    const adViewers = (await db.execute(sql`
      SELECT COALESCE(ps.player_name, CASE WHEN e.player_id IS NULL THEN 'Invitado' ELSE e.player_id END) AS player_name,
             e.platform, e.event_name, MAX(e.created_at) AS last_seen, COUNT(*)::int AS events
      FROM analytics_events e LEFT JOIN player_scores ps ON ps.player_id = e.player_id
      WHERE e.created_at >= NOW() - INTERVAL '7 days'
        AND e.event_name IN ('rewarded_ad_requested','rewarded_ad_completed','rewarded_ad_failed','ad_impression')
      GROUP BY e.player_id, ps.player_name, e.platform, e.event_name ORDER BY last_seen DESC LIMIT 300
    `)).rows as Record<string, unknown>[];

    const activeSessionRows = activeSessions.map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const lastSeen = row.last_seen ? new Date(String(row.last_seen)).toLocaleTimeString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${esc(row.player_name)}</td><td>${esc(row.login_method)}</td><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${esc(row.language || "—")}</td><td>${lastSeen}</td></tr>`;
    }).join("");

    const loginRows = loginMethods.map((row) => {
      const labels: Record<string,string> = { google:"🔵 Google / Gmail", facebook:"🔵 Facebook", apple:"🍎 Apple", instagram:"📸 Instagram", tiktok:"🎵 TikTok", account:"👤 Cuenta", guest:"👤 Invitado" };
      return `<tr><td>${labels[String(row.method)] ?? esc(row.method)}</td><td>${num(row.active)}</td><td>${num(row.unique_users)}</td><td>${num(row.sessions)}</td></tr>`;
    }).join("");

    const adViewerRows = adViewers.map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const labels: Record<string,string> = { ad_impression:"📺 Anuncio visto", rewarded_ad_requested:"▶️ Rewarded solicitado", rewarded_ad_completed:"✅ Rewarded completado", rewarded_ad_failed:"❌ Rewarded fallido" };
      const lastSeen = row.last_seen ? new Date(String(row.last_seen)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${esc(row.player_name)}</td><td>${labels[String(row.event_name)] ?? esc(row.event_name)}</td><td>${platform}</td><td>${num(row.events)}</td><td>${lastSeen}</td></tr>`;
    }).join("");

    const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"/>
<meta name="robots" content="noindex,nofollow"/>
<link rel="manifest" href="/test-manifest.json"/>
<meta name="theme-color" content="#0f1216"/>
<meta name="mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-capable" content="yes"/>
<meta name="apple-mobile-web-app-status-bar-style" content="black-translucent"/>
<meta name="apple-mobile-web-app-title" content="STOP Control"/>
<title>STOP Control · Panel privado</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:#0f1216; color:#e8edf2; padding:calc(14px + env(safe-area-inset-top)) max(14px, env(safe-area-inset-right)) calc(24px + env(safe-area-inset-bottom)) max(14px, env(safe-area-inset-left)); }
  h1 { font-size:1.4rem; margin:0 0 4px; }
  .sub { color:#8a98a8; font-size:.85rem; margin-bottom:20px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:24px; }
  .card { background:#1a2029; border:1px solid #283140; border-radius:14px; padding:16px; }
  .card .label { color:#8a98a8; font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; }
  .card .val { font-size:2rem; font-weight:700; margin-top:4px; }
  .card.accent .val { color:#4ade80; }
  .charts{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:14px;margin-bottom:18px}.chart{background:#1a2029;border:1px solid #283140;border-radius:14px;padding:14px;min-height:220px}.chartTitle{font-weight:700;margin-bottom:10px}.chart svg{width:100%;height:auto}.chart svg text{fill:#8a98a8;font-size:11px}.emptyChart{color:#8a98a8;padding:50px 10px;text-align:center}.barRow{display:grid;grid-template-columns:110px 1fr 54px;gap:8px;align-items:center;margin:9px 0}.barLabel{font-size:.8rem;overflow:hidden;text-overflow:ellipsis;white-space:nowrap}.barTrack{height:12px;background:#11161d;border-radius:999px;overflow:hidden}.barFill{height:100%;background:#4ade80;border-radius:999px}@media(max-width:800px){.charts{grid-template-columns:1fr}.barRow{grid-template-columns:90px 1fr 45px}}
  h2 { font-size:1.05rem; margin:24px 0 10px; }
  table { width:100%; border-collapse:collapse; background:#1a2029; border-radius:12px; overflow:hidden; font-size:.9rem; }
  th,td { padding:10px 12px; text-align:left; border-bottom:1px solid #232b36; }
  th { background:#222a35; color:#9fb0c2; font-weight:600; font-size:.78rem; text-transform:uppercase; letter-spacing:.03em; }
  tr:last-child td { border-bottom:none; }
  td:not(:first-child), th:not(:first-child) { text-align:right; }
  .foot { margin-top:24px; color:#5f6c7b; font-size:.78rem; }
  a.btn { display:inline-block; margin-top:8px; color:#4ade80; text-decoration:none; border:1px solid #2c6b45; padding:6px 14px; border-radius:8px; }
@media(max-width:600px){
  body{padding-left:12px;padding-right:12px}
  .cards{grid-template-columns:repeat(2,minmax(0,1fr));gap:8px}
  .card{padding:12px;border-radius:12px}
  .card .val{font-size:1.55rem}
  table{display:block;overflow-x:auto;white-space:nowrap;-webkit-overflow-scrolling:touch}
  th,td{padding:9px 10px}
  h2{margin-top:20px}
  a.btn,button.btn{min-height:44px;padding:10px 14px}
}
</style>
</head><body>
  <h1>📊 STOP Control</h1>
  <div class="sub">Panel privado · datos en tiempo real · ${esc(now)}</div>

  <h2>Hoy</h2>
  <div class="cards">
    <div class="card"><div class="label">Puntuaciones actualizadas hoy</div><div class="val">${num(todayRows.active)}</div></div>
    <div class="card"><div class="label">Nuevos registros</div><div class="val">${num(todayRows.new_users)}</div></div>
    <div class="card"><div class="label">Resultados guardados · registrados</div><div class="val">${num(todayRows.games)}</div></div>
    <div class="card"><div class="label">Partidas contabilizadas · invitados</div><div class="val">${num(guestToday?.games)}</div></div>
    <div class="card"><div class="label">Invitados → registro</div><div class="val">${num(guestToday?.conversions)}</div></div>
  </div>

  <h2>🛡️ Calidad de los datos del panel</h2>\n  <div class="cards">\n    <div class="card"><div class="label">Sesiones con versión · 7 días</div><div class="val">${num(analyticsVersionCoverage?.sessions) > 0 ? Math.round((num(analyticsVersionCoverage?.sessions_with_version) / num(analyticsVersionCoverage?.sessions)) * 100) : 0}%</div></div>\n    <div class="card"><div class="label">Game starts con versión · 7 días</div><div class="val">${num(analyticsStartCoverage?.starts) > 0 ? Math.round((num(analyticsStartCoverage?.starts_with_version) / num(analyticsStartCoverage?.starts)) * 100) : 0}%</div></div>\n    <div class="card"><div class="label">Game starts con plataforma · 7 días</div><div class="val">${num(analyticsStartCoverage?.starts) > 0 ? Math.round((num(analyticsStartCoverage?.starts_with_platform) / num(analyticsStartCoverage?.starts)) * 100) : 0}%</div></div>\n  </div>\n  <div class="sub">Los resultados guardados y las partidas de invitados proceden de fuentes distintas. <b>Game start</b> es telemetría y se usa para detectar pérdidas de instrumentación; no se usa para inventar el número de partidas.</div>\n\n  <h2>📈 Salud real del juego</h2>
  <div class="cards">
    <div class="card accent"><div class="label">DAU real · hoy</div><div class="val">${num(retentionKpis?.dau)}</div></div>
    <div class="card"><div class="label">WAU real · 7 días</div><div class="val">${num(retentionKpis?.wau)}</div></div>
    <div class="card"><div class="label">MAU real · 30 días</div><div class="val">${num(retentionKpis?.mau)}</div></div>
    <div class="card"><div class="label">Cuentas activas · 7 días</div><div class="val">${num(retentionKpis?.account_active_7d)}</div></div>
    <div class="card"><div class="label">Invitados activos · 7 días</div><div class="val">${num(retentionKpis?.guest_active_7d)}</div></div>
    <div class="card"><div class="label">Inicio → fin · 7 días</div><div class="val">${num(funnel?.game_players) > 0 ? Math.round((num(funnel?.completed_players) / num(funnel?.game_players)) * 100) : 0}%</div></div>
  </div>

  <h2>🎯 Embudo de jugadores · últimos 7 días</h2>
  <table>
    <thead><tr><th>Etapa</th><th>Jugadores únicos</th></tr></thead>
    <tbody>
      <tr><td>Sesión iniciada</td><td>${num(funnel?.sessions)}</td></tr>
      <tr><td>Partida iniciada</td><td>${num(funnel?.game_players)}</td></tr>
      <tr><td>Partida terminada</td><td>${num(funnel?.completed_players)}</td></tr>
      <tr><td>Pidió rewarded</td><td>${num(funnel?.ad_players)}</td></tr>
      <tr><td>Rewarded falló</td><td>${num(funnel?.ad_failed_players)}</td></tr>
    </tbody>
  </table>

  <h2>🚪 Por dónde se está yendo la gente</h2>
  <table>
    <thead><tr><th>Última actividad</th><th>Jugadores registrados</th></tr></thead>
    <tbody>
      <tr><td>Activos &lt; 1 día</td><td>${num(churnBuckets?.active_1d)}</td></tr>
      <tr><td>Ausentes 1–3 días</td><td>${num(churnBuckets?.away_1_3d)}</td></tr>
      <tr><td>Ausentes 3–7 días</td><td>${num(churnBuckets?.away_3_7d)}</td></tr>
      <tr><td>Ausentes 7–14 días</td><td>${num(churnBuckets?.away_7_14d)}</td></tr>
      <tr><td>Ausentes &gt; 14 días</td><td>${num(churnBuckets?.away_14d)}</td></tr>
    </tbody>
  </table>

  <h2>🚨 Fallos detectados</h2>
  <div class="charts">
    ${svgBars(errorChart, "Fallos registrados · últimos 7 días")}
  </div>
  <table>
    <thead><tr><th>Tipo</th><th>Plataforma</th><th>Versión</th><th>Detalle</th><th>Cuándo</th></tr></thead>
    <tbody>${errorRows || '<tr><td colspan="5">No hay fallos registrados en las últimas 24 horas.</td></tr>'}</tbody>
  </table>

  <h2>📊 Lo que está pasando de un vistazo</h2>
  <div class="charts">
    ${svgLineChart(chartActivity, "Jugadores activos por día · 14 días")}
    ${svgLineChart(chartCompletions, "Porcentaje de finalización · 14 días")}
    ${svgBars(funnelChart, "Embudo · jugadores únicos · 7 días")}
    ${svgBars(adChart, "Publicidad · usuarios únicos · 7 días")}
    ${svgBars(modeChart, "Modos más jugados · 7 días")}
    ${svgBars(powerupChart, "Recompensas más utilizadas · 7 días")}
  </div>

  <h2>📅 Actividad real · últimos 14 días</h2>
  <table>
    <thead><tr><th>Día</th><th>Activos</th><th>Inician partida</th><th>Terminan partida</th><th>Conversión</th></tr></thead>
    <tbody>${activityRows || '<tr><td colspan="5">Sin eventos de actividad.</td></tr>'}</tbody>
  </table>

  <h2>📱 Versión y plataforma · últimos 7 días</h2>
  <table>
    <thead><tr><th>Plataforma</th><th>Versión</th><th>Activos únicos</th></tr></thead>
    <tbody>${platformVersionRows || '<tr><td colspan="3">Sin datos.</td></tr>'}</tbody>
  </table>

  <h2>Totales históricos</h2>
  <div class="cards">
    <div class="card"><div class="label">Jugadores registrados</div><div class="val">${num(totals.users).toLocaleString("es-ES")}</div></div>
    <div class="card"><div class="label">Premium</div><div class="val">${num(totals.premium)}</div></div>
    <div class="card"><div class="label">Partidas totales</div><div class="val">${num(totals.games).toLocaleString("es-ES")}</div></div>
  </div>

  <h2>Últimos 14 días</h2>
  <table>
    <thead><tr><th>Día</th><th>Nuevos</th><th>Activos</th><th>Partidas</th><th>Inv. partidas</th><th>Inv.→reg.</th></tr></thead>
    <tbody>${dailyRows || '<tr><td colspan="6">Sin datos</td></tr>'}</tbody>
  </table>

  <h2>🔎 Conciliación de juego y telemetría · últimos 14 días</h2>\n  <table>\n    <thead><tr><th>Día</th><th>Resultados registrados</th><th>Inv. partidas</th><th>Game starts</th><th>Starts con versión</th></tr></thead>\n    <tbody>${dailyQualityRows || '<tr><td colspan="5">Sin datos</td></tr>'}</tbody>\n  </table>\n  <div class="sub">🔴 significa que existen resultados/partidas contabilizadas pero no llegó ningún <code>game_start</code> ese día. Eso es una alerta de telemetría, no un “día sin jugadores”.</div>\n\n  <h2>Top 10 jugadores</h2>
  <table>
    <thead><tr><th>#</th><th>Jugador</th><th>Puntos</th><th>Partidas</th></tr></thead>
    <tbody>${topRows || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody>
  </table>

  <a class="btn" href="">🔄 Actualizar</a>

  <h2>👥 Quién está conectado ahora</h2>
  <div class="cards">
    <div class="card accent"><div class="label">Conectados últimos 90 s</div><div class="val">${activeSessions.length}</div></div>
    <div class="card"><div class="label">Vistas de anuncio · 7 días</div><div class="val">${num(adUnique?.impressions)}</div></div>
    <div class="card"><div class="label">Rewarded solicitados · 7 días</div><div class="val">${num(adUnique?.requested)}</div></div>
    <div class="card"><div class="label">Rewarded completados · 7 días</div><div class="val">${num(adUnique?.completed)}</div></div>
    <div class="card"><div class="label">Rewarded fallidos · 7 días</div><div class="val">${num(adUnique?.failed)}</div></div>
  </div>
  <table><thead><tr><th>Jugador</th><th>Login</th><th>Plataforma</th><th>Versión</th><th>Idioma</th><th>Última conexión</th></tr></thead>
  <tbody>${activeSessionRows || '<tr><td colspan="6">Ahora mismo no hay conexiones activas.</td></tr>'}</tbody></table>

  <h2>📱 Desde dónde se conectan · últimas 24 h</h2>
  <table><thead><tr><th>Plataforma</th><th>Activos ahora</th><th>Usuarios únicos</th><th>Sesiones</th></tr></thead>
  <tbody>${platformTotalRows || '<tr><td colspan="4">Sin datos.</td></tr>'}</tbody></table>

  <h2>🔗 Plataforma + acceso · últimas 24 h</h2>
  <p class="sub">Cruce real entre dispositivo/plataforma y forma de acceso. Invitados se cuentan por sesión.</p>
  <table><thead><tr><th>Plataforma</th><th>Acceso</th><th>Activos ahora</th><th>Usuarios únicos</th><th>Sesiones</th></tr></thead>
  <tbody>${platformMethodRows || '<tr><td colspan="5">Sin datos.</td></tr>'}</tbody></table>

  <h2>🔐 Cómo se conectan · últimas 24 h</h2>
  <p class="sub">Usuarios únicos: una cuenta cuenta una vez; los invitados se cuentan por sesión. Activos ahora = señal en los últimos 90 segundos.</p>
  <table><thead><tr><th>Método</th><th>Activos ahora</th><th>Usuarios únicos</th><th>Sesiones</th></tr></thead>
  <tbody>${loginRows}</tbody></table>

  <h2>📺 Quién ve publicidad · últimos 7 días</h2>
  <table><thead><tr><th>Jugador</th><th>Evento</th><th>Plataforma</th><th>Veces</th><th>Último evento</th></tr></thead>
  <tbody>${adViewerRows || '<tr><td colspan="5">Sin eventos de publicidad.</td></tr>'}</tbody></table>

  <a class="btn" href="/test/analytics">📡 Abrir análisis detallado</a>\n  <a class="btn" href="/test/health">🛡️ Salud operativa</a>

  <h2>Notificaciones</h2>
  <form method="post" action="/test/notify-mundial" onsubmit="return confirm('¿Enviar la notificación del Pack Mundial a TODOS los jugadores suscritos?');">
    <p class="sub" style="margin:0 0 8px;">Envía a todos los suscriptores: «⚽ ¡Nuevo Pack Mundial! Elige tu equipo y equípate como él». Al tocarla, se abre la Tienda.</p>
    <button class="btn" type="submit" style="cursor:pointer; background:transparent; font-size:1rem;">📣 Enviar notificación Pack Mundial</button>
  </form>

  <div class="foot">Acceso privado. No compartas esta dirección ni tus credenciales.</div>
</body></html>`;

    res.status(200).type("html").send(html);
  } catch (err: any) {
    console.error("[admin panel] error:", err?.message ?? err);
    res.status(500).type("html").send("<h1>Error</h1><p>No se pudieron cargar las estadísticas.</p>");
  }
});

// ── Difusión: notificación del Pack Mundial ────────────────────────────────
// Mensaje localizado por idioma. La URL apunta a la Tienda (/tienda) para que
// al tocar la notificación se abra directamente la tienda con el Pack Mundial.
const MUNDIAL_PUSH: Record<string, PushPayload> = {
  es: { title: "⚽ ¡Nuevo Pack Mundial!", body: "Elige tu equipo y equípate como él: avatares, marcos y fondos del Mundial te esperan en la Tienda.", icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: "/tienda" },
  en: { title: "⚽ New World Cup Pack!", body: "Pick your team and gear up like them: World Cup avatars, frames and backgrounds are waiting in the Shop.", icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: "/tienda" },
  pt: { title: "⚽ Novo Pack Mundial!", body: "Escolhe a tua seleção e equipa-te como ela: avatares, molduras e fundos do Mundial à tua espera na Loja.", icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: "/tienda" },
  fr: { title: "⚽ Nouveau Pack Mondial !", body: "Choisis ton équipe et équipe-toi comme elle : avatars, cadres et fonds de la Coupe du Monde t'attendent dans la Boutique.", icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: "/tienda" },
};

// Same-origin guard for state-changing admin POSTs. Basic Auth credentials are
// cached and auto-replayed by the browser, so a cross-site auto-submitting form
// could otherwise trigger a mass push while the owner has an authenticated
// session. We require Origin (or Referer) to match the request host, and reject
// when neither is present (a real form submit from the panel always sends them).
function sameOrigin(req: Request): boolean {
  const host = req.headers.host;
  if (!host) return false;
  const origin = req.headers.origin;
  if (origin) {
    try { return new URL(origin).host === host; } catch { return false; }
  }
  const referer = req.headers.referer;
  if (referer) {
    try { return new URL(referer).host === host; } catch { return false; }
  }
  return false;
}

// POST /test/notify-mundial — el propietario lo dispara desde el panel privado.
// Envía la notificación del Pack Mundial a TODOS los suscriptores, con el texto
// traducido al idioma de cada suscripción (es por defecto). No se envía nada de
// forma automática: solo al pulsar el botón del panel (protegido por Basic Auth
// + comprobación de mismo origen contra CSRF).
router.post("/notify-mundial", authLimiter, basicAuth, async (req: Request, res: Response) => {
  if (!sameOrigin(req)) {
    res.status(403).type("html").send('<h1>Solicitud bloqueada</h1><p>Origen no válido.</p><a href="/test">← Volver</a>');
    return;
  }
  try {
    const { sent, failed, removed } = await sendLocalizedBroadcast(MUNDIAL_PUSH, "es");

    const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>STOP · Notificación enviada</title>
<style>
  :root { color-scheme: dark; }
  body { margin:0; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:#0f1216; color:#e8edf2; padding:24px; }
  h1 { font-size:1.3rem; margin:0 0 12px; }
  .card { background:#1a2029; border:1px solid #283140; border-radius:14px; padding:18px; max-width:420px; }
  .row { display:flex; justify-content:space-between; padding:6px 0; border-bottom:1px solid #232b36; }
  .row:last-child { border-bottom:none; }
  .row .v { font-weight:700; }
  .ok { color:#4ade80; }
  a.btn { display:inline-block; margin-top:16px; color:#4ade80; text-decoration:none; border:1px solid #2c6b45; padding:8px 16px; border-radius:8px; }
</style>
</head><body>
  <h1>✅ Notificación del Pack Mundial enviada</h1>
  <div class="card">
    <div class="row"><span>Enviadas</span><span class="v ok">${num(sent)}</span></div>
    <div class="row"><span>Fallidas</span><span class="v">${num(failed)}</span></div>
    <div class="row"><span>Suscripciones caducadas (limpiadas)</span><span class="v">${num(removed)}</span></div>
  </div>
  <a class="btn" href="/test">← Volver al panel</a>
</body></html>`;
    res.status(200).type("html").send(html);
  } catch (err: any) {
    console.error("[admin notify-mundial] error:", err?.message ?? err);
    res.status(500).type("html").send('<h1>Error</h1><p>No se pudo enviar la notificación.</p><a href="/test">← Volver</a>');
  }
});

export default router;
