import { Router, type IRouter } from "express";
import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { sendPushToAllSubscribers } from "../lib/pushHelper";

const router: IRouter = Router();

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || "mailto:stopeljuegodepalabras@gmail.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

// GET /api/notifications/vapid-public-key
router.get("/vapid-public-key", (_req, res) => {
  res.json({ key: VAPID_PUBLIC });
});

// POST /api/notifications/subscribe
// Accepts optional `hourLocal` (0-23) and `tzOffsetMinutes` (UTC offset as
// returned by `new Date().getTimezoneOffset() * -1`) so the daily reminder
// fires at the player's chosen local time instead of a global UTC hour.
// Falls back to (20:00, 0) if absent for back-compat with older clients.
router.post("/subscribe", async (req, res) => {
  const { playerId, subscription, language, hourLocal, tzOffsetMinutes } = req.body;
  if (!playerId || !subscription?.endpoint) {
    res.status(400).json({ error: "Missing playerId or subscription" });
    return;
  }

  const { endpoint, keys } = subscription;
  const { p256dh, auth } = keys || {};

  if (!p256dh || !auth) {
    res.status(400).json({ error: "Invalid subscription keys" });
    return;
  }

  // Clamp to safe ranges. Bad client data should never poison the row.
  const hour = Number.isFinite(hourLocal) && hourLocal >= 0 && hourLocal <= 23
    ? Math.floor(hourLocal) : 20;
  const tz = Number.isFinite(tzOffsetMinutes) && tzOffsetMinutes >= -14 * 60 && tzOffsetMinutes <= 14 * 60
    ? Math.floor(tzOffsetMinutes) : 0;

  try {
    await db.execute(sql`
      INSERT INTO push_subscriptions (
        player_id, endpoint, p256dh, auth, language,
        hour_local, tz_offset_minutes, enabled, muted_until
      )
      VALUES (
        ${playerId}, ${endpoint}, ${p256dh}, ${auth}, ${language || "es"},
        ${hour}, ${tz}, TRUE, 0
      )
      ON CONFLICT (endpoint) DO UPDATE
        SET player_id         = EXCLUDED.player_id,
            language          = EXCLUDED.language,
            -- Preserve the user chosen reminder hour on resubscribe.
            -- Only tz_offset_minutes is refreshed because the device
            -- offset can change with DST or travel; the hour stays what
            -- the player explicitly picked in /notificaciones.
            tz_offset_minutes = EXCLUDED.tz_offset_minutes,
            enabled           = TRUE
    `);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("Subscribe error:", e.message);
    res.status(500).json({ error: "Failed to save subscription" });
  }
});

