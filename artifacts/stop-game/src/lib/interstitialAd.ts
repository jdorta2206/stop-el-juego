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

export function recordInterstitialGameCompleted(): void {
  const games = readNumber(GAMES_KEY);
  try { localStorage.setItem(GAMES_KEY, String(games + 1)); } catch {}
}

export function interstitialEligible(): boolean {
  const games = readNumber(GAMES_KEY);
  const consumedGames = readNumber(CONSUMED_KEY);
  // Keep a due ad pending if the player leaves the results screen and returns
  // after starting another game; don't lose the 3-game slot on a non-multiple.
  return games - consumedGames >= EVERY_N_GAMES;
}

export function consumeInterstitialSlot(): void {
  const games = readNumber(GAMES_KEY);
  if (games < EVERY_N_GAMES) return;
  try { localStorage.setItem(CONSUMED_KEY, String(games)); } catch {}
}

export async function maybeShowInterstitial(isPremium: boolean): Promise<boolean> {
  // Respect the same global AdMob pause as rewarded ads. Do not launch the
  // Android deep link or consume an interstitial slot while native ads are off.
  if (import.meta.env.VITE_REWARDED_ADS_DISABLED === "1") return false;
  if (isPremium || !interstitialEligible() || !isTwaInterstitialAvailable()) return false;
  // Consume before launching so repeated taps/re-renders cannot trigger two ads.
  consumeInterstitialSlot();
  await requestInterstitialAd();
  return true;
}

export function getInterstitialInterval(): number {
  return EVERY_N_GAMES;
}
