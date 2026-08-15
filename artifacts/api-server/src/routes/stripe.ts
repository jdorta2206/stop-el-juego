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

const APP_ORIGIN = process.env["APP_ORIGIN"] || "https://stop-el-juego.replit.app";

router.get("/status", async (req, res) => {
  try {
    const { playerId } = req.query as { playerId?: string };
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    if (!verifyClaimedIdentity(req, playerId)) {
      return res.status(403).json({ error: "Identity verification failed" });
    }

    const player = await stripeStorage.getPlayer(playerId);
    if (!player) return res.json({ isPremium: false });

    let premium = false;
    if (player.stripeCustomerId) {
      const activeSub = await stripeStorage.getActiveSubscriptionByCustomerId(player.stripeCustomerId);
      premium = !!activeSub;
    }
    if (premium !== player.isPremium) {
      await stripeStorage.updatePlayerStripeInfo(playerId, { isPremium: premium });
    }

    // Never expose Stripe customer identifiers to the browser.
    return res.json({ isPremium: premium });
  } catch (err: unknown) {
    console.error("stripe/status error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/products", async (_req, res) => {
  try {
    const stripe = await getUncachableStripeClient();
    const productsRes = await stripe.products.list({ active: true, limit: 20 });
    const pricesRes = await stripe.prices.list({ active: true, limit: 100 });

    const pricesByProduct = new Map<string, Array<{
      id: string;
      unit_amount: number | null;
      currency: string;
      recurring: { interval: string; interval_count: number } | null;
      active: boolean;
    }>>();
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
        prices: (pricesByProduct.get(p.id) || []).sort((a, b) => (a.unit_amount ?? 0) - (b.unit_amount ?? 0)),
      }));
    return res.json({ data });
  } catch (err: unknown) {
    console.error("stripe/products error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/checkout", async (req, res) => {
  try {
    const { playerId, playerName, email, priceId } = req.body as {
      playerId?: string;
      playerName?: string;
      email?: string;
      priceId?: string;
    };
    if (!playerId || !priceId) return res.status(400).json({ error: "playerId and priceId required" });
    if (!verifyClaimedIdentity(req, playerId)) return res.status(403).json({ error: "Identity verification failed" });

    let player = await stripeStorage.getPlayer(playerId);
    let customerId = player?.stripeCustomerId || null;
    if (!customerId) {
      const customer = await stripeService.createCustomer(email || `${playerId}@stop-game.app`, playerId);
      customerId = customer.id;
      await stripeStorage.updatePlayerStripeInfo(playerId, { stripeCustomerId: customerId });
    }

    const session = await stripeService.createCheckoutSession(
      customerId,
      priceId,
      `${APP_ORIGIN}/?premium=success`,
      `${APP_ORIGIN}/?premium=cancel`,
    );
    return res.json({ url: session.url });
  } catch (err: unknown) {
    console.error("stripe/checkout error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/checkout-pack", async (req, res) => {
  try {
    const { playerId, email, sku } = req.body as { playerId?: string; email?: string; sku?: string };
    if (!playerId || !sku) return res.status(400).json({ error: "playerId and sku required" });
    if (sku !== WORLD_CUP_PACK_SKU) return res.status(400).json({ error: "Unknown pack" });
    if (!verifyClaimedIdentity(req, playerId)) return res.status(403).json({ error: "Identity verification failed" });

    const player = await stripeStorage.getPlayer(playerId);
    let customerId = player?.stripeCustomerId || null;
    let validCustomerId: string | undefined;
    if (customerId) {
      try {
        const stripe = await getUncachableStripeClient();
        const customer = await stripe.customers.retrieve(customerId);
        if (customer && !customer.deleted) validCustomerId = customerId;
        else customerId = null;
      } catch (error: unknown) {
        console.warn(`Invalid Stripe customer ${customerId}: ${error instanceof Error ? error.message : String(error)}. Creating new customer.`);
        customerId = null;
      }
    }

    if (!customerId) {
      const customer = await stripeService.createCustomer(email || `${playerId}@stop-game.app`, playerId);
      customerId = customer.id;
      validCustomerId = customerId;
      await stripeStorage.updatePlayerStripeInfo(playerId, { stripeCustomerId: customerId });
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
      `${APP_ORIGIN}/?pack=cancel`,
    );
    return res.json({ url: session.url });
  } catch (err: unknown) {
    console.error("stripe/checkout-pack error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/claim-pack", async (req, res) => {
  try {
    const { playerId, sessionId } = req.body as { playerId?: string; sessionId?: string };
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    if (!verifyClaimedIdentity(req, playerId)) return res.status(403).json({ error: "Identity verification failed" });

    const stripe = await getUncachableStripeClient();
    const player = await stripeStorage.getPlayer(playerId);
    const customerId = player?.stripeCustomerId || null;

    let paid = false;
    if (sessionId) {
      const session = await stripe.checkout.sessions.retrieve(sessionId);
      const sessionCustomer = typeof session.customer === "string" ? session.customer : session.customer?.id ?? null;
      paid = session.mode === "payment" &&
        session.payment_status === "paid" &&
        session.metadata?.["sku"] === WORLD_CUP_PACK_SKU &&
        session.metadata?.["playerId"] === playerId &&
        (!customerId || sessionCustomer === customerId);
    } else if (customerId) {
      const sessions = await stripe.checkout.sessions.list({ customer: customerId, limit: 30 });
      paid = sessions.data.some((s) =>
        s.mode === "payment" &&
        s.payment_status === "paid" &&
        s.metadata?.["sku"] === WORLD_CUP_PACK_SKU &&
        s.metadata?.["playerId"] === playerId,
      );
    }

    if (!paid) return res.json({ granted: false });
    const r = await grantWorldCupPack(playerId);
    if (!r.ok) return res.status(r.status).json({ error: r.error });
    return res.json({ granted: true, items: r.granted, total: r.total });
  } catch (err: unknown) {
    console.error("stripe/claim-pack error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/portal", async (req, res) => {
  try {
    const { playerId } = req.body as { playerId?: string };
    if (!playerId) return res.status(400).json({ error: "playerId required" });
    if (!verifyClaimedIdentity(req, playerId)) return res.status(403).json({ error: "Identity verification failed" });

    const player = await stripeStorage.getPlayer(playerId);
    if (!player?.stripeCustomerId) return res.status(404).json({ error: "No customer found for this player" });

    const portalSession = await stripeService.createCustomerPortalSession(player.stripeCustomerId, `${APP_ORIGIN}/`);
    return res.json({ url: portalSession.url });
  } catch (err: unknown) {
    console.error("stripe/portal error:", err instanceof Error ? err.message : String(err));
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
