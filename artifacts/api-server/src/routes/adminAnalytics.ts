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

router.get("/", authLimiter, basicAuth, async (_req, res) => {
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
        SELECT platform, session_id, player_id, created_at
        FROM day_events
        WHERE event_name = 'game_start'
          AND metadata_json::jsonb->>'source' = 'client_game_start'
        UNION ALL
        SELECT DISTINCT ON (platform, player_id, metadata_json::jsonb->>'roomId')
               platform, session_id, player_id, MIN(created_at) OVER (
                 PARTITION BY platform, player_id, metadata_json::jsonb->>'roomId'
               ) AS created_at
        FROM day_events
        WHERE event_name = 'game_start'
          AND metadata_json::jsonb->>'source' = 'server_room_start'
          AND player_id IS NOT NULL
        ORDER BY platform, player_id, metadata_json::jsonb->>'roomId', created_at
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
    <div class="card"><h2>Plataformas · hoy</h2><table><thead><tr><th>Plataforma</th><th>Ahora</th><th>Sesiones</th><th>Partidas iniciadas · jugador</th><th>Partidas terminadas · resultado real</th><th>Impresiones publicidad</th></tr></thead><tbody>${platformRows}</tbody></table></div>
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
