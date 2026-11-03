import { useEffect, useRef, useState } from "react";
import { Gift, Star, Zap } from "lucide-react";
import { getT } from "@/i18n/index";
import { hasAndroidAppReferrer } from "@/lib/playBilling";
import { initTwaAdBridge, isTwaAdBridgeAvailable, requestRewardedAd, setRewardedAdPlayerId } from "@/lib/twaAdBridge";
import { pauseGameTimer, resumeGameTimer } from "@/lib/timerPauseGuard";
import { trackAnalyticsEvent } from "@/lib/analyticsClient";

const GAME_TIMER_PAUSE_EVENT = "stop:rewarded-ad-pause";
const GAME_TIMER_RESUME_EVENT = "stop:rewarded-ad-resume";

function pushAd() {
  try {
    const win = window as any;
    win.adsbygoogle = win.adsbygoogle || [];
    win.adsbygoogle.push({});
  } catch {}
}

function AdsterraSlot({ adKey, width, height }: { adKey: string; width: number; height: number }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [filled, setFilled] = useState(false);
  useEffect(() => {
    const el = containerRef.current;
    if (!el || el.dataset.adInjected === "1") return;
    el.dataset.adInjected = "1";
    const cfg = document.createElement("script");
    cfg.type = "text/javascript";
    cfg.text = `atOptions = { 'key' : '${adKey}', 'format' : 'iframe', 'height' : ${height}, 'width' : ${width}, 'params' : {} };`;
    el.appendChild(cfg);
    const loader = document.createElement("script");
    loader.type = "text/javascript";
    loader.src = `https://www.highperformanceformat.com/${adKey}/invoke.js`;
    loader.async = true;
    loader.onerror = () => setFilled(false);
    el.appendChild(loader);
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (!el.isConnected) return window.clearInterval(timer);
      if (el.querySelector("iframe")) { setFilled(true); window.clearInterval(timer); }
      else if (Date.now() - started > 4000) window.clearInterval(timer);
    }, 400);
    return () => { window.clearInterval(timer); try { el.innerHTML = ""; el.dataset.adInjected = ""; } catch {} };
  }, [adKey, width, height]);
  // Keep the host element mounted so the ad script can inject its iframe.
  // Collapse the slot until an iframe is detected to avoid reserving empty space.
  return <div className="relative overflow-hidden rounded-xl" style={{ width, height: filled ? height + 14 : 0, margin: "0 auto" }}><div ref={containerRef} style={{ width, height, marginTop: 12, position: filled ? "relative" : "absolute", opacity: filled ? 1 : 0, pointerEvents: filled ? "auto" : "none" }} /></div>;
}

// STOP uses the existing native Google AdMob integration inside the Android TWA.
// Do not load Adsterra or AdSense scripts from the website; native rewarded and
// interstitial placements are handled by the Android AdMob SDK.
export function BannerAd(_props: { className?: string; isPremium?: boolean }) {
  return null;
}

