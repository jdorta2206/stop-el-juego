import { google } from "googleapis";
import type { androidpublisher_v3 } from "googleapis";
import { db, playSubscriptionsTable, playProductPurchasesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

let warnedMissingSA = false;
let cachedClient: androidpublisher_v3.Androidpublisher | null = null;

function loadServiceAccount(): Record<string, unknown> | null {
  const raw = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
  if (!raw) {
    if (!warnedMissingSA) {
      warnedMissingSA = true;
      console.error(
        "[playBilling] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set. Play Billing verification is unavailable until configured.",
      );
    }
    return null;
  }
  try {
    return JSON.parse(raw) as Record<string, unknown>;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not valid JSON:", msg);
    return null;
  }
}

export function isPlayBillingConfigured(): boolean {
  return loadServiceAccount() !== null && !!getPackageName();
}

export function getPackageName(): string | null {
  return process.env["ANDROID_PACKAGE_NAME"] || null;
}

async function getClient(): Promise<androidpublisher_v3.Androidpublisher | null> {
  if (cachedClient) return cachedClient;
  const credentials = loadServiceAccount();
  if (!credentials) return null;
  const auth = new google.auth.GoogleAuth({
    credentials: credentials as Record<string, string>,
    scopes: ["https://www.googleapis.com/auth/androidpublisher"],
  });
  cachedClient = google.androidpublisher({ version: "v3", auth });
  return cachedClient;
}

const ENTITLED_STATES = new Set(["ACTIVE", "IN_GRACE_PERIOD"]);

export function isPlayStateEntitled(state: string, expiryTimeMs: number): boolean {
  if (!ENTITLED_STATES.has(state)) return false;
  return Date.now() < expiryTimeMs;
}

export interface VerifiedPurchase {
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  state: string;
  expiryTimeMs: number;
  startTimeMs: number;
  isEntitled: boolean;
  acknowledgementState: number;
  raw: Record<string, unknown>;
}

export async function verifyPurchase(
  productId: string,
  purchaseToken: string,
): Promise<VerifiedPurchase | { error: string; status: number }> {
  const packageName = getPackageName();
  if (!packageName) return { error: "ANDROID_PACKAGE_NAME not configured", status: 503 };
  const client = await getClient();
  if (!client) return { error: "Play Billing not configured", status: 503 };
  try {
    const response = await client.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });
    const sub = response.data;
    const expiryTimeMs = Number(sub.expiryTimeMillis ?? 0);
    const startTimeMs = Number(sub.startTimeMillis ?? 0);
    const now = Date.now();
    let state: string;
    if (sub.paymentState === 0) {
      state = expiryTimeMs > now ? "IN_GRACE_PERIOD" : "ON_HOLD";
    } else if (sub.cancelReason !== undefined && sub.cancelReason !== null) {
      state = expiryTimeMs > now ? "ACTIVE" : "CANCELED";
    } else if (expiryTimeMs > 0 && expiryTimeMs <= now) {
      state = "EXPIRED";
    } else {
      state = "ACTIVE";
    }
    return {
      productId,
      purchaseToken,
      orderId: sub.orderId ?? null,
      state,
      expiryTimeMs,
      startTimeMs,
      isEntitled: isPlayStateEntitled(state, expiryTimeMs),
      acknowledgementState: Number(sub.acknowledgementState ?? 0),
      raw: sub as Record<string, unknown>,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] verifyPurchase failed:", msg);
    return { error: `Google Play API error: ${msg}`, status: 502 };
  }
}

export async function acknowledgeSubscription(
  productId: string,
  purchaseToken: string,
  alreadyAcknowledged: boolean,
): Promise<void> {
  if (alreadyAcknowledged) return;
  const packageName = getPackageName();
  if (!packageName) return;
  const client = await getClient();
  if (!client) return;
  try {
    await client.purchases.subscriptions.acknowledge({ packageName, subscriptionId: productId, token: purchaseToken });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] acknowledge failed:", msg);
  }
}

export interface VerifiedProduct {
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  purchaseState: number;
  acknowledgementState: number;
  isPurchased: boolean;
  raw: Record<string, unknown>;
}

export async function verifyProductPurchase(
  productId: string,
  purchaseToken: string,
): Promise<VerifiedProduct | { error: string; status: number }> {
  const packageName = getPackageName();
  if (!packageName) return { error: "ANDROID_PACKAGE_NAME not configured", status: 503 };
  const client = await getClient();
  if (!client) return { error: "Play Billing not configured", status: 503 };
  try {
    const response = await client.purchases.products.get({ packageName, productId, token: purchaseToken });
    const p = response.data;
    const purchaseState = Number(p.purchaseState ?? 1);
    return {
      productId,
      purchaseToken,
      orderId: p.orderId ?? null,
      purchaseState,
      acknowledgementState: Number(p.acknowledgementState ?? 0),
      isPurchased: purchaseState === 0,
      raw: p as Record<string, unknown>,
    };
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] verifyProductPurchase failed:", msg);
    return { error: `Google Play API error: ${msg}`, status: 502 };
  }
}

