import { stripeStorage } from "./stripeStorage";
import { getUncachableStripeClient } from "./stripeClient";

export class StripeService {
  async createCustomer(email: string, playerId: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.customers.create({
      email,
      metadata: { playerId },
    });
  }

  async createCheckoutSession(
    customerId: string,
    priceId: string,
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      // Omitting payment_method_types → Stripe auto-enables Google Pay,
      // Apple Pay, cards, and any method configured in the Dashboard
      line_items: [{ price: priceId, quantity: 1 }],
      mode: "subscription",
      // 7-day free trial. Subscription is created in `trialing` status
      // and transitions to `active` after the trial; cancellation during
      // the trial avoids any charge. Premium-status reads must include
      // `trialing` (see stripeStorage.getActiveSubscriptionByCustomerId).
      subscription_data: { trial_period_days: 7 },
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  // One-time payment session (mode: "payment") for the World Cup pack.
  // Uses an inline `price_data` so we don't need a pre-created Stripe
  // product/price — the amount lives in code (worldCupPack.ts). Metadata is
  // mirrored onto the PaymentIntent so the claim endpoint can identify the
  // purchase from either object.
  async createPackCheckoutSession(
    customerId: string,
    opts: {
      name: string;
      amountCents: number;
      currency: string;
      metadata: Record<string, string>;
    },
    successUrl: string,
    cancelUrl: string
  ) {
    const stripe = await getUncachableStripeClient();
    return await stripe.checkout.sessions.create({
      customer: customerId,
      line_items: [
        {
          price_data: {
            currency: opts.currency,
            unit_amount: opts.amountCents,
            product_data: { name: opts.name },
          },
          quantity: 1,
        },
      ],
      mode: "payment",
      payment_intent_data: { metadata: opts.metadata },
      metadata: opts.metadata,
      success_url: successUrl,
      cancel_url: cancelUrl,
    });
  }

  async createCustomerPortalSession(customerId: string, returnUrl: string) {
    const stripe = await getUncachableStripeClient();
    return await stripe.billingPortal.sessions.create({
      customer: customerId,
      return_url: returnUrl,
    });
  }

  async getSubscription(subscriptionId: string) {
    return await stripeStorage.getSubscription(subscriptionId);
  }
}

export const stripeService = new StripeService();
