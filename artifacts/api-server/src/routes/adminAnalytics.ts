import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";

const router: IRouter = Router();

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

router.get("/", basicAuth, async (_req, res) => {
  try {
    const online = await db.execute(sql`
      SELECT platform, COUNT(*)::int AS active
      FROM analytics_sessions
      WHERE last_seen >= NOW() - INTERVAL '90 seconds'
      GROUP BY platform
      ORDER BY platform
    `);

    const today = await db.execute(sql`
      SELECT platform,
             COUNT(*) FILTER (WHERE event_name = 'session_start')::int AS sessions,
             COUNT(*) FILTER (WHERE event_name = 'game_start')::int AS games_started,
             COUNT(*) FILTER (WHERE event_name = 'game_complete')::int AS games_completed,
             COUNT(*) FILTER (WHERE event_name = 'ad_impression')::int AS ad_impressions
      FROM analytics_events
      WHERE created_at >= date_trunc('day', NOW() AT TIME ZONE 'Europe/Madrid') AT TIME ZONE 'Europe/Madrid'
      GROUP BY platform
      ORDER BY platform
    `);

    const events = await db.execute(sql`
      SELECT event_name, COUNT(*)::int AS total
      FROM analytics_events
      WHERE created_at >= NOW() - INTERVAL '7 days'
      GROUP BY event_name
      ORDER BY total DESC, event_name
      LIMIT 30
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

    const eventRows = (events.rows as any[]).map((row) => `<tr><td>${esc(row.event_name)}</td><td>${n(row.total)}</td></tr>`).join("");

    const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>STOP · Analytics</title><style>
      :root{color-scheme:dark}*{box-sizing:border-box}body{margin:0;padding:20px;background:#0f1216;color:#e8edf2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif}h1{font-size:1.4rem;margin:0 0 4px}.sub{color:#8a98a8;font-size:.85rem;margin:0 0 20px}.card{background:#1a2029;border:1px solid #283140;border-radius:14px;padding:16px;margin-bottom:18px}table{width:100%;border-collapse:collapse;font-size:.9rem}th,td{padding:10px 12px;border-bottom:1px solid #232b36;text-align:left}th{background:#222a35;color:#9fb0c2;font-size:.76rem;text-transform:uppercase}td:not(:first-child),th:not(:first-child){text-align:right}tr:last-child td{border-bottom:0}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}.kpi{font-size:1.8rem;font-weight:700}.label{font-size:.76rem;color:#8a98a8;text-transform:uppercase}@media(max-width:700px){.grid{grid-template-columns:1fr}}
a{color:#4ade80;text-decoration:none}
    </style></head><body><h1>📊 Analytics de STOP</h1><p class="sub">Panel privado · plataforma y comportamiento · últimos 7 días</p>
    <div class="grid"><div class="card"><div class="label">🍎 iOS conectados</div><div class="kpi">${platformMap.get("ios")?.active ?? 0}</div></div><div class="card"><div class="label">🤖 Android conectados</div><div class="kpi">${platformMap.get("android")?.active ?? 0}</div></div><div class="card"><div class="label">🌐 Web conectados</div><div class="kpi">${platformMap.get("web")?.active ?? 0}</div></div></div>
    <div class="card"><h2>Plataformas · hoy</h2><table><thead><tr><th>Plataforma</th><th>Ahora</th><th>Sesiones</th><th>Partidas iniciadas</th><th>Partidas terminadas</th><th>Impresiones publicidad</th></tr></thead><tbody>${platformRows}</tbody></table></div>
    <div class="card"><h2>Eventos · últimos 7 días</h2><table><thead><tr><th>Evento</th><th>Total</th></tr></thead><tbody>${eventRows || '<tr><td colspan="2">Todavía no hay eventos.</td></tr>'}</tbody></table></div>
    <p><a href="/test">← Volver al panel principal</a></p></body></html>`;
    return res.type("html").send(html);
  } catch (err) {
    console.error("[admin analytics] error:", err);
    return res.status(500).type("html").send("<h1>Analytics no disponible</h1><p>Las tablas de analítica todavía no están inicializadas.</p>");
  }
});

export default router;
