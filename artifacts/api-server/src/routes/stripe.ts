import { Router, type IRouter } from "express";
import { stripeStorage } from "../stripeStorage";
import { stripeService } from "../stripeService";

const router: IRouter = Router();

const APP_ORIGIN =
  process.env["APP_ORIGIN"] ||
  "https://stop-el-juego.replit.app";

// GET /api/stripe/status?playerId=xxx
// Returns whether the player has an active premium subscription
router.get("/status", async (req, res) => {
  try {
    const { playerId } = req.query as { playerId?: string };
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    const player = await stripeStorage.getPlayer(playerId);
    if (!player) return res.json({ isPremium: false });

    // Verify subscription is still active in stripe.subscriptions table
    let isPremium = player.isPremium || false;
    if (player.stripeCustomerId) {
      const activeSub = await stripeStorage.getActiveSubscriptionByCustomerId(
        player.stripeCustomerId
      );
      isPremium = !!activeSub;
      // Sync isPremium flag if it changed
      if (isPremium !== player.isPremium) {
        await stripeStorage.updatePlayerStripeInfo(playerId, { isPremium });
      }
    }

    return res.json({ isPremium, stripeCustomerId: player.stripeCustomerId || null });
  } catch (err: any) {
    console.error("stripe/status error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stripe/products
// Returns active products with their prices
router.get("/products", async (_req, res) => {
  try {
    const rows = await stripeStorage.listProductsWithPrices();

    const productsMap = new Map<string, any>();
    for (const row of rows) {
      if (!productsMap.has(row.product_id as string)) {
        productsMap.set(row.product_id as string, {
          id: row.product_id,
          name: row.product_name,
          description: row.product_description,
          active: row.product_active,
          prices: [],
        });
      }
      if (row.price_id) {
        productsMap.get(row.product_id as string).prices.push({
          id: row.price_id,
          unit_amount: row.unit_amount,
          currency: row.currency,
          recurring: row.recurring,
          active: row.price_active,
        });
      }
    }

    return res.json({ data: Array.from(productsMap.values()) });
  } catch (err: any) {
    console.error("stripe/products error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stripe/checkout
// Body: { playerId, playerName, email?, priceId }
router.post("/checkout", async (req, res) => {
  try {
    const { playerId, playerName, email, priceId } = req.body as {
      playerId: string;
      playerName: string;
      email?: string;
      priceId: string;
    };

    if (!playerId || !priceId) {
      return res.status(400).json({ error: "playerId and priceId required" });
    }

    let player = await stripeStorage.getPlayer(playerId);
    let customerId = player?.stripeCustomerId || null;

    if (!customerId) {
      const customer = await stripeService.createCustomer(
        email || `${playerId}@stop-game.app`,
        playerId
      );
      customerId = customer.id;
      await stripeStorage.updatePlayerStripeInfo(playerId, {
        stripeCustomerId: customerId,
      });
    }

    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${APP_ORIGIN}/?premium=success`,
      `${APP_ORIGIN}/?premium=cancel`
    );

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("stripe/checkout error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stripe/portal
// Body: { playerId }
router.post("/portal", async (req, res) => {
  try {
    const { playerId } = req.body as { playerId: string };
    if (!playerId) return res.status(400).json({ error: "playerId required" });

    const player = await stripeStorage.getPlayer(playerId);
    if (!player?.stripeCustomerId) {
      return res.status(404).json({ error: "No customer found for this player" });
    }

    const portalSession = await stripeService.createCustomerPortalSession(
      player.stripeCustomerId,
      `${APP_ORIGIN}/`
    );

    return res.json({ url: portalSession.url });
  } catch (err: any) {
    console.error("stripe/portal error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
