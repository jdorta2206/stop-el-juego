import Stripe from "stripe";
import { StripeSync } from "stripe-replit-sync";

let stripeSyncInstance: StripeSync | null = null;
let stripeClientInstance: Stripe | null = null;
let stripeReady = false;

export function isStripeReady(): boolean {
  return stripeReady;
}

export function markStripeReady(): void {
  stripeReady = true;
}

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
      // Newer stripe-replit-sync requires `poolConfig` (the legacy
      // `databaseUrl` / `schema` options were dropped).
      poolConfig: { connectionString: databaseUrl },
      // Always refetch subscriptions from Stripe before persisting webhook
      // state. stripe-replit-sync@1.0.0 protects rows using the webhook
      // event timestamp; two lifecycle events can legitimately share the
      // same timestamp, causing the later state to be ignored. Refetching
      // gives each event a fresh sync timestamp and the current Stripe state.
      revalidateObjectsViaStripeApi: ["subscription"],
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
