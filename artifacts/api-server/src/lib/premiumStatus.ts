import { stripeStorage } from "../stripeStorage";
import { getActivePlaySubscriptionForPlayer } from "./playBillingService";

const SLOW_PREMIUM_PHASE_MS = 150;

function logSlowPremiumPhase(phase: string, startedAt: number): void {
  const elapsedMs = Date.now() - startedAt;
  if (elapsedMs >= SLOW_PREMIUM_PHASE_MS) {
    // Deliberately log phase and duration only: never player IDs or billing data.
    console.warn("[perf] billing.premium.entitlement", JSON.stringify({ phase, elapsedMs }));
  }
}

// Unified premium check across Stripe (web) and Google Play (TWA). A player
// is premium if EITHER channel has an active subscription. Order: Stripe
// first because the lookup is a single indexed query on a customer id we
// already hold; Play is a fall-through.
export async function isUserPremium(playerId: string): Promise<boolean> {
  let phaseStartedAt = Date.now();
  const player = await stripeStorage.getPlayer(playerId);
  logSlowPremiumPhase("player_lookup", phaseStartedAt);

  if (player?.stripeCustomerId) {
    phaseStartedAt = Date.now();
    const stripeActive = await stripeStorage.getActiveSubscriptionByCustomerId(
      player.stripeCustomerId,
    );
    logSlowPremiumPhase("stripe_subscription_lookup", phaseStartedAt);
    if (stripeActive) return true;
  }

  phaseStartedAt = Date.now();
  const playActive = await getActivePlaySubscriptionForPlayer(playerId);
  logSlowPremiumPhase("play_subscription_lookup", phaseStartedAt);
  return playActive !== null;
}
