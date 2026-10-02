import { Router, Request, Response } from "express";
import { grantWorldCupPack, WORLD_CUP_PACK_SKU } from "../lib/worldCupPack";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { isUserPremium } from "../lib/premiumStatus";
import { stripeStorage } from "../stripeStorage";
import { verifyPubSubJwt } from "../lib/pubsubAuth";
import {
  acknowledgeProduct,
  acknowledgeSubscription,
  recordProductPurchase,
  upsertPlaySubscription,
  verifyProductPurchase,
  verifyPurchase,
  verifyPurchaseByToken,
  getPackageName,
  updatePlaySubscriptionByToken,
} from "../lib/playBillingService";

const router = Router();

router.post("/webhook", async (req: Request, res: Response) => {
  // Google Cloud Pub/Sub sends an authenticated OIDC bearer token with push
  // deliveries. Reject unauthenticated requests before touching billing data.
  const auth = await verifyPubSubJwt(req.headers.authorization);
  if (!auth.ok) {
    console.warn("[playBilling] RTDN rejected:", auth.reason);
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const envelope = req.body;
    const encoded = envelope?.message?.data;
    if (!encoded || typeof encoded !== "string") {
      // Pub/Sub test/empty messages are still acknowledged so they are not
      // retried forever. Real RTDN messages always contain message.data.
      console.log("[playBilling] RTDN message without data acknowledged");
      return res.status(200).json({ received: true });
    }

    let notification: any;
    try {
      const decoded = Buffer.from(encoded, "base64").toString("utf8");
      notification = JSON.parse(decoded);
    } catch (err) {
      console.error("[playBilling] Invalid RTDN base64/JSON:", err);
      return res.status(400).json({ error: "Invalid Pub/Sub message" });
    }

    const packageName = getPackageName();
    if (!packageName || notification?.packageName !== packageName) {
      console.warn(
        "[playBilling] RTDN package mismatch:",
        notification?.packageName,
        "expected:",
        packageName,
      );
      return res.status(400).json({ error: "Package mismatch" });
    }

    // Test notifications contain no purchase token and need no DB update.
    if (notification?.testNotification) {
      console.log("[playBilling] RTDN test notification received");
      return res.status(200).json({ received: true, test: true });
    }

    const subNotification = notification?.subscriptionNotification;
    if (!subNotification?.purchaseToken) {
      // We currently use RTDN for subscriptions. One-time product events are
      // handled by the purchase verification flow and are intentionally not
      // interpreted here.
      return res.status(200).json({ received: true, ignored: true });
    }

    const purchaseToken = String(subNotification.purchaseToken);
    const verified = await verifyPurchaseByToken(purchaseToken);
    if ("error" in verified) {
      // 502 tells Pub/Sub to retry transient Google API failures. Permanent
      // malformed/unknown tokens are also safe to retry because the next
      // delivery may arrive after Play has finalized the purchase.
      console.error("[playBilling] RTDN verification failed:", verified.error);
      return res.status(502).json({ error: verified.error });
    }

    const updated = await updatePlaySubscriptionByToken(verified);
    if (!updated.playerId) {
      // The RTDN can legitimately arrive before the client has completed
      // /verify and bound the purchase token to a player. Do not acknowledge
      // the Pub/Sub delivery in that state: retry it so the later /verify can
      // establish ownership and the same RTDN can then apply the transition.
      console.warn("[playBilling] RTDN token is not linked to a player yet; requesting retry");
      return res.status(503).json({ error: "Purchase token not linked yet" });
    }

    // Retry acknowledgement from RTDN when the client-side /verify could not acknowledge the purchase.
    const acknowledged = await acknowledgeSubscription(
      verified.productId,
      verified.purchaseToken,
      verified.acknowledgementState === 1,
    );
    if (!acknowledged) {
      // Keep the Pub/Sub delivery unacknowledged so a transient Google API
      // failure gets retried instead of risking an unacknowledged purchase
      // being refunded after Google's acknowledgement deadline.
      return res.status(503).json({ error: "Subscription acknowledgement failed" });
    }
    console.log(
      "[playBilling] RTDN processed",
      JSON.stringify({
        notificationType: subNotification.notificationType,
        productId: verified.productId,
        state: verified.state,
        expiryTimeMs: verified.expiryTimeMs,
        playerId: updated.playerId,
      }),
    );

    return res.status(200).json({
      received: true,
      updated: updated.playerId !== null,
    });
  } catch (error: any) {
    console.error("[playBilling] RTDN webhook error:", error?.message ?? error);
    return res.status(500).json({ error: "Webhook processing error" });
  }
});

