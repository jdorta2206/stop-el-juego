import { stripeStorage } from "../stripeStorage";
import { getActivePlaySubscriptionForPlayer } from "./playBillingService";

// Unified premium check across Stripe (web) and Google Play (TWA). A player
// is premium if EITHER channel has an active subscription. Order: Stripe
// first because the lookup is a single indexed query on a customer id we
// already hold; Play is a fall-through.
export async function isUserPremium(playerId: string): Promise<boolean> {
  const player = await stripeStorage.getPlayer(playerId);
  if (player?.stripeCustomerId) {
    const stripeActive = await stripeStorage.getActiveSubscriptionByCustomerId(
      player.stripeCustomerId,
    );
    if (stripeActive) return true;
  }
  const playActive = await getActivePlaySubscriptionForPlayer(playerId);
  return playActive !== null;
}
