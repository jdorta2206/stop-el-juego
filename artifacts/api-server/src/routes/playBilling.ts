import { Router, Request, Response } from "express";
import { db, playerScoresTable, playProductPurchasesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { grantWorldCupPack, WORLD_CUP_PACK_SKU } from "../lib/worldCupPack";
import { verifyClaimedIdentity } from "../lib/playerAuth";

const router = Router();

router.get("/status", async (req: Request, res: Response) => {
  try {
    const playerId = String(req.query.playerId || "").trim();
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }

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

router.post("/verify", async (req: Request, res: Response) => {
  try {
    const { playerId, productId, purchaseToken } = req.body;
    if (!playerId || !productId || !purchaseToken) {
      return res.status(400).json({ error: "Faltan campos obligatorios" });
    }

    if (!verifyClaimedIdentity(req, String(playerId))) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }

    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.error("❌ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no configurado");
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

    console.log(`✅ Premium activado para ${playerId}`);
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

    if (!verifyClaimedIdentity(req, String(playerId))) {
      return res.status(403).json({ error: "Identidad del jugador no válida" });
    }

    if (productId !== WORLD_CUP_PACK_SKU) {
      return res.status(400).json({ error: "Producto no válido" });
    }

    const serviceAccountJson = process.env.GOOGLE_PLAY_SERVICE_ACCOUNT_JSON;
    if (!serviceAccountJson) {
      console.error("❌ GOOGLE_PLAY_SERVICE_ACCOUNT_JSON no configurado");
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

    const [owned] = await db
      .select({ playerId: playProductPurchasesTable.playerId })
      .from(playProductPurchasesTable)
      .where(eq(playProductPurchasesTable.purchaseToken, purchaseToken))
      .limit(1);

    if (owned && owned.playerId !== playerId) {
      return res.status(403).json({ error: "Compra ya vinculada a otro jugador" });
    }

    if (!owned) {
      await db.insert(playProductPurchasesTable).values({
        playerId,
        productId,
        purchaseToken,
        orderId: purchase.orderId ?? null,
        purchaseState: purchase.purchaseState ?? 0,
        rawJson: JSON.stringify(purchase),
      }).onConflictDoNothing({ target: playProductPurchasesTable.purchaseToken });

      const [afterInsert] = await db
        .select({ playerId: playProductPurchasesTable.playerId })
        .from(playProductPurchasesTable)
        .where(eq(playProductPurchasesTable.purchaseToken, purchaseToken))
        .limit(1);

      if (!afterInsert || afterInsert.playerId !== playerId) {
        return res.status(403).json({ error: "Compra ya vinculada a otro jugador" });
      }
    }

    const grantResult = await grantWorldCupPack(playerId);
    if (!grantResult.ok) {
      console.error("❌ Error al conceder el pack:", grantResult.error);
      return res.status(500).json({ error: "Error al conceder los cosméticos" });
    }

    console.log(`✅ Pack Mundial concedido a ${playerId}`);
    return res.json({ granted: true, items: grantResult.granted, total: grantResult.total });
  } catch (error: any) {
    console.error("❌ Error en /verify-pack:", error.message);
    return res.status(500).json({ error: "Error al verificar el Pack Mundial" });
  }
});

export default router;
