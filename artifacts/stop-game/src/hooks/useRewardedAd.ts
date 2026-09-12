import { useCallback, useEffect, useRef, useState } from "react";
import { initTwaAdBridge, isTwaAdBridgeAvailable, requestRewardedAd } from "@/lib/twaAdBridge";

export type RewardedPlacement =
  | "extra_time"
  | "hint"
  | "double_points"
  | "skip_round"
  | "extra_pack";

export interface RewardedAdResult {
  rewarded: boolean;
  source: "admob" | "skipped" | "error";
  placement: RewardedPlacement;
}

export interface UseRewardedAdReturn {
  ready: boolean;
  loading: boolean;
  error: string | null;
  showRewardedAd: (opts: { placement: RewardedPlacement }) => Promise<RewardedAdResult>;
}

export function useRewardedAd(): UseRewardedAdReturn {
  const [ready, setReady] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    initTwaAdBridge();
    setReady(isTwaAdBridgeAvailable());
    const timer = window.setInterval(() => setReady(isTwaAdBridgeAvailable()), 500);
    return () => {
      mounted.current = false;
      window.clearInterval(timer);
    };
  }, []);

  const showRewardedAd = useCallback<UseRewardedAdReturn["showRewardedAd"]>(
    async ({ placement }) => {
      setLoading(true);
      setError(null);
      try {
        const result = await requestRewardedAd(placement);
        if (!mounted.current) return { rewarded: false, source: "skipped", placement };
        if (!result.rewarded) setError("Rewarded ad was not completed");
        return { rewarded: result.rewarded, source: result.source, placement };
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Rewarded ad failed";
        if (mounted.current) setError(msg);
        return { rewarded: false, source: "error", placement };
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [],
  );

  return { ready, loading, error, showRewardedAd };
}