// Atomic ownership claim. INSERT ... ON CONFLICT DO NOTHING ensures that two
// players racing with the same purchase token cannot both claim ownership.
export async function recordProductPurchase(
  playerId: string,
  v: VerifiedProduct,
): Promise<{ ownershipMismatch: boolean }> {
  await db
    .insert(playProductPurchasesTable)
    .values({
      playerId,
      productId: v.productId,
      purchaseToken: v.purchaseToken,
      orderId: v.orderId ?? null,
      purchaseState: v.purchaseState,
      rawJson: JSON.stringify(v.raw),
    })
    .onConflictDoNothing({ target: playProductPurchasesTable.purchaseToken });

  const existing = await db
    .select({ playerId: playProductPurchasesTable.playerId })
    .from(playProductPurchasesTable)
    .where(eq(playProductPurchasesTable.purchaseToken, v.purchaseToken))
    .limit(1);

  if (!existing[0] || existing[0].playerId !== playerId) {
    return { ownershipMismatch: true };
  }

  await db
    .update(playProductPurchasesTable)
    .set({
      productId: v.productId,
      orderId: v.orderId ?? null,
      purchaseState: v.purchaseState,
      rawJson: JSON.stringify(v.raw),
      updatedAt: new Date(),
    })
    .where(eq(playProductPurchasesTable.purchaseToken, v.purchaseToken));

  return { ownershipMismatch: false };
}

export async function acknowledgeProduct(
  productId: string,
  purchaseToken: string,
  alreadyAcknowledged: boolean,
): Promise<void> {
  if (alreadyAcknowledged) return;
  const packageName = getPackageName();
  if (!packageName) return;
  const client = await getClient();
  if (!client) return;
  try {
    await client.purchases.products.acknowledge({ packageName, productId, token: purchaseToken });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] acknowledgeProduct failed:", msg);
  }
}

// Atomic ownership claim for subscriptions. Existing rows can be refreshed,
// but playerId is never transferred to another account.
export async function upsertPlaySubscription(
  playerId: string,
  v: VerifiedPurchase,
): Promise<{ ownershipMismatch: boolean }> {
  await db
    .insert(playSubscriptionsTable)
    .values({
      playerId,
      productId: v.productId,
      purchaseToken: v.purchaseToken,
      orderId: v.orderId ?? null,
      state: v.state,
      expiryTimeMs: v.expiryTimeMs,
      startTimeMs: v.startTimeMs,
      rawJson: JSON.stringify(v.raw),
    })
    .onConflictDoNothing({ target: playSubscriptionsTable.purchaseToken });

  const existing = await db
    .select({ playerId: playSubscriptionsTable.playerId })
    .from(playSubscriptionsTable)
    .where(eq(playSubscriptionsTable.purchaseToken, v.purchaseToken))
    .limit(1);

  if (!existing[0] || existing[0].playerId !== playerId) {
    return { ownershipMismatch: true };
  }

  await db
    .update(playSubscriptionsTable)
    .set({
      productId: v.productId,
      orderId: v.orderId ?? null,
      state: v.state,
      expiryTimeMs: v.expiryTimeMs,
      startTimeMs: v.startTimeMs,
      rawJson: JSON.stringify(v.raw),
      updatedAt: new Date(),
    })
    .where(eq(playSubscriptionsTable.purchaseToken, v.purchaseToken));

  return { ownershipMismatch: false };
}

export async function updatePlaySubscriptionByToken(
  v: VerifiedPurchase,
): Promise<{ playerId: string | null }> {
  const updated = await db
    .update(playSubscriptionsTable)
    .set({
      productId: v.productId,
      orderId: v.orderId ?? null,
      state: v.state,
      expiryTimeMs: v.expiryTimeMs,
      startTimeMs: v.startTimeMs,
      rawJson: JSON.stringify(v.raw),
      updatedAt: new Date(),
    })
    .where(eq(playSubscriptionsTable.purchaseToken, v.purchaseToken))
    .returning({ playerId: playSubscriptionsTable.playerId });
  return { playerId: updated[0]?.playerId ?? null };
}

export async function getActivePlaySubscriptionForPlayer(
  playerId: string,
): Promise<{ expiryTimeMs: number; productId: string } | null> {
  const result = await db.execute(
    sql`SELECT product_id, expiry_time_ms
        FROM play_subscriptions
        WHERE player_id = ${playerId}
          AND state IN ('ACTIVE', 'IN_GRACE_PERIOD')
          AND expiry_time_ms > ${Date.now()}
        ORDER BY expiry_time_ms DESC
        LIMIT 1`,
  );
  const row = result.rows[0] as { product_id: string; expiry_time_ms: string | number } | undefined;
  if (!row) return null;
  return { productId: row.product_id, expiryTimeMs: Number(row.expiry_time_ms) };
}