router.get("/status", async (req: Request, res: Response) => {
  try {
    const playerId = String(req.query.playerId || "").trim();
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    if (!await verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }
    const isPremium = await isUserPremium(playerId);
    // Keep the legacy cached mirror synchronized with the live unified
    // entitlement so rankings/rooms do not display stale Premium state after
    // a Play renewal, restore, cancellation, or expiry.
    await stripeStorage.updatePlayerStripeInfo(playerId, { isPremium });
    return res.json({ isPremium });
  } catch (error: any) {
    console.error("❌ Error en /status Play Billing:", error.message);
    return res.status(500).json({ error: "Error al consultar el estado Premium" });
  }
});

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) return res.status(400).json({ error: "Faltan campos obligatorios" });
    const claimedPlayerId = String(playerId);
    if (!await verifyClaimedIdentity(req, claimedPlayerId)) return res.status(403).json({ error: "Identidad del jugador no válida" });

    const requestedProductId = String(productId).trim();
    if (requestedProductId !== "premium_monthly") {
      return res.status(400).json({ error: "Producto de suscripción no válido" });
    }

    const verified = await verifyPurchase(requestedProductId, String(purchaseToken));
    if ("error" in verified) return res.status(verified.status).json({ error: verified.error });
    if (!verified.isEntitled) return res.status(400).json({ error: "Suscripción no válida o no activa" });

    const ownership = await upsertPlaySubscription(claimedPlayerId, verified);
    if (ownership.ownershipMismatch) return res.status(403).json({ error: "Esta compra ya está vinculada a otro jugador" });

    const acknowledged = await acknowledgeSubscription(
      verified.productId,
      verified.purchaseToken,
      verified.acknowledgementState === 1,
    );
    if (!acknowledged) {
      return res.status(503).json({ error: "No se pudo confirmar la compra con Google Play" });
    }
    console.log(`✅ Premium Play verificado para ${claimedPlayerId}`);
    return res.json({ isPremium: true });
  } catch (error: any) {
    console.error("❌ Error en /verify:", error.message);
    return res.status(500).json({ error: "Error al verificar la suscripción" });
  }
});

router.post("/verify-pack", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) return res.status(400).json({ error: "Faltan campos obligatorios" });
    const claimedPlayerId = String(playerId);
    if (!await verifyClaimedIdentity(req, claimedPlayerId)) return res.status(403).json({ error: "Identidad del jugador no válida" });
    if (productId !== WORLD_CUP_PACK_SKU) return res.status(400).json({ error: "Producto no válido" });

    const verified = await verifyProductPurchase(String(productId), String(purchaseToken));
    if ("error" in verified) return res.status(verified.status).json({ error: verified.error });
    if (!verified.isPurchased) return res.status(400).json({ error: "Compra no válida" });

    const ownership = await recordProductPurchase(claimedPlayerId, verified);
    if (ownership.ownershipMismatch) return res.status(403).json({ error: "Compra ya vinculada a otro jugador" });

    const grantResult = await grantWorldCupPack(claimedPlayerId);
    if (!grantResult.ok) {
      console.error("❌ Error al conceder el pack:", grantResult.error);
      return res.status(500).json({ error: "Error al conceder los cosméticos" });
    }

    await acknowledgeProduct(verified.productId, verified.purchaseToken, verified.acknowledgementState === 1);
    console.log(`✅ Pack Mundial Play concedido a ${claimedPlayerId}`);
    return res.json({ granted: true, items: grantResult.granted, total: grantResult.total });
  } catch (error: any) {
    console.error("❌ Error en /verify-pack:", error.message);
    return res.status(500).json({ error: "Error al verificar el Pack Mundial" });
  }
});

export default router;
