import { useCallback, useEffect, useRef, useState } from "react";

/**
 * useRewardedAd — Rewarded video ad hook (stub-ready for Google Ad Manager H5).
 *
 * Current state: STUB. There is no live H5 rewarded inventory yet because
 * Google Ad Manager H5 Games access has been requested but not granted (see
 * the email sent to h5support@google.com on 2026-05-28). Until access is
 * granted, `showRewardedAd()` resolves with `{ rewarded: true, source: "stub" }`
 * after a short delay so the rest of the game can use the hook end-to-end
 * (loading state, callbacks, analytics) without conditionals.
 *
 * When access is granted, replace the body of `showRewardedAd` with the real
 * googletag GPT call — see https://developers.google.com/ad-manager/mobile-ads-sdk/web-games
 * — and keep this hook's public API identical. Everything downstream (SoloGame
 * triggers, reward dispatch, UI) will keep working.
 *
 * Public API (frozen):
 *   const { ready, loading, error, showRewardedAd } = useRewardedAd();
 *   const result = await showRewardedAd({ placement: "extra_time" });
 *   if (result.rewarded) grantReward();
 *
 * `placement` is a free-form tag for analytics ("extra_time", "hint",
 * "double_points", "skip_round"). It will become the ad slot key once real
 * inventory is configured in Ad Manager.
 */

export type RewardedPlacement =
  | "extra_time"
  | "hint"
  | "double_points"
  | "skip_round"
  | "extra_pack";

export interface RewardedAdResult {
  rewarded: boolean;
  source: "stub" | "h5" | "skipped" | "error";
  placement: RewardedPlacement;
}

export interface UseRewardedAdReturn {
  /** True once the underlying SDK is initialised and an ad can be requested. */
  ready: boolean;
  /** True while a `showRewardedAd()` call is in flight. */
  loading: boolean;
  /** Last error from a failed `showRewardedAd()` call, or null. */
  error: string | null;
  /**
   * Show a rewarded video. Resolves with whether the user earned the reward.
   * Caller is responsible for granting the reward when `rewarded === true`.
   */
  showRewardedAd: (opts: { placement: RewardedPlacement }) => Promise<RewardedAdResult>;
}

const STUB_DURATION_MS = 1200;

declare global {
  interface Window {
    /** Will be set to the googletag namespace when GPT is loaded. */
    googletag?: unknown;
  }
}

export function useRewardedAd(): UseRewardedAdReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    // Stub readiness: simulate "SDK initialised" immediately. When wiring the
    // real H5 SDK, replace this with an effect that waits for googletag to be
    // loaded and the rewarded slot to be defined.
    setReady(true);
    return () => { mounted.current = false; };
  }, []);

  const showRewardedAd = useCallback<UseRewardedAdReturn["showRewardedAd"]>(
    async ({ placement }) => {
      setLoading(true);
      setError(null);

      // Stub path. The real H5 implementation will look roughly like:
      //
      //   return new Promise((resolve) => {
      //     googletag.cmd.push(() => {
      //       const slot = googletag.defineOutOfPageSlot(
      //         AD_UNIT_PATH, googletag.enums.OutOfPageFormat.REWARDED
      //       );
      //       if (!slot) return resolve({ rewarded: false, source: "error", placement });
      //       slot.addService(googletag.pubads());
      //       googletag.pubads().addEventListener("rewardedSlotGranted", () => {
      //         resolve({ rewarded: true, source: "h5", placement });
      //       });
      //       googletag.pubads().addEventListener("rewardedSlotClosed", () => {
      //         resolve({ rewarded: false, source: "skipped", placement });
      //       });
      //       googletag.enableServices();
      //       googletag.display(slot);
      //     });
      //   });
      try {
        await new Promise((r) => setTimeout(r, STUB_DURATION_MS));
        if (!mounted.current) {
          return { rewarded: false, source: "skipped" as const, placement };
        }
        return { rewarded: true, source: "stub" as const, placement };
      } catch (e: any) {
        const msg = e?.message ?? "unknown";
        setError(msg);
        return { rewarded: false, source: "error" as const, placement };
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [],
  );

  return { ready, loading, error, showRewardedAd };
}
