import { Router, Request, Response } from "express";
import { db, playerScoresTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { grantWorldCupPack } from "../lib/worldCupPack";

const router = Router();

router.get("/status", async (req: Request, res: Response) => {
  try {
    const playerId = String(req.query.playerId || "").trim();
    if (!playerId) return res.status(400).json({ error: "Falta playerId", isPremium: false });
    const rows = await db.select({ isPremium: playerScoresTable.isPremium }).from(playerScoresTable).where(eq(playerScoresTable.playerId, playerId)).limit(1);
    res.json({ isPremium: rows[0]?.isPremium === true });
  } catch (error: any) {
    console.error("❌ Error en /play/status:", error?.message || error);
    res.status(500).json({ error: "No se pudo consultar Premium", isPremium: false });
  }
});

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) return res.status(400).json({ error: "Faltan campos obligatorios" });
    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) return res.status(500).json({ error: "Servicio no configurado" });
    const packageName = process.env.ANDROID_PACKAGE_NAME || "app.replit.stop_el_juego.twa";
    const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(serviceAccountJson), scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
    const androidPublisher = google.androidpublisher({ version: "v3", auth });
    const result = await androidPublisher.purchases.subscriptions.get({ packageName, subscriptionId: productId, token: purchaseToken });
    const purchase = result.data;
    if (!purchase || purchase.paymentState !== 1) return res.status(400).json({ error: "Suscripción no válida" });
    await db.update(playerScoresTable).set({ isPremium: true }).where(eq(playerScoresTable.playerId, playerId));
    console.log(`✅ Premium activado para ${playerId}`);
    res.json({ isPremium: true, granted: true });
  } catch (error: any) {
    console.error("❌ Error en /verify:", error.message);
    res.status(500).json({ error: "Error al verificar la suscripción" });
  }
});

router.post("/verify-pack", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) return res.status(400).json({ error: "Faltan campos obligatorios" });
    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) return res.status(500).json({ error: "Servicio no configurado" });
    const packageName = process.env.ANDROID_PACKAGE_NAME || "app.replit.stop_el_juego.twa";
    const auth = new google.auth.GoogleAuth({ credentials: JSON.parse(serviceAccountJson), scopes: ["https://www.googleapis.com/auth/androidpublisher"] });
    const androidPublisher = google.androidpublisher({ version: "v3", auth });
    const result = await androidPublisher.purchases.products.get({ packageName, productId, token: purchaseToken });
    const purchase = result.data;
    if (!purchase || purchase.purchaseState !== 0) return res.status(400).json({ error: "Compra no válida" });
    const grantResult = await grantWorldCupPack(playerId);
    if (!grantResult.ok) return res.status(500).json({ error: "Error al conceder los cosméticos" });
    console.log(`✅ Pack Mundial concedido a ${playerId}`);
    res.json({ granted: true, items: grantResult.granted, total: grantResult.total });
  } catch (error: any) {
    console.error("❌ Error en /verify-pack:", error.message);
    res.status(500).json({ error: "Error al verificar el Pack Mundial" });
  }
});

export default router;
