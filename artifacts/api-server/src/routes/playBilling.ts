import { Router, Request, Response } from "express";
import { grantWorldCupPack, WORLD_CUP_PACK_SKU } from "../lib/worldCupPack";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import { isUserPremium } from "../lib/premiumStatus";
import {
  acknowledgeProduct,
  acknowledgeSubscription,
  recordProductPurchase,
  upsertPlaySubscription,
  verifyProductPurchase,
  verifyPurchase,
} from "../lib/playBillingService";

const router = Router();

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
    if (!playerId || !productId || !purchaseToken) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const claimedPlayerId = String(playerId);
    if (!verifyClaimedIdentity(req, claimedPlayerId)) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }

    const verified = await verifyPurchase(String(productId), String(purchaseToken));
    if ("error" in verified) {
      return res.status(verified.status).json({ error: verified.error });
    }
    if (!verified.isEntitled) {
      return res.status(400).json({ error: "Suscripción no válida o no activa" });
    }

    const ownership = await upsertPlaySubscription(claimedPlayerId, verified);
    if (ownership.ownershipMismatch) {
      return res.status(403).json({ error: "Esta compra ya está vinculada a otro jugador" });
    }

    await acknowledgeSubscription(
      verified.productId,
      verified.purchaseToken,
      verified.acknowledgementState === 1,
    );

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
    if (!playerId || !productId || !purchaseToken) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    const claimedPlayerId = String(playerId);
    if (!verifyClaimedIdentity(req, claimedPlayerId)) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }

    if (productId !== WORLD_CUP_PACK_SKU) {
      return res.status(400).json({ error: "Producto no válido" });
    }

    const verified = await verifyProductPurchase(String(productId), String(purchaseToken));
    if ("error" in verified) {
      return res.status(verified.status).json({ error: verified.error });
    }
    if (!verified.isPurchased) {
      return res.status(400).json({ error: "Compra no válida" });
    }

    const ownership = await recordProductPurchase(claimedPlayerId, verified);
    if (ownership.ownershipMismatch) {
      return res.status(403).json({ error: "Compra ya vinculada a otro jugador" });
    }

    const grantResult = await grantWorldCupPack(claimedPlayerId);
    if (!grantResult.ok) {
      console.error("❌ Error al conceder el pack:", grantResult.error);
      return res.status(500).json({ error: "Error al conceder los cosméticos" });
    }

    await acknowledgeProduct(
      verified.productId,
      verified.purchaseToken,
      verified.acknowledgementState === 1,
    );

    console.log(`✅ Pack Mundial Play concedido a ${claimedPlayerId}`);
    return res.json({ granted: true, items: grantResult.granted, total: grantResult.total });
  } catch (error: any) {
    console.error("❌ Error en /verify-pack:", error.message);
    return res.status(500).json({ error: "Error al verificar el Pack Mundial" });
  }
});

export default router;