// GET /api/notifications/preferences?endpoint=...
// Returns the player-facing prefs for a single subscription. Used by the
// Settings UI to render the current toggle / time / mute state.
router.get("/preferences", async (req, res) => {
  const endpoint = String(req.query.endpoint || "").trim();
  if (!endpoint) { res.status(400).json({ error: "Missing endpoint" }); return; }
  try {
    const rows = await db.select().from(pushSubscriptionsTable)
      .where(eq(pushSubscriptionsTable.endpoint, endpoint)).limit(1);
    const row = rows[0];
    if (!row) { res.status(404).json({ error: "Not found" }); return; }
    res.json({
      enabled: row.enabled,
      hourLocal: row.hourLocal,
      tzOffsetMinutes: row.tzOffsetMinutes,
      mutedUntil: row.mutedUntil,
      language: row.language,
    });
  } catch (e: any) {
    console.error("[preferences GET]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// PATCH /api/notifications/preferences
// Partial update — only the fields present in the body are touched. Used
// for the toggle, the hour picker, and the "snooze 7 days" button.
router.patch("/preferences", async (req, res) => {
  const { endpoint, enabled, hourLocal, muteDays } = req.body || {};
  if (!endpoint) { res.status(400).json({ error: "Missing endpoint" }); return; }

  const sets: string[] = [];
  const vals: unknown[] = [];
  let i = 1;

  if (typeof enabled === "boolean") {
    sets.push(`enabled = $${i++}`); vals.push(enabled);
  }
  if (typeof hourLocal === "number" && hourLocal >= 0 && hourLocal <= 23) {
    sets.push(`hour_local = $${i++}`); vals.push(Math.floor(hourLocal));
  }
  if (typeof muteDays === "number" && muteDays >= 0 && muteDays <= 30) {
    const until = muteDays === 0 ? 0 : Date.now() + muteDays * 86_400_000;
    sets.push(`muted_until = $${i++}`); vals.push(until);
  }
  if (sets.length === 0) { res.status(400).json({ error: "Nothing to update" }); return; }

  vals.push(endpoint);
  try {
    // Raw query — drizzle's dynamic update builder is awkward for partials
    // and the values are already type-checked above.
    const { pool } = await import("@workspace/db");
    const result = await pool.query(
      `UPDATE push_subscriptions SET ${sets.join(", ")} WHERE endpoint = $${i} RETURNING enabled, hour_local, muted_until`,
      vals,
    );
    if (result.rowCount === 0) { res.status(404).json({ error: "Not found" }); return; }
    res.json({ ok: true, row: result.rows[0] });
  } catch (e: any) {
    console.error("[preferences PATCH]", e?.message);
    res.status(500).json({ error: "Failed" });
  }
});

// DELETE /api/notifications/unsubscribe
router.delete("/unsubscribe", async (req, res) => {
  const { endpoint } = req.body;
  if (!endpoint) { res.status(400).json({ error: "Missing endpoint" }); return; }
  try {
    await db.delete(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.endpoint, endpoint));
    res.json({ ok: true });
  } catch {
    res.status(500).json({ error: "Failed" });
  }
});

// POST /api/notifications/send-daily  (called by cron or manual trigger)
router.post("/send-daily", async (req, res) => {
  const secret = req.headers["x-cron-secret"];
  if (secret !== process.env.CRON_SECRET && process.env.CRON_SECRET) {
    res.status(403).json({ error: "Forbidden" }); return;
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    res.status(503).json({ error: "VAPID not configured" }); return;
  }

  const lang = (req.body?.language || "es") as string;

  const DAILY_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "🎯 Reto Diario STOP", body: "¡Tu reto de hoy está listo! ¿Puedes ganarle a la IA?" },
    en: { title: "🎯 Daily STOP Challenge", body: "Today's challenge is ready! Can you beat the AI?" },
    pt: { title: "🎯 Desafio Diário STOP", body: "O desafio de hoje está pronto! Consegues bater a IA?" },
    fr: { title: "🎯 Défi Quotidien STOP", body: "Le défi du jour est prêt ! Tu peux battre l'IA ?" },
  };
  const msg = DAILY_MSGS[lang] || DAILY_MSGS.es;

  const result = await sendPushToAllSubscribers(
    { ...msg, icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: "/reto" },
    lang
  );

  res.json(result);
});

// POST /api/notifications/send-invite — notify a specific player (room invite)
router.post("/send-invite", async (req, res) => {
  const { targetPlayerId, fromName, roomCode, language } = req.body;
  if (!targetPlayerId || !fromName || !roomCode) {
    res.status(400).json({ error: "Missing fields" }); return;
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) {
    res.status(503).json({ error: "VAPID not configured" }); return;
  }

  const lang = language || "es";
  const INVITE_MSGS: Record<string, { title: string; body: string }> = {
    es: { title: "🎮 ¡Te invitan a jugar STOP!", body: `${fromName} quiere jugar contigo. Sala: ${roomCode}` },
    en: { title: "🎮 You're invited to STOP!", body: `${fromName} wants to play with you. Room: ${roomCode}` },
    pt: { title: "🎮 Convidado para jogar STOP!", body: `${fromName} quer jogar contigo. Sala: ${roomCode}` },
    fr: { title: "🎮 Invité à jouer à STOP !", body: `${fromName} veut jouer avec toi. Salle : ${roomCode}` },
  };
  const msg = INVITE_MSGS[lang] || INVITE_MSGS.es;

  const rows = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.playerId, targetPlayerId));

  let sent = 0;
  await Promise.allSettled(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({ ...msg, icon: "/images/icon-192.png", badge: "/images/badge-96.png", url: `/multijugador?room=${roomCode}` })
      );
      sent++;
    } catch {}
  }));

  res.json({ sent });
});

export default router;