export function RewardedAd({ onComplete, onSkip, playerId, isPremium = false, rewardType = "points", rewardAmount = 20 }: { onComplete: (reward: number) => void; onSkip: () => void; playerId?: string; isPremium?: boolean; rewardType?: "points" | "hint" | "extraTime"; rewardAmount?: number }) {
  const [phase, setPhase] = useState<"pre" | "loading" | "error" | "done">("pre");
  const [errorDetail, setErrorDetail] = useState<string>("");
  const t = getT();
  const timeoutRef = useRef<ReturnType<typeof window.setTimeout> | null>(null);
  const mountedRef = useRef(true);
  const onCompleteRef = useRef(onComplete);
  const onSkipRef = useRef(onSkip);
  onCompleteRef.current = onComplete;
  onSkipRef.current = onSkip;
  useEffect(() => () => {
    mountedRef.current = false;
    if (timeoutRef.current !== null) window.clearTimeout(timeoutRef.current);
    timeoutRef.current = null;
    // Defensive cleanup: if the rewarded overlay is unmounted while the
    // native activity is opening/closing, never leave the game globally paused.
    resumeGameTimer();
    window.dispatchEvent(new Event(GAME_TIMER_RESUME_EVENT));
  }, []);
  const labels = { points: `+${rewardAmount} pts`, hint: t.ads.reward, extraTime: "+30s" };
  const icons = { points: <Star className="w-8 h-8 text-[#f9a825]" />, hint: <Zap className="w-8 h-8 text-[#f9a825]" />, extraTime: <Gift className="w-8 h-8 text-[#f9a825]" /> };

  useEffect(() => { initTwaAdBridge(); }, []);

  const startWatching = async () => {
    // Premium and unmounted overlays must never request or grant an ad reward.
    if (isPremium || !mountedRef.current) return;
    setRewardedAdPlayerId(playerId);
    const placement = rewardType === "extraTime" ? "extra_time" : rewardType === "hint" ? "hint" : "double_points";
    void trackAnalyticsEvent("rewarded_ad_requested", { metadata: { placement } });
    pauseGameTimer();
    window.dispatchEvent(new Event(GAME_TIMER_PAUSE_EVENT));
    setPhase("loading");
    setErrorDetail("");

    try {
      const bridgeReady = isTwaAdBridgeAvailable();
      const knownTwa =
        hasAndroidAppReferrer() ||
        new URLSearchParams(window.location.search).get("source") === "googleplay-twa" ||
        new URLSearchParams(window.location.search).get("source") === "twa";

      if (bridgeReady || knownTwa) {
        const result = await requestRewardedAd(placement);
        // The server only reports source=admob after validating Google's signed SSV callback.
        if (result.rewarded === true && result.source === "admob") {
          if (!mountedRef.current) return;
          setPhase("done");
          void trackAnalyticsEvent("rewarded_ad_completed", { metadata: { placement, source: "admob" } });
          void trackAnalyticsEvent("powerup_used", { metadata: { powerup: placement, source: "admob" } });
          timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            if (mountedRef.current) onCompleteRef.current(rewardAmount);
          }, 500);
        } else {
          const detail = [
            result.errorCode != null ? `código ${result.errorCode}` : "",
            result.errorDomain || "",
            result.errorMessage || "",
          ].filter(Boolean).join(" · ");
          setErrorDetail(detail);
          void trackAnalyticsEvent("rewarded_ad_failed", { metadata: { placement, error: detail.slice(0, 300) } });
          if (!mountedRef.current) return;
          setPhase("error");
          timeoutRef.current = window.setTimeout(() => {
            timeoutRef.current = null;
            if (mountedRef.current) onSkipRef.current();
          }, detail ? 5000 : 900);
        }
        return;
      }

      setErrorDetail("El puente nativo de anuncios no está disponible.");
      if (!mountedRef.current) return;
      setPhase("error");
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        if (mountedRef.current) onSkipRef.current();
      }, 5000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido";
      setErrorDetail(message.slice(0, 300));
      if (!mountedRef.current) return;
      setPhase("error");
      timeoutRef.current = window.setTimeout(() => {
        timeoutRef.current = null;
        if (mountedRef.current) onSkipRef.current();
      }, 5000);
    }
  };

  if (isPremium) return null;

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-3xl overflow-hidden bg-white shadow-2xl"><div className="p-6 text-center"><h3 className="text-xl font-black">{phase === "done" ? "¡Recompensa!" : phase === "error" ? "Anuncio no disponible" : "Mira el anuncio"}</h3>{phase === "pre" && <><div className="my-5 flex justify-center">{icons[rewardType]}</div><p className="text-gray-600 text-sm mb-5">{labels[rewardType]}</p><button onClick={startWatching} className="w-full py-3 rounded-xl font-bold bg-[#f9a825] text-[#0d1757]">Ver anuncio</button><button onClick={onSkip} className="w-full py-2 mt-2 text-gray-500">Ahora no</button></>}{phase === "loading" && <div className="py-10"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#f9a825]"/><p className="text-sm text-gray-600">Cargando anuncio…</p></div>}{phase === "error" && <><div className="py-8 text-4xl">📺</div><p className="text-sm text-gray-600">No se ha podido mostrar un anuncio recompensado.</p>{errorDetail && <p className="mt-2 rounded-lg bg-gray-100 px-3 py-2 text-left text-[11px] leading-4 text-gray-600 break-words">Diagnóstico: {errorDetail}</p>}<button onClick={onSkip} className="w-full py-2 mt-4 text-gray-500">Continuar</button></>}{phase === "done" && <div className="py-8"><div className="text-5xl mb-3">🎉</div><p className="text-gray-700">{labels[rewardType]}</p></div>}</div></div></div>;
}