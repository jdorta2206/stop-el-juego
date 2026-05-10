import { Router, type IRouter, type Request, type Response } from "express";
import { readPlayerId } from "../lib/playerAuth";
import { stripeStorage } from "../stripeStorage";
import {
  isPlayBillingConfigured,
  verifyPurchase,
  upsertPlaySubscription,
  updatePlaySubscriptionByToken,
} from "../lib/playBillingService";
import { isUserPremium } from "../lib/premiumStatus";
import { verifyPubSubJwt } from "../lib/pubsubAuth";

const router: IRouter = Router();

// ── POST /api/billing/play/verify ────────────────────────────────────────
// Body: { productId, purchaseToken }
// Auth: signed player token (cookie or X-Stop-Token). The client gets the
// purchaseToken from the Digital Goods API after a successful PaymentRequest.
// We re-validate against Google and persist; the response tells the client
// whether premium is now active so the UI can update without reload.
router.post("/verify", async (req: Request, res: Response) => {
  if (!isPlayBillingConfigured()) {
    return res.status(503).json({
      error: "Play Billing not configured on server",
      hint: "Set GOOGLE_PLAY_SERVICE_ACCOUNT_JSON and ANDROID_PACKAGE_NAME secrets",
    });
  }
  const playerId = readPlayerId(req);
  if (!playerId) return res.status(401).json({ error: "Not authenticated" });

  const { productId, purchaseToken } = req.body as {
    productId?: string;
    purchaseToken?: string;
  };
  if (!productId || !purchaseToken) {
    return res.status(400).json({ error: "productId and purchaseToken required" });
  }
  if (productId !== "premium_monthly") {
    // Whitelist of accepted SKUs — prevents a compromised client from claiming
    // some other product id we never created.
    return res.status(400).json({ error: "Unknown product" });
  }

  const v = await verifyPurchase(productId, purchaseToken);
  if ("error" in v) {
    return res.status(v.status).json({ error: v.error });
  }

  const upsert = await upsertPlaySubscription(playerId, v);
  if (upsert.ownershipMismatch) {
    // Token already bound to a different player. Refuse to transfer the
    // entitlement — log and 409 so the client surfaces a meaningful error.
    console.warn(
      `[playBilling] ownership mismatch: token ${v.purchaseToken.slice(0, 12)}… already belongs to another player; rejecting verify from ${playerId}`,
    );
    return res.status(409).json({
      error: "Esta compra ya está vinculada a otra cuenta",
    });
  }

  // Mirror the unified entitlement onto player_scores.is_premium so legacy
  // Stripe-era reads keep working. Importantly we mirror BOTH true and false:
  // a non-entitled verify (e.g. user opens app with cancelled sub) must not
  // leave a stale `is_premium=true` from a previous Play purchase — but we
  // also must not clear premium for users who are still active via Stripe.
  const truth = await isUserPremium(playerId);
  await stripeStorage.updatePlayerStripeInfo(playerId, { isPremium: truth });

  return res.json({
    isPremium: v.isEntitled,
    expiryTimeMs: v.expiryTimeMs,
    state: v.state,
  });
});

// ── POST /api/billing/play/webhook ───────────────────────────────────────
// Real-Time Developer Notifications (RTDN) from Google Pub/Sub. The Pub/Sub
// push subscription delivers a JSON envelope:
//   { message: { data: <base64 json>, messageId, publishTime }, subscription }
// `data` (base64-decoded) is a `DeveloperNotification` containing one of:
//   - subscriptionNotification: { notificationType, purchaseToken, subscriptionId }
//   - oneTimeProductNotification | testNotification | voidedPurchaseNotification
//
// Pub/Sub authenticates the request with an OIDC JWT in the Authorization
// header. We verify it as a defense in depth on top of the secret URL.
//
// notificationType values (we care about subscriptions):
//   1 RECOVERED, 2 RENEWED, 3 CANCELED, 4 PURCHASED, 5 ON_HOLD,
//   6 IN_GRACE_PERIOD, 7 RESTARTED, 8 PRICE_CHANGE_CONFIRMED,
//   9 DEFERRED, 10 PAUSED, 11 PAUSE_SCHEDULE_CHANGED, 12 REVOKED,
//   13 EXPIRED.
//
// Strategy: ignore the notificationType and just re-fetch the subscription
// from Google by purchaseToken. The fresh state from the API is always the
// most accurate, and re-fetching makes the handler trivially idempotent.

