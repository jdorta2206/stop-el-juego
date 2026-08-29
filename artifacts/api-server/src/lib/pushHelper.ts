import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable, followsTable } from "@workspace/db";
import { and, eq, not, like, or, isNull, sql } from "drizzle-orm";

const excludeReplitOrigin = or(
  isNull(pushSubscriptionsTable.origin),
  not(like(pushSubscriptionsTable.origin, '%replit.app%')),
);

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || "mailto:dorynex@stopjuegodepalabras.com";

if (VAPID_PUBLIC && VAPID_PRIVATE) {
  webpush.setVapidDetails(VAPID_EMAIL, VAPID_PUBLIC, VAPID_PRIVATE);
}

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  url?: string;
}

// Chrome can automatically suppress notifications from sites it considers
// disruptive. STOP notifications are legitimate in-game notifications, but
// the old schedule could produce several reminders in the same day (daily,
// Happy Hour x3, shop deals, streak rescue, season claims, ranking, etc.).
// Keep important game events, while throttling promotional/repetitive pushes.
const promotionalLastSentAt = new Map<string, number>();
const playerLastSentAt = new Map<string, number>();
const PROMOTIONAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GENERAL_COOLDOWN_MS = 60 * 60 * 1000;
const RANK_COOLDOWN_MS = 6 * 60 * 60 * 1000;

function notificationKind(payload: PushPayload): "daily" | "rank" | "invite" | "friend" | "promo" | "other" {
  const text = `${payload.title} ${payload.body}`.toLowerCase();
  if (/reto diario|daily stop challenge|today's stop challenge|desafio diário|défi quotidien/.test(text)) return "daily";
  if (/te han superado|you.?ve been overtaken|superaram|dépassé/.test(text)) return "rank";
  if (/te invitan|you.?re invited|convidado|invité/.test(text)) return "invite";
  if (/amigo conectado|friend online|amigo online|ami connecté/.test(text)) return "friend";
  if (/happy hour|ofertas hoy|new deals|novas ofertas|nouvelles offres|misiones listas|missions ready|missões prontas|missions prêtes/.test(text)) return "promo";
  return "other";
}

function allowNotification(playerId: string, payload: PushPayload): boolean {
  // Anonymous broadcast subscriptions are intentionally not throttled here:
  // they have no stable identity and must still receive the daily challenge.
  if (!playerId || playerId === "anonymous") return true;

  const now = Date.now();
  const kind = notificationKind(payload);
  const key = `${playerId}:${kind}`;

  if (kind === "promo") {
    const last = promotionalLastSentAt.get(key) || 0;
    if (now - last < PROMOTIONAL_COOLDOWN_MS) return false;
    promotionalLastSentAt.set(key, now);
    return true;
  }

  if (kind === "rank") {
    const last = playerLastSentAt.get(key) || 0;
    if (now - last < RANK_COOLDOWN_MS) return false;
    playerLastSentAt.set(key, now);
    return true;
  }

  if (kind === "daily" || kind === "invite" || kind === "friend") return true;

  const last = playerLastSentAt.get(playerId) || 0;
  if (now - last < GENERAL_COOLDOWN_MS) return false;
  playerLastSentAt.set(playerId, now);
  return true;
}

function cleanupNotificationThrottleMaps() {
  const cutoff = Date.now() - PROMOTIONAL_COOLDOWN_MS;
  for (const [key, ts] of promotionalLastSentAt) {
    if (ts < cutoff) promotionalLastSentAt.delete(key);
  }
  const generalCutoff = Date.now() - RANK_COOLDOWN_MS;
  for (const [key, ts] of playerLastSentAt) {
    if (ts < generalCutoff) playerLastSentAt.delete(key);
  }
}

async function cleanStaleEndpoint(endpoint: string) {
  await db.delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .catch(() => {});
}

type PushRow = typeof pushSubscriptionsTable.$inferSelect;
function dedupeByPlayer(rows: PushRow[]): PushRow[] {
  const anon: PushRow[] = [];
  const byPlayer = new Map<string, PushRow>();
  const rank = (r: PushRow): number => {
    if (r.origin && /stopjuegodepalabras\.com/i.test(r.origin)) return 3;
    if (r.origin) return 2;
    return 1;
  };
  for (const r of rows) {
    if (!r.playerId || r.playerId === "anonymous") { anon.push(r); continue; }
    const existing = byPlayer.get(r.playerId);
    if (!existing) { byPlayer.set(r.playerId, r); continue; }
    const a = rank(r), b = rank(existing);
    if (a > b || (a === b && r.id > existing.id)) byPlayer.set(r.playerId, r);
  }
  return [...byPlayer.values(), ...anon];
}

export async function sendPushToPlayer(playerId: string, payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0;
  if (!allowNotification(playerId, payload)) {
    console.log(`[push] throttled player=${playerId} kind=${notificationKind(payload)} title=${payload.title}`);
    return 0;
  }

  const rows = await db.select().from(pushSubscriptionsTable)
    .where(and(eq(pushSubscriptionsTable.playerId, playerId), excludeReplitOrigin));

  const picked = dedupeByPlayer(rows);

  let sent = 0;
  await Promise.allSettled(picked.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/images/icon-192.png",
          badge: payload.badge || "/images/badge-96.png",
          url: payload.url || "/",
        })
      );
      sent++;
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await cleanStaleEndpoint(row.endpoint);
      } else {
        console.error(`[push] send failed status=${e?.statusCode ?? "unknown"} player=${playerId}`);
      }
    }
  }));

  return sent;
}

