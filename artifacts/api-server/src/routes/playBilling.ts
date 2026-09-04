import { Router, Request, Response } from "express";
import { db, playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import {
  verifyPurchase,
  verifyProductPurchase,
  upsertPlaySubscription,
  recordProductPurchase,
  acknowledgeSubscription,
  acknowledgeProduct,
} from "../lib/playBillingService";
import { grantWorldCupPack, WORLD_CUP_PACK_SKU } from "../lib/worldCupPack";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router = Router();

// GET /api/billing/play/status?playerId=xxx
router.get("/status", async (req: Request, res: Response) => {
  try {
    const playerId = String(req.query.playerId || "").trim();
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    const [player] = await db
      .select({ isPremium: playerScoresTable.isPremium })
      .from(playerScoresTable)
      .where(eq(playerScoresTable.playerId, playerId))
      .limit(1);

    return res.json({ isPremium: player?.isPremium === true });
  } catch (error: any) {
    console.error("❌ Error en /status Play Billing:", error.message);
    return res.status(500).json({ error: "Error al consultar el estado Premium" });
  }
});

// ============================================================
// VERIFICAR SUSCRIPCIÓN PREMIUM
// ============================================================
router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!verifyClaimedIdentity(req, String(playerId))) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }

    const verified = await verifyPurchase(String(productId), String(purchaseToken));
    if ("error" in verified) {
      return res.status(verified.status).json({ error: verified.error });
    }
    if (!verified.isEntitled) {
      return res.status(400).json({ error: "Suscripción no válida o no activa" });
    }

    const ownership = await upsertPlaySubscription(String(playerId), verified);
    if (ownership.ownershipMismatch) {
      return res.status(409).json({ error: "Esta compra pertenece a otra cuenta" });
    }

    await acknowledgeSubscription(
      verified.productId,
      verified.purchaseToken,
      verified.acknowledgementState === 1,
    );

    await db
      .update(playerScoresTable)
      .set({ isPremium: true })
      .where(eq(playerScoresTable.playerId, String(playerId)));

    console.log(`✅ Premium activado para ${playerId}`);
    return res.json({ isPremium: true, expiryTimeMs: verified.expiryTimeMs });
  } catch (error: any) {
    console.error("❌ Error en /verify:", error?.message || error);
    return res.status(500).json({ error: "Error al verificar la suscripción" });
  }
});

// ============================================================
// VERIFICAR PACK MUNDIAL (pago único) – CON GRANT
// ============================================================
router.post("/verify-pack", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!verifyClaimedIdentity(req, String(playerId))) {
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

    const ownership = await recordProductPurchase(String(playerId), verified);
    if (ownership.ownershipMismatch) {
      return res.status(409).json({ error: "Esta compra pertenece a otra cuenta" });
    }

    const grantResult = await grantWorldCupPack(String(playerId));
    if (!grantResult.ok) {
      console.error("❌ Error al conceder el pack:", grantResult.error);
      return res.status(500).json({ error: "Error al conceder los cosméticos" });
    }

    await acknowledgeProduct(
      verified.productId,
      verified.purchaseToken,
      verified.acknowledgementState === 1,
    );

    console.log(`✅ Pack Mundial concedido a ${playerId}`);
    return res.json({ granted: true, items: grantResult.granted, total: grantResult.total });
  } catch (error: any) {
    console.error("❌ Error en /verify-pack:", error?.message || error);
    return res.status(500).json({ error: "Error al verificar el Pack Mundial" });
  }
});

export default router;
