import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authLimiter } from "../middlewares/rateLimit";
import { sendLocalizedBroadcast, type PushPayload } from "../lib/pushHelper";

const router: IRouter = Router();

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
        WHERE day >= to_char(now() AT TIME ZONE 'UTC' - interval '14 days', 'YYYY-MM-DD')
        ORDER BY day DESC
      `)
    ).rows as Record<string, unknown>[];

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
    const byDay = new Map<string, { regs: number; games: number; players: number; guestGames: number; conversions: number }>();
    const ensure = (d: string) => {
      if (!byDay.has(d)) byDay.set(d, { regs: 0, games: 0, players: 0, guestGames: 0, conversions: 0 });
      return byDay.get(d)!;
    };
    for (const r of gamesByDay) { const e = ensure(String(r.d)); e.games = num(r.games); e.players = num(r.players); }
    for (const r of regsByDay) { ensure(String(r.d)).regs = num(r.regs); }
    for (const r of guestsByDay) { const e = ensure(String(r.d)); e.guestGames = num(r.games); e.conversions = num(r.conversions); }
    const days = [...byDay.keys()].sort().reverse();

    const now = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });

    const dailyRows = days
      .map((d) => {
        const e = byDay.get(d)!;
        return `<tr><td>${esc(d)}</td><td>${e.regs}</td><td>${e.players}</td><td>${e.games}</td><td>${e.guestGames}</td><td>${e.conversions}</td></tr>`;
      })
      .join("");

    const topRows = top
      .map(
        (p, i) =>
          `<tr><td>${i + 1}</td><td>${esc(p.player_name)}${p.is_premium ? " ⭐" : ""}</td><td>${num(p.total_score).toLocaleString("es-ES")}</td><td>${num(p.games_played)}</td></tr>`,
      )
      .join("");

    const activeSessions = (await db.execute(sql`
      SELECT s.player_id, COALESCE(ps.player_name, CASE WHEN s.player_id IS NULL THEN 'Invitado' ELSE s.player_id END) AS player_name,
             s.platform, s.app_version, s.language, s.last_seen,
             CASE
               WHEN s.login_method IN ('google','gmail') OR s.player_id LIKE 'google_%' THEN 'Google / Gmail'
               WHEN s.login_method = 'facebook' OR s.player_id LIKE 'fb_%' THEN 'Facebook'
               WHEN s.login_method = 'apple' OR s.player_id LIKE 'apple_%' THEN 'Apple'
               WHEN s.login_method = 'instagram' OR s.player_id LIKE 'ig_%' THEN 'Instagram'
               WHEN s.login_method = 'tiktok' OR s.player_id LIKE 'tt_%' THEN 'TikTok'
               WHEN s.player_id IS NULL THEN 'Invitado' ELSE 'Cuenta'
             END AS login_method
      FROM analytics_sessions s LEFT JOIN player_scores ps ON ps.player_id = s.player_id
      WHERE s.last_seen >= NOW() - INTERVAL '90 seconds'
      ORDER BY s.last_seen DESC LIMIT 200
    `)).rows as Record<string, unknown>[];

    const loginMethods = (await db.execute(sql`
      SELECT method, COUNT(*) FILTER (WHERE last_seen >= NOW() - INTERVAL '90 seconds')::int AS active, COUNT(*)::int AS sessions
      FROM (
        SELECT s.session_id, s.last_seen,
          CASE
            WHEN s.login_method IN ('google','gmail') THEN 'google'
            WHEN s.login_method = 'facebook' THEN 'facebook'
            WHEN s.login_method = 'apple' THEN 'apple'
            WHEN s.login_method = 'instagram' THEN 'instagram'
            WHEN s.login_method = 'tiktok' THEN 'tiktok'
            WHEN s.player_id LIKE 'google_%' THEN 'google'
            WHEN s.player_id LIKE 'fb_%' THEN 'facebook'
            WHEN s.player_id LIKE 'apple_%' THEN 'apple'
            WHEN s.player_id LIKE 'ig_%' THEN 'instagram'
            WHEN s.player_id LIKE 'tt_%' THEN 'tiktok'
            WHEN s.player_id IS NOT NULL THEN 'account' ELSE 'guest'
          END AS method
        FROM analytics_sessions s WHERE s.started_at >= NOW() - INTERVAL '24 hours'
      ) x GROUP BY method ORDER BY sessions DESC, method
    `)).rows as Record<string, unknown>[];

    const platformToday = (await db.execute(sql`
      SELECT platform,
             COUNT(*) FILTER (WHERE event_name = 'session_start')::int AS sessions,
             COUNT(*) FILTER (WHERE event_name = 'game_start')::int AS games_started,
             COUNT(*) FILTER (WHERE event_name = 'game_complete')::int AS games_completed,
             COUNT(*) FILTER (WHERE event_name IN ('ad_impression','rewarded_ad_completed'))::int AS ads
      FROM analytics_events
      WHERE created_at >= ${MADRID_TODAY}
      GROUP BY platform
    `)).rows as Record<string, unknown>[];

    const adViewers = (await db.execute(sql`
      SELECT COALESCE(ps.player_name, CASE WHEN e.player_id IS NULL THEN 'Invitado' ELSE e.player_id END) AS player_name,
             e.platform, e.event_name, MAX(e.created_at) AS last_seen, COUNT(*)::int AS events
      FROM analytics_events e LEFT JOIN player_scores ps ON ps.player_id = e.player_id
      WHERE e.created_at >= NOW() - INTERVAL '7 days'
        AND e.event_name IN ('ad_impression','rewarded_ad_requested','rewarded_ad_completed','rewarded_ad_failed')
      GROUP BY e.player_id, ps.player_name, e.platform, e.event_name ORDER BY last_seen DESC LIMIT 300
    `)).rows as Record<string, unknown>[];

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

    const activeSessionRows = activeSessions.map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const lastSeen = row.last_seen ? new Date(String(row.last_seen)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${esc(row.player_name)}</td><td>${esc(row.login_method)}</td><td>${platform}</td><td>${esc(row.app_version || "—")}</td><td>${esc(row.language || "—")}</td><td>${lastSeen}</td></tr>`;
    }).join("");

    const loginRows = loginMethods.map((row) => {
      const labels: Record<string,string> = { google:"🔵 Google / Gmail", facebook:"🔵 Facebook", apple:"🍎 Apple", instagram:"📸 Instagram", tiktok:"🎵 TikTok", account:"👤 Cuenta", guest:"👤 Invitado" };
      return `<tr><td>${labels[String(row.method)] ?? esc(row.method)}</td><td>${num(row.active)}</td><td>${num(row.sessions)}</td></tr>`;
    }).join("");

    const platformRows = platformToday.map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      return `<tr><td>${platform}</td><td>${num(row.sessions)}</td><td>${num(row.games_started)}</td><td>${num(row.games_completed)}</td><td>${num(row.ads)}</td></tr>`;
    }).join("");

    const adViewerRows = adViewers.map((row) => {
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      const labels: Record<string,string> = { ad_impression:"📺 Anuncio visto", rewarded_ad_requested:"▶️ Rewarded solicitado", rewarded_ad_completed:"✅ Rewarded completado", rewarded_ad_failed:"❌ Rewarded fallido" };
      const lastSeen = row.last_seen ? new Date(String(row.last_seen)).toLocaleString("es-ES", { timeZone: "Europe/Madrid" }) : "—";
      return `<tr><td>${esc(row.player_name)}</td><td>${labels[String(row.event_name)] ?? esc(row.event_name)}</td><td>${platform}</td><td>${num(row.events)}</td><td>${lastSeen}</td></tr>`;
    }).join("");


    // ── Incidencias derivadas de señales reales ────────────────────────────
    // No llamamos "error" a algo que no esté registrado como tal. Estas
    // alertas detectan síntomas medibles que merecen investigación.
    const incidentHealth = (await db.execute(sql\`
      SELECT
        COUNT(*) FILTER (WHERE event_name = 'game_start')::int AS starts,
        COUNT(*) FILTER (WHERE event_name = 'game_complete')::int AS completes,
        COUNT(*) FILTER (WHERE event_name = 'rewarded_ad_requested')::int AS ad_requests,
        COUNT(*) FILTER (WHERE event_name = 'rewarded_ad_completed')::int AS ad_completes,
        COUNT(*) FILTER (WHERE event_name = 'rewarded_ad_failed')::int AS ad_failures,
        COUNT(DISTINCT session_id) FILTER (WHERE event_name = 'session_start')::int AS sessions
      FROM analytics_events
      WHERE created_at >= NOW() - INTERVAL '24 hours'
    \`)).rows[0] as Record<string,unknown> | undefined;

    const incidentRows: { level:string; title:string; detail:string }[] = [];
    const iStarts=num(incidentHealth?.starts), iCompletes=num(incidentHealth?.completes);
    const iAdReq=num(incidentHealth?.ad_requests), iAdOk=num(incidentHealth?.ad_completes), iAdFail=num(incidentHealth?.ad_failures);
    const iSessions=num(incidentHealth?.sessions);
    if (iStarts >= 10 && iCompletes / iStarts < 0.5) incidentRows.push({level:"🔴",title:"Baja finalización de partidas",detail:\`\${iCompletes}/\${iStarts} partidas terminadas en 24 h (\${((iCompletes/iStarts)*100).toFixed(0)}%).\`});
    if (iAdReq >= 10 && iAdFail / iAdReq >= 0.2) incidentRows.push({level:"🟠",title:"Rewarded con demasiados fallos",detail:\`\${iAdFail}/\${iAdReq} solicitudes fallaron (\${((iAdFail/iAdReq)*100).toFixed(0)}%).\`});
    if (iSessions >= 10 && iStarts / iSessions < 0.3) incidentRows.push({level:"🟠",title:"Muchas sesiones no llegan a jugar",detail:\`\${iStarts} partidas iniciadas frente a \${iSessions} sesiones (\${((iStarts/iSessions)*100).toFixed(0)}%).\`});
    if (incidentRows.length === 0) incidentRows.push({level:"🟢",title:"Sin anomalías derivadas detectadas",detail:"No se ha cruzado ninguno de los umbrales de alerta configurados con los datos disponibles."});

    const incidentHtml = incidentRows.map((x) => \`<tr><td>\${x.level}</td><td>\${esc(x.title)}</td><td>\${esc(x.detail)}</td></tr>\`).join("");

    // ── Crecimiento y salud del juego ─────────────────────────────────────
    const growthDaily = (await db.execute(sql\`
      SELECT d,
             COALESCE(regs,0)::int AS regs,
             COALESCE(sessions,0)::int AS sessions,
             COALESCE(games,0)::int AS games,
             COALESCE(starts,0)::int AS starts,
             COALESCE(completes,0)::int AS completes
      FROM (
        SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid','YYYY-MM-DD') AS d, COUNT(*)::int AS games
        FROM game_history
        WHERE \${NOT_BOT} AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
      ) g
      FULL OUTER JOIN (
        SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid','YYYY-MM-DD') AS d, COUNT(*)::int AS regs
        FROM player_scores
        WHERE \${NOT_BOT} AND created_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
      ) r USING (d)
      FULL OUTER JOIN (
        SELECT to_char((started_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid','YYYY-MM-DD') AS d, COUNT(*)::int AS sessions
        FROM analytics_sessions
        WHERE started_at >= NOW() - INTERVAL '30 days'
        GROUP BY 1
      ) s USING (d)
      FULL OUTER JOIN (
        SELECT to_char((created_at AT TIME ZONE 'UTC') AT TIME ZONE 'Europe/Madrid','YYYY-MM-DD') AS d,
               COUNT(*) FILTER (WHERE event_name = 'game_start')::int AS starts,
               COUNT(*) FILTER (WHERE event_name = 'game_complete')::int AS completes
        FROM analytics_events
        WHERE created_at >= NOW() - INTERVAL '30 days'
          AND event_name IN ('game_start','game_complete')
        GROUP BY 1
      ) e USING (d)
      ORDER BY d DESC
    \`)).rows as Record<string, unknown>[];

    const platformGrowth = (await db.execute(sql\`
      SELECT platform,
        COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days')::int AS current_sessions,
        COUNT(*) FILTER (WHERE started_at >= NOW() - INTERVAL '14 days' AND started_at < NOW() - INTERVAL '7 days')::int AS previous_sessions,
        COUNT(DISTINCT player_id) FILTER (WHERE started_at >= NOW() - INTERVAL '7 days' AND player_id IS NOT NULL)::int AS current_players,
        COUNT(DISTINCT player_id) FILTER (WHERE started_at >= NOW() - INTERVAL '14 days' AND started_at < NOW() - INTERVAL '7 days' AND player_id IS NOT NULL)::int AS previous_players
      FROM analytics_sessions
      WHERE started_at >= NOW() - INTERVAL '14 days'
      GROUP BY platform
      ORDER BY current_sessions DESC
    \`)).rows as Record<string, unknown>[];

    const funnelHealth = (await db.execute(sql\`
      SELECT
        COUNT(DISTINCT CASE WHEN event_name = 'session_start' THEN session_id END)::int AS sessions,
        COUNT(*) FILTER (WHERE event_name = 'game_start')::int AS starts,
        COUNT(*) FILTER (WHERE event_name = 'game_complete')::int AS completes,
        COUNT(*) FILTER (WHERE event_name = 'rewarded_ad_requested')::int AS ad_requests,
        COUNT(*) FILTER (WHERE event_name = 'rewarded_ad_completed')::int AS ad_completes,
        COUNT(*) FILTER (WHERE event_name = 'rewarded_ad_failed')::int AS ad_failures
      FROM analytics_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
    \`)).rows[0] as Record<string, unknown> | undefined;

    const pctChange = (current: number, previous: number): string => {
      if (previous === 0) return current > 0 ? "+100%" : "0%";
      const value = ((current - previous) / previous) * 100;
      return \`\${value >= 0 ? "+" : ""}\${value.toFixed(0)}%\`;
    };

    const growthRows = growthDaily.map((row) => {
      const starts = num(row.starts);
      const completes = num(row.completes);
      const completion = starts > 0 ? \`\${((completes / starts) * 100).toFixed(0)}%\` : "—";
      return \`<tr><td>\${esc(row.d)}</td><td>\${num(row.regs)}</td><td>\${num(row.sessions)}</td><td>\${num(row.games)}</td><td>\${starts}</td><td>\${completes}</td><td>\${completion}</td></tr>\`;
    }).join("");

    const platformGrowthRows = platformGrowth.map((row) => {
      const currentSessions = num(row.current_sessions);
      const previousSessions = num(row.previous_sessions);
      const currentPlayers = num(row.current_players);
      const previousPlayers = num(row.previous_players);
      const change = pctChange(currentSessions, previousSessions);
      const trend = currentSessions > previousSessions ? "📈" : currentSessions < previousSessions ? "📉" : "➡️";
      const platform = String(row.platform) === "android" ? "🤖 Android" : String(row.platform) === "ios" ? "🍎 iOS" : "🌐 Web";
      return \`<tr><td>\${platform}</td><td>\${currentSessions}</td><td>\${previousSessions}</td><td>\${change} \${trend}</td><td>\${currentPlayers}</td><td>\${previousPlayers}</td></tr>\`;
    }).join("");

    const funnelSessions = num(funnelHealth?.sessions);
    const funnelStarts = num(funnelHealth?.starts);
    const funnelCompletes = num(funnelHealth?.completes);
    const funnelAdRequests = num(funnelHealth?.ad_requests);
    const funnelAdCompletes = num(funnelHealth?.ad_completes);
    const funnelAdFailures = num(funnelHealth?.ad_failures);
    const startRate = funnelSessions > 0 ? \`\${((funnelStarts / funnelSessions) * 100).toFixed(0)}%\` : "—";
    const completionRate = funnelStarts > 0 ? \`\${((funnelCompletes / funnelStarts) * 100).toFixed(0)}%\` : "—";
    const adCompletionRate = funnelAdRequests > 0 ? \`\${((funnelAdCompletes / funnelAdRequests) * 100).toFixed(0)}%\` : "—";
    const html = `<!doctype html>
<html lang="es"><head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<title>STOP · Panel privado</title>
<style>
  :root { color-scheme: dark; }
  * { box-sizing: border-box; }
  body { margin:0; font-family: system-ui,-apple-system,Segoe UI,Roboto,sans-serif; background:#0f1216; color:#e8edf2; padding:20px; }
  h1 { font-size:1.4rem; margin:0 0 4px; }
  .sub { color:#8a98a8; font-size:.85rem; margin-bottom:20px; }
  .cards { display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr)); gap:12px; margin-bottom:24px; }
  .card { background:#1a2029; border:1px solid #283140; border-radius:14px; padding:16px; }
  .card .label { color:#8a98a8; font-size:.78rem; text-transform:uppercase; letter-spacing:.04em; }
  .card .val { font-size:2rem; font-weight:700; margin-top:4px; }
  .card.accent .val { color:#4ade80; }
  h2 { font-size:1.05rem; margin:24px 0 10px; }
  table { width:100%; border-collapse:collapse; background:#1a2029; border-radius:12px; overflow:hidden; font-size:.9rem; }
  th,td { padding:10px 12px; text-align:left; border-bottom:1px solid #232b36; }
  th { background:#222a35; color:#9fb0c2; font-weight:600; font-size:.78rem; text-transform:uppercase; letter-spacing:.03em; }
  tr:last-child td { border-bottom:none; }
  td:not(:first-child), th:not(:first-child) { text-align:right; }
  .foot { margin-top:24px; color:#5f6c7b; font-size:.78rem; }
  a.btn { display:inline-block; margin-top:8px; color:#4ade80; text-decoration:none; border:1px solid #2c6b45; padding:6px 14px; border-radius:8px; }
</style>
</head><body>
  <h1>📊 Panel privado de STOP</h1>
  <div class="sub">Datos en tiempo real · Hora de España (Europe/Madrid): ${esc(now)}</div>

  <h2>Hoy</h2>
  <div class="cards">
    <div class="card accent"><div class="label">Registrados activos</div><div class="val">${num(todayRows.active)}</div></div>
    <div class="card"><div class="label">Nuevos registros</div><div class="val">${num(todayRows.new_users)}</div></div>
    <div class="card"><div class="label">Partidas (registrados)</div><div class="val">${num(todayRows.games)}</div></div>
    <div class="card"><div class="label">Partidas de invitados</div><div class="val">${num(guestToday?.games)}</div></div>
    <div class="card"><div class="label">Invitados → registro</div><div class="val">${num(guestToday?.conversions)}</div></div>
  </div>

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

  <h2>Top 10 jugadores</h2>
  <table>
    <thead><tr><th>#</th><th>Jugador</th><th>Puntos</th><th>Partidas</th></tr></thead>
    <tbody>${topRows || '<tr><td colspan="4">Sin datos</td></tr>'}</tbody>
  </table>

  <a class="btn" href="">🔄 Actualizar</a>

  <h2>👥 Quién está conectado ahora</h2>
  <div class="cards">
    <div class="card accent"><div class="label">Conectados últimos 90 s</div><div class="val">${activeSessions.length}</div></div>
    <div class="card"><div class="label">Publicidad · vistas 7 días</div><div class="val">${num(adUnique?.impressions)}</div></div>
    <div class="card"><div class="label">Rewarded solicitados</div><div class="val">${num(adUnique?.requested)}</div></div>
    <div class="card"><div class="label">Rewarded completados</div><div class="val">${num(adUnique?.completed)}</div></div>
    <div class="card"><div class="label">Rewarded fallidos</div><div class="val">${num(adUnique?.failed)}</div></div>
  </div>
  <table><thead><tr><th>Jugador</th><th>Cómo se conecta</th><th>Desde</th><th>Versión</th><th>Idioma</th><th>Última conexión</th></tr></thead>
  <tbody>${activeSessionRows || '<tr><td colspan="6">Ahora mismo no hay conexiones activas.</td></tr>'}</tbody></table>

  <h2>🔐 Desde dónde / cómo se conectan · últimas 24 h</h2>
  <table><thead><tr><th>Método</th><th>Activos ahora</th><th>Sesiones</th></tr></thead>
  <tbody>${loginRows || '<tr><td colspan="3">Sin datos.</td></tr>'}</tbody></table>

  <h2>📱 Actividad por plataforma · hoy</h2>
  <table><thead><tr><th>Plataforma</th><th>Sesiones</th><th>Partidas iniciadas</th><th>Partidas terminadas</th><th>Publicidad</th></tr></thead>
  <tbody>${platformRows || '<tr><td colspan="5">Sin actividad.</td></tr>'}</tbody></table>

  <h2>📺 Quién ve publicidad · últimos 7 días</h2>
  <table><thead><tr><th>Jugador</th><th>Evento</th><th>Desde</th><th>Veces</th><th>Último evento</th></tr></thead>
  <tbody>${adViewerRows || '<tr><td colspan="5">Sin eventos de publicidad.</td></tr>'}</tbody></table>


  <h2>📈 Crecimiento · últimos 30 días</h2>
  <div class="cards">
    <div class="card"><div class="label">Sesiones → partidas · 7 días</div><div class="val">\${startRate}</div></div>
    <div class="card"><div class="label">Partidas terminadas · 7 días</div><div class="val">\${completionRate}</div></div>
    <div class="card"><div class="label">Rewarded completados</div><div class="val">\${adCompletionRate}</div></div>
    <div class="card"><div class="label">Rewarded fallidos</div><div class="val">\${funnelAdFailures}</div></div>
  </div>
  <table>
    <thead><tr><th>Día</th><th>Nuevos</th><th>Sesiones</th><th>Partidas</th><th>Iniciadas</th><th>Terminadas</th><th>Finalización</th></tr></thead>
    <tbody>\${growthRows || '<tr><td colspan="7">Sin datos.</td></tr>'}</tbody>
  </table>

  <h2>🌍 Crecimiento por plataforma · 7 días vs 7 anteriores</h2>
  <table>
    <thead><tr><th>Plataforma</th><th>Sesiones 7d</th><th>Sesiones 7d anteriores</th><th>Variación</th><th>Jugadores 7d</th><th>Jugadores anteriores</th></tr></thead>
    <tbody>\${platformGrowthRows || '<tr><td colspan="6">Sin datos de plataforma.</td></tr>'}</tbody>
  </table>

  <h2>🔎 Embudo · dónde estamos perdiendo gente · últimos 7 días</h2>
  <table>
    <thead><tr><th>Etapa</th><th>Personas / eventos</th><th>Conversión respecto a la anterior</th></tr></thead>
    <tbody>
      <tr><td>👥 Sesiones</td><td>\${funnelSessions}</td><td>100%</td></tr>
      <tr><td>🎮 Partidas iniciadas</td><td>\${funnelStarts}</td><td>\${startRate}</td></tr>
      <tr><td>🏁 Partidas terminadas</td><td>\${funnelCompletes}</td><td>\${completionRate}</td></tr>
      <tr><td>📺 Rewarded solicitados</td><td>\${funnelAdRequests}</td><td>—</td></tr>
      <tr><td>🎁 Rewarded completados</td><td>\${funnelAdCompletes}</td><td>\${adCompletionRate}</td></tr>
    </tbody>
  </table>


  <h2>🚨 Incidencias y señales de alarma · últimas 24 h</h2>
  <table>
    <thead><tr><th>Estado</th><th>Señal</th><th>Qué significa</th></tr></thead>
    <tbody>\${incidentHtml}</tbody>
  </table>
  <p class="sub">Estas alertas son diagnósticos automáticos basados únicamente en datos registrados. No sustituyen a un error técnico real.</p>

  <h2>🧪 Telemetría que todavía debemos añadir</h2>
  <table>
    <thead><tr><th>Control</th><th>Situación</th></tr></thead>
    <tbody>
      <tr><td>JavaScript / React</td><td>⚪ Sin evento técnico dedicado todavía</td></tr>
      <tr><td>API HTTP fallida</td><td>⚪ Sin captura global dedicada todavía</td></tr>
      <tr><td>Reconexiones / SSE</td><td>⚪ Hay lógica de reconexión, pero falta evento analítico unificado</td></tr>
      <tr><td>Reward concedido tras anuncio</td><td>🟡 Hay eventos de anuncio; falta una señal unificada de "reward entregado"</td></tr>
      <tr><td>Sala atascada / espera</td><td>🟡 Se puede detectar mejor con eventos de ciclo de vida de sala</td></tr>
    </tbody>
  </table>
  <p class="sub">La siguiente fase puede convertir estos cinco puntos en telemetría real para que una captura del panel permita localizar también fallos técnicos, no solo pérdidas del embudo.</p>

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