export async function sendPushToAllSubscribers(
  payload: PushPayload,
  language?: string
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0, removed: 0 };

  const rows = language
    ? await db.select().from(pushSubscriptionsTable)
        .where(and(eq(pushSubscriptionsTable.language, language), excludeReplitOrigin))
    : await db.select().from(pushSubscriptionsTable).where(excludeReplitOrigin);

  const picked = dedupeByPlayer(rows);
  let sent = 0, failed = 0;
  const toDelete: string[] = [];

  await Promise.allSettled(picked.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/images/icon-192.png",
          badge: payload.badge || "/images/badge-96.png",
          url: payload.url || "/",
        })
      );
      sent++;
    } catch (e: any) {
      failed++;
      if (e.statusCode === 410 || e.statusCode === 404) toDelete.push(row.endpoint);
      else console.error(`[push] broadcast failed status=${e?.statusCode ?? "unknown"}`);
    }
  }));

  for (const ep of toDelete) {
    await cleanStaleEndpoint(ep);
  }

  return { sent, failed, removed: toDelete.length };
}

export async function sendLocalizedBroadcast(
  payloadByLang: Record<string, PushPayload>,
  fallbackLang = "es",
): Promise<{ sent: number; failed: number; removed: number }> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return { sent: 0, failed: 0, removed: 0 };
  const fallback = payloadByLang[fallbackLang];
  if (!fallback) return { sent: 0, failed: 0, removed: 0 };

  const rows = await db.select().from(pushSubscriptionsTable).where(excludeReplitOrigin);
  const picked = dedupeByPlayer(rows);

  let sent = 0, failed = 0;
  const toDelete: string[] = [];

  await Promise.allSettled(picked.map(async (row) => {
    const payload = (row.language && payloadByLang[row.language]) || fallback;
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/images/icon-192.png",
          badge: payload.badge || "/images/badge-96.png",
          url: payload.url || "/",
        })
      );
      sent++;
    } catch (e: any) {
      failed++;
      if (e.statusCode === 410 || e.statusCode === 404) toDelete.push(row.endpoint);
      else console.error(`[push] localized broadcast failed status=${e?.statusCode ?? "unknown"}`);
    }
  }));

  for (const ep of toDelete) {
    await cleanStaleEndpoint(ep);
  }

  return { sent, failed, removed: toDelete.length };
}

const friendOnlineNotifiedAt = new Map<string, number>();
const FRIEND_ONLINE_COOLDOWN_MS = 30 * 60 * 1000;

export async function notifyFollowersPlayerOnline(
  playerId: string,
  playerName: string,
  language: string
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  try {
    const followers = await db.select().from(followsTable)
      .where(eq(followsTable.followedId, playerId));

    if (followers.length === 0) return;

    const now = Date.now();
    const MSGS: Record<string, PushPayload> = {
      es: { title: "🟢 ¡Amigo conectado!", body: `${playerName} está jugando ahora. ¡Reta a partida!`, url: "/multiplayer" },
      en: { title: "🟢 Friend online!", body: `${playerName} is playing now. Challenge them!`, url: "/multiplayer" },
      pt: { title: "🟢 Amigo online!", body: `${playerName} está jogando agora. Desafia-o!`, url: "/multiplayer" },
      fr: { title: "🟢 Ami connecté !", body: `${playerName} joue maintenant. Lance-lui un défi !`, url: "/multiplayer" },
    };
    const msg = MSGS[language] || MSGS.es;

    await Promise.allSettled(followers.map(async (follower) => {
      const dedupeKey = `${follower.followerId}:${playerId}`;
      const lastNotified = friendOnlineNotifiedAt.get(dedupeKey) || 0;
      if (now - lastNotified < FRIEND_ONLINE_COOLDOWN_MS) return;

      const sent = await sendPushToPlayer(follower.followerId, msg);
      if (sent > 0) friendOnlineNotifiedAt.set(dedupeKey, now);
    }));
  } catch (e) {
    console.error("[pushHelper] notifyFollowersPlayerOnline error:", e);
  }
}

setInterval(() => {
  cleanupNotificationThrottleMaps();
  const cutoff = Date.now() - FRIEND_ONLINE_COOLDOWN_MS;
  for (const [key, ts] of friendOnlineNotifiedAt) {
    if (ts < cutoff) friendOnlineNotifiedAt.delete(key);
  }
}, 60 * 60 * 1000);
