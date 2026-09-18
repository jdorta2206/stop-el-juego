import { Router, Request, Response } from "express";
import { grantWorldCupPack, WORLD_CUP_PACK_SKU } from "../lib/worldCupPack";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { isUserPremium } from "../lib/premiumStatus";
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
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }
    const isPremium = await isUserPremium(playerId);
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
    if (!verifyClaimedIdentity(req, claimedPlayerId)) return res.status(403).json({ error: "Identidad del jugador no válida" });

    const verified = await verifyPurchase(String(productId), String(purchaseToken));
    if ("error" in verified) return res.status(verified.status).json({ error: verified.error });
    if (!verified.isEntitled) return res.status(400).json({ error: "Suscripción no válida o no activa" });

    const ownership = await upsertPlaySubscription(claimedPlayerId, verified);
    if (ownership.ownershipMismatch) return res.status(403).json({ error: "Esta compra ya está vinculada a otro jugador" });

    await acknowledgeSubscription(verified.productId, verified.purchaseToken, verified.acknowledgementState === 1);
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
    if (!verifyClaimedIdentity(req, claimedPlayerId)) return res.status(403).json({ error: "Identidad del jugador no válida" });
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
