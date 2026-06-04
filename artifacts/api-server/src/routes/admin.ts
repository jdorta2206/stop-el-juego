import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { db } from "@workspace/db";
import { sql } from "drizzle-orm";
import { authLimiter } from "../middlewares/rateLimit";

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
    if (safeEqual(gotUser, user) && safeEqual(gotPass, pass)) {
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

    // Invitados de hoy (guest_stats usa fecha UTC).
    const guestToday = (
      await db.execute(sql`
        SELECT COALESCE(games,0) AS games, COALESCE(conversions,0) AS conversions
        FROM guest_stats
        WHERE day = to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      `)
    ).rows[0] as Record<string, unknown> | undefined;

    // ── Totales históricos ────────────────────────────────────────────────
    const totals = (
      await db.execute(sql`
        SELECT
          (SELECT COUNT(*) FROM player_scores WHERE ${NOT_BOT}) AS users,
          (SELECT COUNT(*) FROM player_scores WHERE ${NOT_BOT} AND is_premium = true) AS premium,
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
  <div class="foot">Acceso privado. No compartas esta dirección ni tus credenciales.</div>
</body></html>`;

    res.status(200).type("html").send(html);
  } catch (err: any) {
    console.error("[admin panel] error:", err?.message ?? err);
    res.status(500).type("html").send("<h1>Error</h1><p>No se pudieron cargar las estadísticas.</p>");
  }
});

export default router;
