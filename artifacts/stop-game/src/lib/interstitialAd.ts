import { isTwaInterstitialAvailable, requestInterstitialAd } from "@/lib/twaInterstitialBridge";

const GAMES_KEY = "stop_games_played_v1";
const CONSUMED_KEY = "stop_interstitial_consumed_games_v1";
const EVERY_N_GAMES = 3;

function readNumber(key: string): number {
  try {
    const value = Number(localStorage.getItem(key));
    return Number.isFinite(value) ? value : 0;
  } catch {
    return 0;
  }
}

export function interstitialEligible(): boolean {
  const games = readNumber(GAMES_KEY);
  if (games < EVERY_N_GAMES || games % EVERY_N_GAMES !== 0) return false;
  return readNumber(CONSUMED_KEY) !== games;
}

export function consumeInterstitialSlot(): void {
  const games = readNumber(GAMES_KEY);
  if (games < EVERY_N_GAMES) return;
  try { localStorage.setItem(CONSUMED_KEY, String(games)); } catch {}
}

export async function maybeShowInterstitial(isPremium: boolean): Promise<boolean> {
  if (isPremium || !interstitialEligible() || !isTwaInterstitialAvailable()) return false;
  // Consume before launching so repeated taps/re-renders cannot trigger two ads.
  consumeInterstitialSlot();
  await requestInterstitialAd();
  return true;
}

export function getInterstitialInterval(): number {
  return EVERY_N_GAMES;
}
