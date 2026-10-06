import { Router, type IRouter, type Request, type Response, type NextFunction } from "express";
import { timingSafeEqual } from "crypto";
import { getHeapStatistics } from "v8";
import { db, indexesReady } from "@workspace/db";
import { sql } from "drizzle-orm";
import { isStripeReady } from "../stripeClient";

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

function basicAuth(req: Request, res: Response, next: NextFunction): void {
  const user = process.env["ADMIN_PANEL_USER"];
  const pass = process.env["ADMIN_PANEL_PASSWORD"];

  if (!user || !pass) {
    res.status(503).type("html").send("<h1>Panel no configurado</h1>");
    return;
  }

  const [scheme, encoded] = String(req.headers.authorization || "").split(" ");
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

function esc(value: unknown): string {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

type Check = {
  name: string;
  status: "ok" | "warn" | "error";
  value: string;
  detail: string;
};

function badge(status: Check["status"]): string {
  if (status === "ok") return "🟢";
  if (status === "warn") return "🟡";
  return "🔴";
}

function statusLabel(status: Check["status"]): string {
  if (status === "ok") return "OK";
  if (status === "warn") return "ATENCIÓN";
  return "PROBLEMA";
}

router.get("/", basicAuth, async (_req: Request, res: Response) => {
  const started = Date.now();
  const checks: Check[] = [];

  try {
    const dbStarted = Date.now();
    await db.execute(sql`SELECT 1 AS ok`);
    const dbMs = Date.now() - dbStarted;

    checks.push({
      name: "Base de datos",
      status: dbMs < 500 ? "ok" : dbMs < 1500 ? "warn" : "error",
      value: `${dbMs} ms`,
      detail: dbMs < 500 ? "Consulta de salud dentro de lo normal." : "La base de datos está respondiendo más lenta de lo esperado.",
    });

    checks.push({
      name: "Índices / arranque",
      status: indexesReady() ? "ok" : "error",
      value: indexesReady() ? "LISTO" : "NO LISTO",
      detail: indexesReady() ? "El servicio considera la base preparada." : "El backend todavía no considera terminada la inicialización.",
    });

    checks.push({
      name: "Stripe",
      status: isStripeReady() ? "ok" : "warn",
      value: isStripeReady() ? "LISTO" : "NO LISTO",
      detail: isStripeReady() ? "El cliente de pagos está inicializado." : "Stripe todavía no está listo; comprobar configuración si persiste.",
    });

    const tableRows = (await db.execute(sql`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
        AND table_name = ANY(ARRAY[
          'player_scores',
          'game_history',
          'analytics_events',
          'analytics_sessions',
          'guest_stats'
        ])
    `)).rows as Array<{ table_name: string }>;
    const tableSet = new Set(tableRows.map((r) => String(r.table_name)));
    const missingTables = ["player_scores", "game_history", "analytics_events", "analytics_sessions", "guest_stats"]
      .filter((name) => !tableSet.has(name));

    checks.push({
      name: "Tablas críticas",
      status: missingTables.length === 0 ? "ok" : "error",
      value: missingTables.length === 0 ? "5/5" : `${5 - missingTables.length}/5`,
      detail: missingTables.length === 0 ? "Las tablas necesarias para el panel y la trazabilidad existen." : `Faltan: ${missingTables.join(", ")}.`,
    });

    const errorRows = (await db.execute(sql`
      SELECT
        COUNT(*) FILTER (WHERE event_name = 'api_error')::int AS api_errors,
        COUNT(*) FILTER (WHERE event_name = 'client_error')::int AS client_errors
      FROM analytics_events
      WHERE trusted = TRUE
        AND event_name IN ('api_error', 'client_error')
        AND created_at >= NOW() - INTERVAL '15 minutes'
    `)).rows[0] as { api_errors?: number; client_errors?: number } | undefined;

    const apiErrors = Number(errorRows?.api_errors ?? 0);
    const clientErrors = Number(errorRows?.client_errors ?? 0);
    const totalErrors = apiErrors + clientErrors;

    checks.push({
      name: "Errores recientes",
      status: totalErrors === 0 ? "ok" : totalErrors <= 5 ? "warn" : "error",
      value: String(totalErrors),
      detail: totalErrors === 0
        ? "No hay errores registrados en los últimos 15 minutos."
        : `${apiErrors} API + ${clientErrors} cliente en los últimos 15 minutos.`,
    });

    const activeRows = (await db.execute(sql`
      SELECT COUNT(*)::int AS active
      FROM analytics_sessions
      WHERE last_seen >= NOW() - INTERVAL '90 seconds'
    `)).rows[0] as { active?: number } | undefined;
    const active = Number(activeRows?.active ?? 0);

    const eventRows = (await db.execute(sql`
      SELECT COUNT(*)::int AS events
      FROM analytics_events
      WHERE trusted = TRUE
        AND created_at >= NOW() - INTERVAL '15 minutes'
    `)).rows[0] as { events?: number } | undefined;
    const recentEvents = Number(eventRows?.events ?? 0);

    checks.push({
      name: "Monitorización",
      status: active === 0 || recentEvents > 0 ? "ok" : "warn",
      value: active > 0 ? `${recentEvents} eventos` : "SIN TRÁFICO",
      detail: active > 0
        ? `${active} sesiones activas y ${recentEvents} eventos fiables en 15 minutos.`
        : "No hay sesiones activas ahora; no se considera un fallo de instrumentación.",
    });

    const memory = process.memoryUsage();
    const heapLimit = getHeapStatistics().heap_size_limit;
    const heapUsedPct = Math.round((memory.heapUsed / Math.max(heapLimit, 1)) * 100);
    checks.push({
      name: "Memoria del proceso",
      status: heapUsedPct < 80 ? "ok" : heapUsedPct < 92 ? "warn" : "error",
      value: `${heapUsedPct}% heap`,
      detail: `${Math.round(memory.heapUsed / 1024 / 1024)} MB usados de un límite V8 de ${Math.round(heapLimit / 1024 / 1024)} MB.`,
    });

    const uptimeHours = process.uptime() / 3600;
    checks.push({
      name: "Proceso",
      status: "ok",
      value: `${uptimeHours.toFixed(1)} h`,
      detail: "Proceso Node.js activo y respondiendo a esta comprobación.",
    });

    const overall = checks.some((c) => c.status === "error")
      ? "error"
      : checks.some((c) => c.status === "warn")
        ? "warn"
        : "ok";

    const overallText = overall === "ok"
      ? "JUEGO SANO"
      : overall === "warn"
        ? "ATENCIÓN"
        : "PROBLEMA";

    const checkRows = checks.map((check) => `
      <tr>
        <td>${badge(check.status)} <strong>${esc(check.name)}</strong></td>
        <td><span class="pill ${check.status}">${statusLabel(check.status)}</span></td>
        <td>${esc(check.value)}</td>
        <td>${esc(check.detail)}</td>
      </tr>
    `).join("");

    const now = new Date().toLocaleString("es-ES", { timeZone: "Europe/Madrid" });
    const elapsed = Date.now() - started;

    res.status(200).type("html").send(`<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1"/>
<meta name="robots" content="noindex,nofollow"/>
<meta http-equiv="refresh" content="30"/>
<title>STOP · Salud operativa</title>
<style>
:root{color-scheme:dark}*{box-sizing:border-box}
body{margin:0;background:#0f1216;color:#e8edf2;font-family:system-ui,-apple-system,Segoe UI,Roboto,sans-serif;padding:18px}
.wrap{max-width:1100px;margin:auto}.sub{color:#8a98a8;font-size:.85rem}
.hero{border:1px solid #283140;border-radius:16px;padding:20px;margin:16px 0;background:#1a2029}
.hero.ok{border-color:#2c6b45}.hero.warn{border-color:#80651f}.hero.error{border-color:#7f2d2d}
.hero h1{margin:0 0 6px;font-size:1.5rem}.hero .state{font-size:1.8rem;font-weight:800}
.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px;margin:16px 0}
.card{background:#1a2029;border:1px solid #283140;border-radius:14px;padding:15px}.label{color:#8a98a8;font-size:.75rem;text-transform:uppercase}.value{font-size:1.7rem;font-weight:700;margin-top:4px}
table{width:100%;border-collapse:collapse;background:#1a2029;border-radius:14px;overflow:hidden;font-size:.88rem}
th,td{padding:11px 12px;border-bottom:1px solid #232b36;text-align:left;vertical-align:top}
th{background:#222a35;color:#9fb0c2;font-size:.75rem;text-transform:uppercase}
tr:last-child td{border-bottom:0}.pill{display:inline-block;border-radius:999px;padding:3px 8px;font-size:.72rem;font-weight:700}.pill.ok{background:#123d26;color:#6ee7a0}.pill.warn{background:#4a3910;color:#f4cf65}.pill.error{background:#4a1717;color:#ff8c8c}
.btn{display:inline-block;margin:14px 8px 0 0;padding:8px 13px;border:1px solid #2c6b45;border-radius:8px;color:#6ee7a0;text-decoration:none}
.foot{margin-top:16px;color:#5f6c7b;font-size:.76rem}
@media(max-width:700px){body{padding:10px}table{font-size:.78rem}th,td{padding:9px 7px}.grid{grid-template-columns:1fr 1fr}}
</style>
</head>
<body><div class="wrap">
<div class="sub">STOP · Centro de operaciones · actualización automática cada 30 s</div>
<div class="hero ${overall}">
  <h1>🛡️ Salud operativa</h1>
  <div class="state">${overall === "ok" ? "🟢" : overall === "warn" ? "🟡" : "🔴"} ${overallText}</div>
  <div class="sub">Comprobado: ${esc(now)} · respuesta del diagnóstico: ${elapsed} ms</div>
</div>

<div class="grid">
  <div class="card"><div class="label">Sesiones activas</div><div class="value">${active}</div></div>
  <div class="card"><div class="label">Errores · 15 min</div><div class="value">${totalErrors}</div></div>
  <div class="card"><div class="label">Eventos · 15 min</div><div class="value">${recentEvents}</div></div>
  <div class="card"><div class="label">Uptime proceso</div><div class="value">${uptimeHours.toFixed(1)} h</div></div>
</div>

<table>
<thead><tr><th>Control</th><th>Estado</th><th>Valor</th><th>Qué significa</th></tr></thead>
<tbody>${checkRows}</tbody>
</table>

<a class="btn" href="/test">← Panel completo</a>
<a class="btn" href="/test/health">🔄 Comprobar ahora</a>
<div class="foot">Panel privado. No compartas la URL ni las credenciales.</div>
</div></body></html>`);
  } catch (err: any) {
    console.error("[admin health] error:", err?.message ?? err);
    res.status(500).type("html").send("<h1>🔴 Error del diagnóstico</h1><p>No se pudo completar la comprobación de salud.</p><a href=\"/test\">Volver al panel</a>");
  }
});

export default router;
