import { Router, Request, Response } from "express";
import { db, playerScoresTable, playPurchaseLedgerTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { grantWorldCupPack, WORLD_CUP_PACK_SKU, worldCupPackItemIds } from "../lib/worldCupPack";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router = Router();

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identity verification failed" });
    }

    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no configurado");
      return res.status(500).json({ error: "Servicio no configurado" });
    }

    const packageName = process.env.ANDROID_PACKAGE_NAME || "app.replit.stop_el_juego.twa";
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(serviceAccountJson),
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const androidPublisher = google.androidpublisher({ version: "v3", auth });

    const result = await androidPublisher.purchases.subscriptions.get({
      packageName,
      subscriptionId: productId,
      token: purchaseToken,
    });

    const purchase = result.data;
    if (!purchase || purchase.paymentState !== 1) {
      return res.status(400).json({ error: "Suscripción no válida" });
    }

    await db.update(playerScoresTable)
      .set({ isPremium: true })
      .where(eq(playerScoresTable.playerId, playerId));

    console.log(`Premium activado para ${playerId}`);
    return res.json({ isPremium: true });
  } catch (error: unknown) {
    console.error("Error en /verify:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Error al verificar la suscripción" });
  }
});

router.post("/verify-pack", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }
    if (productId !== WORLD_CUP_PACK_SKU) {
      return res.status(400).json({ error: "Producto no válido" });
    }
    if (typeof purchaseToken !== "string" || purchaseToken.length < 8 || purchaseToken.length > 4096) {
      return res.status(400).json({ error: "Token de compra no válido" });
    }
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identity verification failed" });
    }

    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.error("GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no configurado");
      return res.status(500).json({ error: "Servicio no configurado" });
    }

    const packageName = process.env.ANDROID_PACKAGE_NAME || "app.replit.stop_el_juego.twa";
    const auth = new google.auth.GoogleAuth({
      credentials: JSON.parse(serviceAccountJson),
      scopes: ["https://www.googleapis.com/auth/androidpublisher"],
    });
    const androidPublisher = google.androidpublisher({ version: "v3", auth });

    const result = await androidPublisher.purchases.products.get({
      packageName,
      productId,
      token: purchaseToken,
    });

    const purchase = result.data;
    if (!purchase || purchase.purchaseState !== 0) {
      return res.status(400).json({ error: "Compra no válida" });
    }

    // Claim the purchase token atomically before granting the pack. This makes
    // the grant durable across restarts and prevents two concurrent requests
    // from both receiving the same Google Play purchase.
    const claimed = await db.insert(playPurchaseLedgerTable).values({
      purchaseToken,
      playerId,
      productId,
    }).onConflictDoNothing().returning({ id: playPurchaseLedgerTable.id });

    if (claimed.length === 0) {
      return res.json({
        granted: true,
        alreadyProcessed: true,
        items: 0,
        total: worldCupPackItemIds().length,
      });
    }

    const grantResult = await grantWorldCupPack(playerId);
    if (!grantResult.ok) {
      // Release the claim only when the actual grant failed, allowing the
      // verified Google purchase to be retried safely.
      await db.delete(playPurchaseLedgerTable).where(eq(playPurchaseLedgerTable.id, claimed[0].id));
      console.error("Error al conceder el pack:", grantResult.error);
      return res.status(500).json({ error: "Error al conceder los cosméticos" });
    }

    console.log(`Pack Mundial concedido a ${playerId}`);
    return res.json({ granted: true, items: grantResult.granted, total: grantResult.total });
  } catch (error: unknown) {
    console.error("Error en /verify-pack:", error instanceof Error ? error.message : error);
    return res.status(500).json({ error: "Error al verificar el Pack Mundial" });
  }
});

export default router;
