import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable, followsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

const VAPID_PUBLIC  = process.env.VAPID_PUBLIC_KEY  || "";
const VAPID_PRIVATE = process.env.VAPID_PRIVATE_KEY || "";
const VAPID_EMAIL   = process.env.VAPID_EMAIL       || "mailto:stopeljuegodepalabras@gmail.com";

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

async function cleanStaleEndpoint(endpoint: string) {
  await db.delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .catch(() => {});
}

export async function sendPushToPlayer(playerId: string, payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0;

  const rows = await db.select().from(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.playerId, playerId));

  let sent = 0;
  await Promise.allSettled(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/images/icon-192.png",
          badge: payload.badge || "/images/icon-192.png",
          url: payload.url || "/",
        })
      );
      sent++;
    } catch (e: any) {
      if (e.statusCode === 410 || e.statusCode === 404) {
        await cleanStaleEndpoint(row.endpoint);
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
    ? await db.select().from(pushSubscriptionsTable).where(eq(pushSubscriptionsTable.language, language))
    : await db.select().from(pushSubscriptionsTable);

  let sent = 0, failed = 0;
  const toDelete: string[] = [];

  await Promise.allSettled(rows.map(async (row) => {
    try {
      await webpush.sendNotification(
        { endpoint: row.endpoint, keys: { p256dh: row.p256dh, auth: row.auth } },
        JSON.stringify({
          title: payload.title,
          body: payload.body,
          icon: payload.icon || "/images/icon-192.png",
          badge: payload.badge || "/images/icon-192.png",
          url: payload.url || "/",
        })
      );
      sent++;
    } catch (e: any) {
      failed++;
      if (e.statusCode === 410 || e.statusCode === 404) toDelete.push(row.endpoint);
    }
  }));

  for (const ep of toDelete) {
    await cleanStaleEndpoint(ep);
  }

  return { sent, failed, removed: toDelete.length };
}

// Notify all followers of a player that they're online
// Uses in-memory dedupe so each follower only gets 1 notification per 30 min per friend
const friendOnlineNotifiedAt = new Map<string, number>();
const FRIEND_ONLINE_COOLDOWN_MS = 30 * 60 * 1000;

export async function notifyFollowersPlayerOnline(
  playerId: string,
  playerName: string,
  language: string
): Promise<void> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return;

  try {
    // Find all followers of this player (people who follow playerId)
    const followers = await db.select().from(followsTable)
      .where(eq(followsTable.followedId, playerId));

    if (followers.length === 0) return;

    const now = Date.now();
    const MSGS: Record<string, PushPayload> = {
      es: { title: "🟢 ¡Amigo conectado!", body: `${playerName} está jugando ahora. ¡Reta a partida!`, url: "/multijugador" },
      en: { title: "🟢 Friend online!", body: `${playerName} is playing now. Challenge them!`, url: "/multijugador" },
      pt: { title: "🟢 Amigo online!", body: `${playerName} está jogando agora. Desafia-o!`, url: "/multijugador" },
      fr: { title: "🟢 Ami connecté !", body: `${playerName} joue maintenant. Lance-lui un défi !`, url: "/multijugador" },
    };
    const msg = MSGS[language] || MSGS.es;

    await Promise.allSettled(followers.map(async (follower) => {
      const dedupeKey = `${follower.followerId}:${playerId}`;
      const lastNotified = friendOnlineNotifiedAt.get(dedupeKey) || 0;
      if (now - lastNotified < FRIEND_ONLINE_COOLDOWN_MS) return;

      const sent = await sendPushToPlayer(follower.followerId, msg);
      if (sent > 0) {
        friendOnlineNotifiedAt.set(dedupeKey, now);
      }
    }));
  } catch (e) {
    console.error("[pushHelper] notifyFollowersPlayerOnline error:", e);
  }
}

// Clean up old dedupe entries every hour
setInterval(() => {
  const cutoff = Date.now() - FRIEND_ONLINE_COOLDOWN_MS;
  for (const [key, ts] of friendOnlineNotifiedAt) {
    if (ts < cutoff) friendOnlineNotifiedAt.delete(key);
  }
}, 60 * 60 * 1000);
