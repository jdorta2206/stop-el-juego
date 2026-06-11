import { google } from "googleapis";
import type { androidpublisher_v3 } from "googleapis";
import { db, playSubscriptionsTable, playProductPurchasesTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";

// ── Service Account loading ──────────────────────────────────────────────
// Reads JSON credentials from GOOGLE_PLAY_SERVICE_ACCOUNT_JSON. This is the
// JSON file downloaded from Google Cloud Console for a service account that
// has been granted "View financial data" + "Manage orders" in Play Console.
// Resolved lazily so the API still boots if the secret is missing — only the
// /verify endpoint will return 503 in that case.

let warnedMissingSA = false;
let cachedClient: androidpublisher_v3.Androidpublisher | null = null;

function loadServiceAccount(): Record<string, unknown> | null {
  const raw = process.env["GOOGLE_PLAY_SERVICE_ACCOUNT_JSON"];
  if (!raw) {
    if (!warnedMissingSA) {
      warnedMissingSA = true;
      console.error(
        "[playBilling] GOOGLE_PLAY_SERVICE_ACCOUNT_JSON is not set. " +
          "Play Billing /verify and /webhook endpoints will return 503 until configured. " +
          "See GOOGLE_PLAY_BILLING_SETUP.md for instructions.",
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

// ── Active-state helpers ─────────────────────────────────────────────────
// Per Google Play docs, these states grant entitlement:
//   - ACTIVE              → paid and current
//   - IN_GRACE_PERIOD     → renewal failed, user has ~3 days to fix payment
// Everything else (CANCELED until expiry, ON_HOLD, PAUSED, EXPIRED, REVOKED)
// removes entitlement immediately. CANCELED is special: the user keeps access
// until expiryTimeMs — we model that by leaving state='ACTIVE' until expiry.

const ENTITLED_STATES = new Set(["ACTIVE", "IN_GRACE_PERIOD"]);

export function isPlayStateEntitled(state: string, expiryTimeMs: number): boolean {
  if (!ENTITLED_STATES.has(state)) return false;
  return Date.now() < expiryTimeMs;
}

// ── Purchase verification ────────────────────────────────────────────────
// Called from POST /api/billing/play/verify when the client completes a
// PaymentRequest and gets back a purchaseToken. We re-fetch the subscription
// from Google as the source of truth — never trust the client's claim alone.

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
  if (!packageName) {
    return { error: "ANDROID_PACKAGE_NAME not configured", status: 503 };
  }
  const client = await getClient();
  if (!client) {
    return { error: "Play Billing not configured", status: 503 };
  }
  try {
    const response = await client.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });
    const sub = response.data;
    const expiryTimeMs = Number(sub.expiryTimeMillis ?? 0);
    const startTimeMs = Number(sub.startTimeMillis ?? 0);
    // Map Google's subscription resource fields to our normalized state set.
    // paymentState: 0=pending, 1=received, 2=free trial, 3=pending deferred upgrade
    // cancelReason: 0=user, 1=system (payment fail), 2=replaced, 3=developer
    // Distinguishing IN_GRACE_PERIOD vs ON_HOLD:
    //   - paymentState=0 AND expiry still in future → IN_GRACE_PERIOD
    //     (Google charges failed but the user keeps access for ~3 days)
    //   - paymentState=0 AND expiry in past → ON_HOLD
    //     (grace period elapsed, subscription paused server-side)
    let state: string;
    const now = Date.now();
    if (sub.paymentState === 0) {
      state = expiryTimeMs > now ? "IN_GRACE_PERIOD" : "ON_HOLD";
    } else if (sub.cancelReason !== undefined && sub.cancelReason !== null) {
      // Cancelled (by user, system, or developer) — still entitled until
      // expiry, then transitions to CANCELED. cancelReason 1 (system) means
      // payment failed and Google gave up; treat same as expired afterwards.
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

// ── Acknowledge ──────────────────────────────────────────────────────────
// Google Play requires the developer to acknowledge each purchase within 3
// days, or it gets auto-refunded. Idempotent: if the subscription was
// already acknowledged we skip the API call. Errors are logged but never
// thrown — failing to acknowledge should not prevent the user from getting
// entitlement on our side. The next /verify or webhook will retry.

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
    await client.purchases.subscriptions.acknowledge({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });
    console.log(
      `[playBilling] acknowledged subscription ${productId} (token ${purchaseToken.slice(0, 12)}…)`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] acknowledge failed:", msg);
  }
}

// ── One-time product (managed product) verification ─────────────────────
// Subscriptions use purchases.subscriptions.*; one-time products (the World
// Cup pack) use purchases.products.*. Same service account + scope. We never
// trust the client's claim — we re-fetch the purchase from Google and check
// purchaseState before granting the entitlement.

export interface VerifiedProduct {
  productId: string;
  purchaseToken: string;
  orderId: string | null;
  purchaseState: number; // 0 = purchased, 1 = canceled, 2 = pending
  acknowledgementState: number; // 0 = not acknowledged, 1 = acknowledged
  isPurchased: boolean;
  raw: Record<string, unknown>;
}

export async function verifyProductPurchase(
  productId: string,
  purchaseToken: string,
): Promise<VerifiedProduct | { error: string; status: number }> {
  const packageName = getPackageName();
  if (!packageName) {
    return { error: "ANDROID_PACKAGE_NAME not configured", status: 503 };
  }
  const client = await getClient();
  if (!client) {
    return { error: "Play Billing not configured", status: 503 };
  }
  try {
    const response = await client.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });
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

// Anti-replay ledger for one-time products. Binds a purchase token to the
// first player who verifies it; a different player replaying the same token
// is refused. Returns `ownershipMismatch` so the route can deny the grant.
// Idempotent: the same player re-verifying their own token is allowed (so
// auto-restore / network retries still grant via the idempotent inventory
// grant downstream).
export async function recordProductPurchase(
  playerId: string,
  v: VerifiedProduct,
): Promise<{ ownershipMismatch: boolean }> {
  const existing = await db
    .select({ playerId: playProductPurchasesTable.playerId })
    .from(playProductPurchasesTable)
    .where(eq(playProductPurchasesTable.purchaseToken, v.purchaseToken))
    .limit(1);
  if (existing[0] && existing[0].playerId !== playerId) {
    return { ownershipMismatch: true };
  }

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
    .onConflictDoUpdate({
      target: playProductPurchasesTable.purchaseToken,
      set: {
        // playerId intentionally NOT updated — never transfer ownership.
        productId: v.productId,
        orderId: v.orderId ?? null,
        purchaseState: v.purchaseState,
        rawJson: JSON.stringify(v.raw),
        updatedAt: new Date(),
      },
    });
  return { ownershipMismatch: false };
}

// Acknowledge a one-time product purchase. Like acknowledgeSubscription,
// Google auto-refunds purchases not acknowledged within 3 days. Idempotent
// (skips when already acknowledged) and never throws — a failed ack must not
// block the entitlement; the next /verify-pack call retries.
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
    await client.purchases.products.acknowledge({
      packageName,
      productId,
      token: purchaseToken,
    });
    console.log(
      `[playBilling] acknowledged product ${productId} (token ${purchaseToken.slice(0, 12)}…)`,
    );
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] acknowledgeProduct failed:", msg);
  }
}

