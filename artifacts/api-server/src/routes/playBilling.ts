import { Router, Request, Response } from "express";
import { grantWorldCupPack } from "../lib/worldCupPack";
import { verifyPurchase, acknowledgeSubscription, verifyProductPurchase, acknowledgeProduct, upsertPlaySubscription } from "../lib/playBillingService";
import { isUserPremium } from "../lib/premiumStatus";
import { stripeStorage } from "../stripeStorage";

const router = Router();

router.get("/status", async (req: Request, res: Response) => {
  try {
    const playerId = String(req.query.playerId || "").trim();
    if (!playerId) return res.status(400).json({ error: "Falta playerId", isPremium: false });
    const isPremium = await isUserPremium(playerId);
    try { await stripeStorage.updatePlayerStripeInfo(playerId, { isPremium }); } catch (error: any) { console.warn("[play/status] cache sync failed:", error?.message || error); }
    res.json({ isPremium });
  } catch (error: any) {
    console.error("❌ Error en /play/status:", error?.message || error);
    res.status(500).json({ error: "No se pudo consultar Premium", isPremium: false });
  }
});

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) return res.status(400).json({ error: "Faltan campos obligatorios" });
    const verified = await verifyPurchase(String(productId), String(purchaseToken));
    if ("error" in verified) return res.status(verified.status).json({ error: verified.error });
    if (!verified.isEntitled) return res.status(400).json({ error: "Suscripción no válida o caducada" });
    const ownership = await upsertPlaySubscription(String(playerId), verified);
    if (ownership.ownershipMismatch) return res.status(403).json({ error: "Esta compra pertenece a otra cuenta" });
    await acknowledgeSubscription(verified.productId, verified.purchaseToken, verified.acknowledgementState === 1);
    try { await stripeStorage.updatePlayerStripeInfo(String(playerId), { isPremium: true }); } catch (error: any) { console.warn("[play/verify] cache sync failed:", error?.message || error); }
    console.log(`✅ Premium activado/restaurado para ${playerId}`);
    res.json({ isPremium: true, granted: true });
  } catch (error: any) {
    console.error("❌ Error en /verify:", error?.message || error);
    res.status(500).json({ error: "Error al verificar la suscripción" });
  }
});

router.post("/verify-pack", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) return res.status(400).json({ error: "Faltan campos obligatorios" });
    const verified = await verifyProductPurchase(String(productId), String(purchaseToken));
    if ("error" in verified) return res.status(verified.status).json({ error: verified.error });
    if (!verified.isPurchased) return res.status(400).json({ error: "Compra no válida" });
    await acknowledgeProduct(verified.productId, verified.purchaseToken, verified.acknowledgementState === 1);
    const grantResult = await grantWorldCupPack(String(playerId));
    if (!grantResult.ok) return res.status(500).json({ error: "Error al conceder los cosméticos" });
    console.log(`✅ Pack Mundial concedido a ${playerId}`);
    res.json({ granted: true, items: grantResult.granted, total: grantResult.total });
  } catch (error: any) {
    console.error("❌ Error en /verify-pack:", error?.message || error);
    res.status(500).json({ error: "Error al verificar el Pack Mundial" });
  }
});

export default router;
