import { isTwaInterstitialAvailable, requestInterstitialAd } from "@/lib/twaInterstitialBridge";
import { ADMOB_ADS_ENABLED } from "@/lib/admobPolicy";

const GAMES_KEY = "stop_interstitial_games_completed_v1";
const LEGACY_GAMES_KEY = "stop_games_played_v1";
const CONSUMED_KEY = "stop_interstitial_consumed_games_v2";
const LEGACY_CONSUMED_KEY = "stop_interstitial_consumed_games_v1";
const EVERY_N_GAMES = 3;

function readNumber(key: string, legacyKey?: string): number {
  try {
    const currentRaw = localStorage.getItem(key);
    const legacyRaw = legacyKey ? localStorage.getItem(legacyKey) : null;
    const current = currentRaw === null ? 0 : Number(currentRaw);
    const legacy = legacyRaw === null ? 0 : Number(legacyRaw);
    return Math.max(Number.isFinite(current) ? current : 0, Number.isFinite(legacy) ? legacy : 0);
  } catch {
    return 0;
  }
}

interface InterstitialCounterRecord { count: number; processedIds: string[]; }
function readInterstitialCounter(): InterstitialCounterRecord {
  try {
    const raw = localStorage.getItem(GAMES_KEY);
    if (!raw) return { count: readNumber(LEGACY_GAMES_KEY), processedIds: [] };
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) return {
      count: Math.max(Number.isFinite(Number(parsed.count)) ? Number(parsed.count) : 0, readNumber(LEGACY_GAMES_KEY)),
      processedIds: Array.isArray(parsed.processedIds) ? parsed.processedIds.filter((id: unknown): id is string => typeof id === "string").slice(-500) : [],
    };
    return { count: Math.max(Number.isFinite(Number(raw)) ? Number(raw) : 0, readNumber(LEGACY_GAMES_KEY)), processedIds: [] };
  } catch { return { count: 0, processedIds: [] }; }
}
export function recordInterstitialGameCompleted(gameId?: string): void {
  try {
    const current = readInterstitialCounter();
    if (gameId && current.processedIds.includes(gameId)) return;
    localStorage.setItem(GAMES_KEY, JSON.stringify({
      count: current.count + 1,
      processedIds: gameId ? [...current.processedIds, gameId].slice(-500) : current.processedIds,
    }));
  } catch {}
}

export function interstitialEligible(): boolean {
  const games = readInterstitialCounter().count;
  const consumedGames = readNumber(CONSUMED_KEY, LEGACY_CONSUMED_KEY);
  // Keep a due ad pending if the player leaves the results screen and returns
  // after starting another game; don't lose the 3-game slot on a non-multiple.
  return games - consumedGames >= EVERY_N_GAMES;
}

export function consumeInterstitialSlot(): void {
  const games = readInterstitialCounter().count;
  if (games < EVERY_N_GAMES) return;
  try { localStorage.setItem(CONSUMED_KEY, String(games)); } catch {}
}

export async function maybeShowInterstitial(isPremium: boolean): Promise<boolean> {
  if (!ADMOB_ADS_ENABLED || isPremium || !interstitialEligible() || !isTwaInterstitialAvailable()) return false;
  // Consume before launching so repeated taps/re-renders cannot trigger two ads.
  consumeInterstitialSlot();
  await requestInterstitialAd();
  return true;
}

export function getInterstitialInterval(): number {
  return EVERY_N_GAMES;
}