const SUBSCRIPTION_NOTIFICATION_TYPES_HANDLED = new Set([
  1, 2, 3, 4, 5, 6, 7, 12, 13,
]);

interface PubSubEnvelope {
  message?: {
    data?: string;
    messageId?: string;
    publishTime?: string;
  };
  subscription?: string;
}

interface DeveloperNotification {
  packageName?: string;
  eventTimeMillis?: string;
  subscriptionNotification?: {
    version?: string;
    notificationType?: number;
    purchaseToken?: string;
    subscriptionId?: string;
  };
  testNotification?: { version?: string };
}

router.post("/webhook", async (req: Request, res: Response) => {
  // 🛡️ JWT auth FIRST — refuse to even parse the body of unsigned requests.
  // Returning 401 here also tells Pub/Sub something is wrong with our config
  // so we'll see it in their delivery dashboard instead of failing silently.
  const auth = await verifyPubSubJwt(req.headers["authorization"] as string | undefined);
  if (!auth.ok) {
    console.warn(`[playBilling] webhook auth rejected: ${auth.reason}`);
    return res.status(401).json({ error: "Unauthorized" });
  }

  // Always ack 2xx within ~10s or Pub/Sub will retry — we do work synchronously
  // here because it's a single API call + DB write, well under that budget.
  if (!isPlayBillingConfigured()) {
    // Still ack so Google doesn't retry forever; we just log.
    console.warn("[playBilling] webhook received but service not configured");
    return res.status(204).send();
  }

  const envelope = req.body as PubSubEnvelope;
  const dataB64 = envelope?.message?.data;
  if (!dataB64) {
    return res.status(400).json({ error: "Missing message.data" });
  }

  let notification: DeveloperNotification;
  try {
    const decoded = Buffer.from(dataB64, "base64").toString("utf8");
    notification = JSON.parse(decoded) as DeveloperNotification;
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error("[playBilling] webhook decode failed:", msg);
    return res.status(400).json({ error: "Invalid envelope" });
  }

  // Ack test notifications without doing anything.
  if (notification.testNotification) {
    console.log("[playBilling] received Pub/Sub test notification");
    return res.status(204).send();
  }

  const subNote = notification.subscriptionNotification;
  if (!subNote || !subNote.purchaseToken || !subNote.subscriptionId) {
    return res.status(204).send();
  }
  if (
    subNote.notificationType !== undefined &&
    !SUBSCRIPTION_NOTIFICATION_TYPES_HANDLED.has(subNote.notificationType)
  ) {
    return res.status(204).send();
  }

  const v = await verifyPurchase(subNote.subscriptionId, subNote.purchaseToken);
  if ("error" in v) {
    console.error("[playBilling] webhook verify failed:", v.error);
    // Return 5xx so Pub/Sub retries.
    return res.status(500).json({ error: v.error });
  }

  const { playerId } = await updatePlaySubscriptionByToken(v);
  if (!playerId) {
    // Notification arrived before /verify — common for the very first PURCHASED
    // event. The client's /verify call will create the row, so just ack.
    console.log(
      `[playBilling] webhook for unknown token ${v.purchaseToken.slice(0, 12)}… — ignoring (will be created by /verify)`,
    );
    return res.status(204).send();
  }

  // Self-heal player_scores.is_premium if it disagrees with the truth.
  const truth = await isUserPremium(playerId);
  await stripeStorage.updatePlayerStripeInfo(playerId, { isPremium: truth });

  return res.status(204).send();
});

// ── GET /api/billing/play/status ─────────────────────────────────────────
// Convenience endpoint mirroring /api/stripe/status but reading the unified
// premium check (Stripe OR Play). Useful for the client to refresh state
// after returning from a purchase.
router.get("/status", async (req: Request, res: Response) => {
  const playerId = readPlayerId(req) || (req.query["playerId"] as string | undefined);
  if (!playerId) return res.status(400).json({ error: "playerId required" });
  const premium = await isUserPremium(playerId);
  return res.json({ isPremium: premium });
});

export default router;
