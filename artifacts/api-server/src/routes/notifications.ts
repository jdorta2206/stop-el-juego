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
router.post("/subscribe", async (req, res) => {
  const { playerId, subscription, language } = req.body;
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

  try {
    await db.execute(sql`
      INSERT INTO push_subscriptions (player_id, endpoint, p256dh, auth, language)
      VALUES (${playerId}, ${endpoint}, ${p256dh}, ${auth}, ${language || "es"})
      ON CONFLICT (endpoint) DO UPDATE
        SET player_id = EXCLUDED.player_id,
            language  = EXCLUDED.language
    `);
    res.json({ ok: true });
  } catch (e: any) {
    console.error("Subscribe error:", e.message);
    res.status(500).json({ error: "Failed to save subscription" });
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
    { ...msg, icon: "/images/icon-192.png", badge: "/images/icon-192.png", url: "/reto" },
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
        JSON.stringify({ ...msg, icon: "/images/icon-192.png", badge: "/images/icon-192.png", url: `/multijugador?room=${roomCode}` })
      );
      sent++;
    } catch {}
  }));

  res.json({ sent });
});

export default router;
