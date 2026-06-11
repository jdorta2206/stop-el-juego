import webpush from "web-push";
import { db } from "@workspace/db";
import { pushSubscriptionsTable, followsTable } from "@workspace/db";
import { and, eq, not, like, or, isNull, sql } from "drizzle-orm";

// Filtro reutilizable: ignora suscripciones cuyo origin sea el dominio
// auxiliar stop-el-juego.replit.app. El dominio canónico es
// stopjuegodepalabras.com (y el TWA de Play Store usa ese mismo dominio).
// Las filas legacy con origin NULL siguen recibiendo notificaciones para no
// romper a los usuarios que ya estaban suscritos antes de añadir esta columna.
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

async function cleanStaleEndpoint(endpoint: string) {
  await db.delete(pushSubscriptionsTable)
    .where(eq(pushSubscriptionsTable.endpoint, endpoint))
    .catch(() => {});
}

// Dedup helper: a single player can have multiple push subscriptions because
// the same person may have subscribed from several browsers / domains (e.g.
// the TWA shell at stopjuegodepalabras.com AND Chrome at stopjuegodepalabras.es
// AND desktop). The browser treats each origin as a separate site so each
// produces its own endpoint row in the DB. Without dedup the daily cron would
// fire one notification per row → the player gets 2-3 duplicate beeps.
//
// Policy: keep ONE subscription per playerId, preferring (in order):
//   1. origin contains the canonical TWA domain "stopjuegodepalabras.com"
//   2. origin is non-null (any real origin beats a legacy NULL row)
//   3. highest id (= most recently created subscription)
//
// Rows with playerId === "" / falsy are anonymous installs; we keep them all
// because there's no identity to dedupe by.
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
    if (!r.playerId) { anon.push(r); continue; }
    const existing = byPlayer.get(r.playerId);
    if (!existing) { byPlayer.set(r.playerId, r); continue; }
    const a = rank(r), b = rank(existing);
    if (a > b || (a === b && r.id > existing.id)) byPlayer.set(r.playerId, r);
  }
  return [...byPlayer.values(), ...anon];
}

export async function sendPushToPlayer(playerId: string, payload: PushPayload): Promise<number> {
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return 0;

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

  // Same dedup policy as sendPushToPlayer: one push per playerId max, plus
  // every anonymous (no-playerId) install. Prevents the "two beeps, one in
  // Spanish + one in Portuguese" issue when a user is subscribed from both
  // the TWA shell and a browser tab on a sister domain.
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
    }
  }));

  for (const ep of toDelete) {
    await cleanStaleEndpoint(ep);
  }

  return { sent, failed, removed: toDelete.length };
}

// Localized one-shot broadcast. Unlike calling sendPushToAllSubscribers once
// per language (which dedupes only WITHIN each call and would double-notify a
// player who has rows stored under different language values), this fetches
// every eligible subscription ONCE, dedupes by player ONCE across all
// languages, and then picks the localized payload per chosen row — falling
// back to `fallbackLang` for rows whose language is null/unknown so nobody is
// silently skipped.
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
