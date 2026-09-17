import { useEffect } from "react";
import { BannerAd as FixedBannerAd, RewardedAd as FixedRewardedAd } from "./AdSystemFixed";
import { installTimerPauseGuard, pauseGameTimer, resumeGameTimer } from "@/lib/timerPauseGuard";

// The SoloGame countdown is a browser interval. Rewarded ads must pause that
// countdown for the entire lifetime of the rewarded-ad UI/native activity.
installTimerPauseGuard();

export function BannerAd(props: { className?: string }) {
  return <FixedBannerAd {...props} />;
}

export function RewardedAd(props: React.ComponentProps<typeof FixedRewardedAd>) {
  useEffect(() => {
    pauseGameTimer();
    return () => resumeGameTimer();
  }, []);

  return <FixedRewardedAd {...props} />;
}