// ── Persistence ──────────────────────────────────────────────────────────
// Idempotent upsert keyed on purchase_token. Two parallel /verify calls or
// a /verify followed by a webhook with the same token produce a single row.

export async function upsertPlaySubscription(
  playerId: string,
  v: VerifiedPurchase,
): Promise<{ ownershipMismatch: boolean }> {
  // Defense-in-depth: a purchase token is bound to whichever player first
  // verifies it. If a *different* playerId later replays the same token
  // (token theft, shared device, etc.) we refuse to reassign and let the
  // caller surface a clear error. The original owner keeps entitlement.
  const existing = await db
    .select({ playerId: playSubscriptionsTable.playerId })
    .from(playSubscriptionsTable)
    .where(eq(playSubscriptionsTable.purchaseToken, v.purchaseToken))
    .limit(1);
  if (existing[0] && existing[0].playerId !== playerId) {
    return { ownershipMismatch: true };
  }

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
    .onConflictDoUpdate({
      target: playSubscriptionsTable.purchaseToken,
      set: {
        // playerId NOT updated here on purpose — we already proved above
        // that any existing row belongs to this same player, and we never
        // want a UPSERT path that silently transfers ownership.
        productId: v.productId,
        orderId: v.orderId ?? null,
        state: v.state,
        expiryTimeMs: v.expiryTimeMs,
        startTimeMs: v.startTimeMs,
        rawJson: JSON.stringify(v.raw),
        updatedAt: new Date(),
      },
    });
  return { ownershipMismatch: false };
}

// Used by the RTDN webhook when we don't yet know the playerId (the
// notification only carries the purchaseToken). We update the existing row
// if any; if the token is unknown we log and skip — Google occasionally
// sends notifications for purchases that haven't yet hit /verify.
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
