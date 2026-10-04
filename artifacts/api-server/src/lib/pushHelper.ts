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
const PROMOTIONAL_COOLDOWN_MS = 24 * 60 * 60 * 1000;
const GENERAL_COOLDOWN_MS = 60 * 60 * 1000;
const RANK_COOLDOWN_MS = 6 * 60 * 60 * 1000;
const FRIEND_ONLINE_COOLDOWN_MS = 30 * 60 * 1000;

function throttleKey(playerId: string, kind: string): string {
  return `push:${playerId}:${kind}`;
}

async function claimNotificationThrottle(
  playerId: string,
  kind: "daily" | "rank" | "invite" | "friend" | "promo" | "other",
  cooldownMs: number,
): Promise<boolean> {
  if (!playerId || playerId === "anonymous" || kind === "daily" || kind === "invite") return true;
  const cutoff = new Date(Date.now() - cooldownMs);
  const key = throttleKey(playerId, kind);
  const result = await db.execute(sql`
    INSERT INTO push_notification_throttles (throttle_key, claimed_at)
    VALUES (${key}, NOW())
    ON CONFLICT (throttle_key) DO UPDATE
      SET claimed_at = NOW()
      WHERE push_notification_throttles.claimed_at < ${cutoff}
    RETURNING throttle_key
  `);
  return result.rows.length > 0;
}

async function rollbackNotificationThrottle(
  playerId: string,
  kind: "daily" | "rank" | "invite" | "friend" | "promo" | "other",
): Promise<void> {
  if (!playerId || playerId === "anonymous" || kind === "daily" || kind === "invite") return;
  await db.execute(sql`
    DELETE FROM push_notification_throttles
    WHERE throttle_key = ${throttleKey(playerId, kind)}
  `).catch(() => {});
}

function notificationCooldownMs(kind: ReturnType<typeof notificationKind>): number {
  if (kind === "promo") return PROMOTIONAL_COOLDOWN_MS;
  if (kind === "rank") return RANK_COOLDOWN_MS;
  if (kind === "friend") return FRIEND_ONLINE_COOLDOWN_MS;
  return GENERAL_COOLDOWN_MS;
}

function notificationKind(payload: PushPayload): "daily" | "rank" | "invite" | "friend" | "promo" | "other" {
  const text = `${payload.title} ${payload.body}`.toLowerCase();
  if (/reto diario|daily stop challenge|today's stop challenge|desafio diário|défi quotidien/.test(text)) return "daily";
  if (/te han superado|you.?ve been overtaken|superaram|dépassé/.test(text)) return "rank";
  if (/te invitan|you.?re invited|convidado|invité/.test(text)) return "invite";
  if (/amigo conectado|friend online|amigo online|ami connecté/.test(text)) return "friend";
  if (/happy hour|ofertas hoy|new deals|novas ofertas|nouvelles offres|misiones listas|missions ready|missões prontas|missions prêtes/.test(text)) return "promo";
  return "other";
}

async function cleanStaleEndpoint(row: Pick<PushRow, "endpoint" | "p256dh" | "auth" | "playerId">) {
  // Only remove the exact subscription that failed. The same endpoint can be
  // re-registered concurrently (for example after browser renewal); an
  // unconditional endpoint delete could otherwise erase the fresh row.
  await db.delete(pushSubscriptionsTable)
    .where(and(
      eq(pushSubscriptionsTable.endpoint, row.endpoint),
      eq(pushSubscriptionsTable.p256dh, row.p256dh),
      eq(pushSubscriptionsTable.auth, row.auth),
      eq(pushSubscriptionsTable.playerId, row.playerId),
    ))
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
  const kind = notificationKind(payload);
  const claimed = await claimNotificationThrottle(playerId, kind, notificationCooldownMs(kind));
  if (!claimed) {
    console.log(`[push] throttled player=${playerId} kind=${kind} title=${payload.title}`);
    return 0;
  }

  let rows: PushRow[];
  try {
    rows = await db.select().from(pushSubscriptionsTable)
      .where(and(\n        eq(pushSubscriptionsTable.playerId, playerId),\n        eq(pushSubscriptionsTable.enabled, true),\n        sql`${pushSubscriptionsTable.mutedUntil} < ${Date.now()}`,\n        excludeReplitOrigin,\n      ));
  } catch (error) {
    // A database read failure happens after the in-memory throttle is claimed.
    // Release that claim so a transient outage does not suppress later pushes.
    await rollbackNotificationThrottle(playerId, kind);
    throw error;
  }

  // A direct player notification must reach every active device/session owned by
  // the player. dedupeByPlayer() is only for broadcasts, where one notification
  // per player is intentional; push_subscriptions.endpoint is already unique.
  const picked = rows;

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
      if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403) {
        await cleanStaleEndpoint(row);
      } else {
        console.error(`[push] send failed status=${e?.statusCode ?? "unknown"} player=${playerId}`);
      }
    }
  }));

  // A failed delivery must not consume the cooldown: otherwise a transient
  // webpush/provider failure can suppress the player's next valid notification.
  if (sent === 0) await rollbackNotificationThrottle(playerId, kind);

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
  const toDelete: PushRow[] = [];

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
      if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403) toDelete.push(row);
      else console.error(`[push] broadcast failed status=${e?.statusCode ?? "unknown"}`);
    }
  }));

  for (const row of toDelete) {
    await cleanStaleEndpoint(row);
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
  const toDelete: PushRow[] = [];

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
      if (e.statusCode === 410 || e.statusCode === 404 || e.statusCode === 403) toDelete.push(row);
      else console.error(`[push] localized broadcast failed status=${e?.statusCode ?? "unknown"}`);
    }
  }));

  for (const row of toDelete) {
    await cleanStaleEndpoint(row);
  }

  return { sent, failed, removed: toDelete.length };
}

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

    const MSGS: Record<string, PushPayload> = {
      es: { title: "🟢 ¡Amigo conectado!", body: `${playerName} está jugando ahora. ¡Reta a partida!`, url: "/multiplayer" },
      en: { title: "🟢 Friend online!", body: `${playerName} is playing now. Challenge them!`, url: "/multiplayer" },
      pt: { title: "🟢 Amigo online!", body: `${playerName} está jogando agora. Desafia-o!`, url: "/multiplayer" },
      fr: { title: "🟢 Ami connecté !", body: `${playerName} joue maintenant. Lance-lui un défi !`, url: "/multiplayer" },
    };
    const msg = MSGS[language] || MSGS.es;

    await Promise.allSettled(followers.map(async (follower) => {
      try {
        // sendPushToPlayer performs the durable PostgreSQL claim. Keeping the
        // claim in one place prevents a double-claim on the same notification.
        await sendPushToPlayer(follower.followerId, msg);
      } catch {
        // sendPushToPlayer rolls back its claim when delivery fails.
      }
    }));
  } catch (e) {
    console.error("[pushHelper] notifyFollowersPlayerOnline error:", e);
  }
}

