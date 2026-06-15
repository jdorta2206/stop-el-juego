import { Router, type IRouter } from "express";
import { stripeStorage } from "../stripeStorage";
import { stripeService } from "../stripeService";
import { getUncachableStripeClient } from "../stripeClient";
import { verifyClaimedIdentity } from "../lib/playerAuth";
import {
  WORLD_CUP_PACK_SKU,
  WORLD_CUP_PACK_PRICE_CENTS,
  WORLD_CUP_PACK_CURRENCY,
  WORLD_CUP_PACK_NAME,
  grantWorldCupPack,
} from "../lib/worldCupPack";

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

    // Premium is granted EXCLUSIVELY by an active Stripe subscription.
    // No Stripe customer → cannot be premium, regardless of any stale DB flag.
    let premium = false;
    if (player.stripeCustomerId) {
      const activeSub = await stripeStorage.getActiveSubscriptionByCustomerId(
        player.stripeCustomerId
      );
      premium = !!activeSub;
    }
    // Self-heal: if the DB row disagrees with the Stripe truth, fix it.
    if (premium !== player.isPremium) {
      await stripeStorage.updatePlayerStripeInfo(playerId, { isPremium: premium });
    }

    return res.json({ isPremium: premium, stripeCustomerId: player.stripeCustomerId || null });
  } catch (err: any) {
    console.error("stripe/status error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// GET /api/stripe/products
// Returns active products with their prices — reads directly from Stripe API
router.get("/products", async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();

    // Fetch active products from Stripe
    const productsRes = await stripe.products.list({ active: true, limit: 20 });
    const pricesRes = await stripe.prices.list({ active: true, limit: 100 });

    const pricesByProduct = new Map<string, any[]>();
    for (const price of pricesRes.data) {
      const productId = typeof price.product === "string" ? price.product : price.product.id;
      if (!pricesByProduct.has(productId)) pricesByProduct.set(productId, []);
      pricesByProduct.get(productId)!.push({
        id: price.id,
        unit_amount: price.unit_amount,
        currency: price.currency,
        recurring: price.recurring
          ? { interval: price.recurring.interval, interval_count: price.recurring.interval_count }
          : null,
        active: price.active,
      });
    }

    const data = productsRes.data
      .filter((p) => pricesByProduct.has(p.id))
      .map((p) => ({
        id: p.id,
        name: p.name,
        description: p.description,
        active: p.active,
        prices: (pricesByProduct.get(p.id) || []).sort(
          (a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0)
        ),
      }));

    return res.json({ data });
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
    // 🔒 A logged-in account can only check out for ITSELF — blocks anyone from
    // creating a Stripe session against another player's id (which is public).
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identity verification failed" });
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

// POST /api/stripe/checkout-pack
// Body: { playerId, email?, sku }
// One-time payment for the World Cup pack. Same auth + customer plumbing as
// the subscription checkout, but mode:"payment" with an inline price.
router.post("/checkout-pack", async (req, res) => {
  try {
    const { playerId, email, sku } = req.body as {
      playerId: string;
      email?: string;
      sku: string;
    };
    if (!playerId || !sku) {
      return res.status(400).json({ error: "playerId and sku required" });
    }
    if (sku !== WORLD_CUP_PACK_SKU) {
      return res.status(400).json({ error: "Unknown pack" });
    }
    // 🔒 A logged-in account can only check out for ITSELF.
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identity verification failed" });
    }

    const player = await stripeStorage.getPlayer(playerId);
    let customerId = player?.stripeCustomerId || null;
    
    // ============================================================
    // VALIDAR QUE EL CUSTOMER EXISTA EN STRIPE
    // ============================================================
    let validCustomerId: string | undefined;
    if (customerId) {
      try {
        const stripe = await getUncachableStripeClient();
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted) {
          validCustomerId = customerId;
          console.log(`Customer ${customerId} validated successfully`);
        } else {
          console.warn(`Customer ${customerId} is deleted, will create new one`);
          customerId = null;
        }
      } catch (error: any) {
        console.warn(`Invalid Stripe customer ${customerId}: ${error.message}. Creating new customer.`);
        customerId = null;
      }
    }

    // Si no hay customer válido, crear uno nuevo
    if (!customerId) {
      const customer = await stripeService.createCustomer(
        email || `${playerId}@stop-game.app`,
        playerId
      );
      customerId = customer.id;
      validCustomerId = customerId;
      await stripeStorage.updatePlayerStripeInfo(playerId, {
        stripeCustomerId: customerId,
      });
      console.log(`Created new customer ${customerId} for player ${playerId}`);
    }

    const session = await stripeService.createPackCheckoutSession(
      validCustomerId || customerId,
      {
        name: WORLD_CUP_PACK_NAME,
        amountCents: WORLD_CUP_PACK_PRICE_CENTS,
        currency: WORLD_CUP_PACK_CURRENCY,
        metadata: { playerId, sku },
      },
      `${APP_ORIGIN}/?pack=success&session_id={CHECKOUT_SESSION_ID}`,
      `${APP_ORIGIN}/?pack=cancel`
    );

    return res.json({ url: session.url });
  } catch (err: any) {
    console.error("stripe/checkout-pack error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stripe/claim-pack
// Body: { playerId, sessionId? }
// Self-healing grant: confirms a genuine paid pack purchase against Stripe
// (the source of truth, like /status) and then grants the cosmetics. Safe to
// call repeatedly — grantWorldCupPack is idempotent.
router.post("/claim-pack", async (req, res) => {
  try {
    const { playerId, sessionId } = req.body as {
      playerId: string;
      sessionId?: string;
    };
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identity verification failed" });
    }

    const stripe = await getUncachableStripeClient();
    const player = await stripeStorage.getPlayer(playerId);
    const customerId = player?.stripeCustomerId || null;

    let paid = false;
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const sessionCustomer =
        typeof session.customer === "string"
          ? session.customer
          : session.customer?.id ?? null;
      // Bind the session to THIS player (metadata.playerId) and require it to
      // be a paid one-time pack session. The customer match is an extra guard
      // when we already know the player's customer id.
      paid =
        session.mode === "payment" &&
        session.payment_status === "paid" &&
        session.metadata?.["sku"] === WORLD_CUP_PACK_SKU &&
        session.metadata?.["playerId"] === playerId &&
        (!customerId || sessionCustomer === customerId);
    } else if (customerId) {
      // Fallback when the session_id was lost (e.g. user reopened the app):
      // scan this customer's recent sessions for a paid pack purchase.
      const sessions = await stripe.checkout.sessions.list({
        customer: customerId,
        limit: 30,
      });
      paid = sessions.data.some(
        (s) =>
          s.mode === "payment" &&
          s.payment_status === "paid" &&
          s.metadata?.["sku"] === WORLD_CUP_PACK_SKU
      );
    }

    if (!paid) return res.json({ granted: false });

    const r = await grantWorldCupPack(playerId);
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    return res.json({ granted: true, items: r.granted, total: r.total });
  } catch (err: any) {
    console.error("stripe/claim-pack error:", err.message);
    return res.status(500).json({ error: "Internal server error" });
  }
});

// POST /api/stripe/portal
// Body: { playerId }
router.post("/portal", async (req, res) => {
  try {
    const { playerId } = req.body as { playerId: string };
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    // 🔒 Critical IDOR fix: only the authenticated owner can open the billing
    // portal for their id — otherwise anyone could cancel another user's sub.
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identity verification failed" });
    }

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
