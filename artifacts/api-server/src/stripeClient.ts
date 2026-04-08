import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

let stripeSyncInstance: StripeSync | null = null;
let stripeClientInstance: Stripe | null = null;

function getStripeSecretKey(): string {
  const key = process.env["STRIPE_SECRET_KEY"];
  if (!key) throw new Error("STRIPE_SECRET_KEY environment variable is required");
  return key;
}

export async function getStripeSync(): Promise<StripeSync> {
  if (!stripeSyncInstance) {
    const databaseUrl = process.env["DATABASE_URL"];
    if (!databaseUrl) throw new Error("DATABASE_URL is required for Stripe sync");

    stripeSyncInstance = new StripeSync({
      stripeSecretKey: getStripeSecretKey(),
      databaseUrl,
      schema: "stripe",
    });
  }
  return stripeSyncInstance;
}

export async function getUncachableStripeClient(): Promise<Stripe> {
  if (!stripeClientInstance) {
    stripeClientInstance = new Stripe(getStripeSecretKey(), {
      apiVersion: "2026-02-25.clover",
    });
  }
  return stripeClientInstance;
}
