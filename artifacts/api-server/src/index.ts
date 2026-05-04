import { runMigrations } from "stripe-replit-sync";
import { getStripeSync } from "./stripeClient";
import app from "./app";
import { startDailyCron } from "./lib/dailyCron";
import { db } from "@workspace/db";
import { playerScoresTable } from "@workspace/db";
import { inArray } from "drizzle-orm";

const PERMANENT_PREMIUM_IDS = [
  "google_115341741312068082096",
  "fb_10162175157238897",
];

async function ensurePermanentPremium() {
  try {
    await db
      .update(playerScoresTable)
      .set({ isPremium: true })
      .where(inArray(playerScoresTable.playerId, PERMANENT_PREMIUM_IDS));
    console.log(`[premium] Permanent premium enforced for ${PERMANENT_PREMIUM_IDS.length} accounts`);
  } catch (err: any) {
    console.error("[premium] Failed to enforce permanent premium:", err.message);
  }
}

async function initStripe() {
  const databaseUrl = process.env["DATABASE_URL"];
  if (!databaseUrl) {
    console.warn("DATABASE_URL not set — skipping Stripe initialization");
    return;
  }
  const stripeKey = process.env["STRIPE_SECRET_KEY"];
  if (!stripeKey) {
    console.warn("STRIPE_SECRET_KEY not set — skipping Stripe initialization");
    return;
  }

  try {
    console.log("Initializing Stripe schema...");
    await runMigrations({ databaseUrl } as any);
    console.log("Stripe schema ready");

    const stripeSync = await getStripeSync();

    const domains = process.env["REPLIT_DOMAINS"] || process.env["REPLIT_DEV_DOMAIN"] || "";
    const webhookHost = domains.split(",")[0];
    if (webhookHost) {
      console.log("Setting up managed Stripe webhook...");
      const webhookBaseUrl = `https://${webhookHost}`;
      await stripeSync.findOrCreateManagedWebhook(
        `${webhookBaseUrl}/api/stripe/webhook`
      );
      console.log("Stripe webhook configured");
    }

    console.log("Syncing Stripe data...");
    stripeSync
      .syncBackfill()
      .then(() => console.log("Stripe data synced"))
      .catch((err: Error) => console.error("Stripe sync error:", err.message));
  } catch (error: any) {
    console.error("Failed to initialize Stripe:", error.message);
  }
}

async function main() {
  const rawPort = process.env["PORT"];

  if (!rawPort) {
    throw new Error("PORT environment variable is required but was not provided.");
  }

  const port = Number(rawPort);

  if (Number.isNaN(port) || port <= 0) {
    throw new Error(`Invalid PORT value: "${rawPort}"`);
  }

  // Start listening immediately so the deployment platform detects the port.
  // Stripe initializes in the background — it can take several seconds.
  app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });

  startDailyCron();
  ensurePermanentPremium();

  initStripe().catch((err) => {
    console.error("Stripe init failed:", err.message);
  });
}

main().catch((err) => {
  console.error("Fatal startup error:", err);
  process.exit(1);
});
