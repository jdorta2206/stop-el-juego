import { useEffect, useRef, useState } from "react";
import { Gift, Star, X, Zap } from "lucide-react";
import { getT } from "@/i18n/index";
import { detectPaymentChannel, hasAndroidAppReferrer } from "@/lib/playBilling";
import { initTwaAdBridge, isTwaAdBridgeAvailable, requestRewardedAd } from "@/lib/twaAdBridge";

const ADS_DISABLED = import.meta.env.VITE_ADS_DISABLED === "1";
const ADSTERRA_BANNER_KEY = ADS_DISABLED ? undefined : ((import.meta.env.VITE_ADSTERRA_BANNER_KEY as string | undefined) ?? "1212cb86d493b763d38d4523eec88cac");
const ADSTERRA_BANNER_W = 320;
const ADSTERRA_BANNER_H = 50;
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
const BANNER_SLOT = import.meta.env.VITE_ADSENSE_BANNER_SLOT as string | undefined;
const VIDEO_SLOT = import.meta.env.VITE_ADSENSE_VIDEO_SLOT as string | undefined;
const ADSENSE_READY = !!ADSENSE_CLIENT;

function inStandaloneOrTwaSync(): boolean {
  if (typeof window === "undefined") return true;
  try {
    if (hasAndroidAppReferrer()) return true;
    const params = new URLSearchParams(window.location.search);
    if (params.get("source") === "twa" || params.get("utm_source") === "twa") return true;
    const ua = navigator.userAgent || "";
    const standalone = window.matchMedia?.("(display-mode: standalone)").matches ?? false;
    const fullscreen = window.matchMedia?.("(display-mode: fullscreen)").matches ?? false;
    return /Android/i.test(ua) && (standalone || fullscreen);
  } catch {
    return true;
  }
}

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
      if (el.querySelector("iframe")) {
        setFilled(true);
        window.clearInterval(timer);
      } else if (Date.now() - started > 4000) {
        window.clearInterval(timer);
      }
    }, 400);
    return () => {
      window.clearInterval(timer);
      try { el.innerHTML = ""; el.dataset.adInjected = ""; } catch {}
    };
  }, [adKey, width, height]);
  if (!filled) return null;
  return <div className="relative overflow-hidden rounded-xl" style={{ width, height: height + 14, margin: "0 auto" }}><div ref={containerRef} style={{ width, height, marginTop: 12 }} /></div>;
}

export function BannerAd({ className = "" }: { className?: string }) {
  const insRef = useRef<HTMLModElement>(null);
  const [visible, setVisible] = useState(true);
  const [adsAllowed, setAdsAllowed] = useState(false);
  const t = getT();

  useEffect(() => {
    if (ADS_DISABLED || inStandaloneOrTwaSync()) return;
    let cancelled = false;
    // IMPORTANT: detectPaymentChannel() is synchronous and returns "play" | "stripe".
    // Calling .then() here was the production crash: "Dg(...).then is not a function".
    try {
      const channel = detectPaymentChannel();
      if (!cancelled && channel === "stripe") setAdsAllowed(true);
    } catch {
      // Fail closed: ads remain disabled when detection fails.
    }
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (ADSENSE_READY && BANNER_SLOT && insRef.current) pushAd();
  }, []);

  if (!visible || !adsAllowed) return null;
  if (ADSTERRA_BANNER_KEY) return <div className={`relative ${className}`}><AdsterraSlot adKey={ADSTERRA_BANNER_KEY} width={ADSTERRA_BANNER_W} height={ADSTERRA_BANNER_H} /><button onClick={() => setVisible(false)} aria-label="Cerrar anuncio" className="absolute top-0 right-0 p-1 text-black/30 hover:text-black/60 z-20"><X className="w-3.5 h-3.5" /></button></div>;
  if (ADSENSE_READY && BANNER_SLOT) return <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ minHeight: 60 }}><div className="absolute top-1 left-2 text-[9px] text-black/30 font-mono z-10">{t.ads.label}</div><ins ref={insRef} className="adsbygoogle" style={{ display: "block", minHeight: 50 }} data-ad-client={ADSENSE_CLIENT} data-ad-slot={BANNER_SLOT} data-ad-format="auto" data-full-width-responsive="true" /></div>;
  return null;
}

export function RewardedAd({ onComplete, onSkip, rewardType = "points", rewardAmount = 20 }: { onComplete: (reward: number) => void; onSkip: () => void; rewardType?: "points" | "hint" | "extraTime"; rewardAmount?: number }) {
  const [phase, setPhase] = useState<"pre" | "watching" | "done">("pre");
  const [error, setError] = useState(false);
  const [bridgeReady, setBridgeReady] = useState(false);
  const t = getT();
  const labels = { points: `+${rewardAmount} pts`, hint: t.ads.reward, extraTime: "+30s" };
  const icons = { points: <Star className="w-8 h-8 text-[#f9a825]" />, hint: <Zap className="w-8 h-8 text-[#f9a825]" />, extraTime: <Gift className="w-8 h-8 text-[#f9a825]" /> };
  const placement = rewardType === "extraTime" ? "extra_time" : rewardType === "hint" ? "hint" : "double_points";

  useEffect(() => {
    initTwaAdBridge();
    setBridgeReady(isTwaAdBridgeAvailable());
    const timer = window.setInterval(() => setBridgeReady(isTwaAdBridgeAvailable()), 500);
    return () => window.clearInterval(timer);
  }, []);

  const startWatching = async () => {
    if (!isTwaAdBridgeAvailable()) {
      setError(true);
      return;
    }

    setError(false);
    setPhase("watching");
    const result = await requestRewardedAd(placement);

    if (result.rewarded) {
      setPhase("done");
      window.setTimeout(() => onComplete(rewardAmount), 350);
      return;
    }

    setPhase("pre");
    setError(true);
  };

  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm rounded-3xl overflow-hidden bg-white shadow-2xl"><div className="p-6 text-center"><h3 className="text-xl font-black">{phase === "done" ? "¡Recompensa!" : "Mira el anuncio"}</h3>{phase === "pre" && <><div className="my-5 flex justify-center">{icons[rewardType]}</div><p className="text-gray-600 text-sm mb-5">{labels[rewardType]}</p>{error && <p className="text-red-500 text-xs mb-3">{bridgeReady ? "No se pudo completar el anuncio. Inténtalo de nuevo." : "Los anuncios bonificados no están disponibles en esta versión."}</p>}<button disabled={!bridgeReady} onClick={startWatching} className="w-full py-3 rounded-xl font-bold bg-[#f9a825] text-[#0d1757] disabled:opacity-50 disabled:cursor-not-allowed">{bridgeReady ? "Ver anuncio" : "Anuncio no disponible"}</button><button onClick={onSkip} className="w-full py-2 mt-2 text-gray-500">Ahora no</button></>}{phase === "watching" && <div className="py-12"><div className="mx-auto mb-4 h-10 w-10 animate-spin rounded-full border-4 border-gray-200 border-t-[#f9a825]" /><p className="text-sm text-gray-600">Cargando anuncio...</p><p className="text-xs text-gray-400 mt-2">La recompensa se entrega solo cuando AdMob confirma que el anuncio se ha completado.</p></div>}{phase === "done" && <div className="py-8"><div className="text-5xl mb-3">🎉</div><p className="text-gray-700">{labels[rewardType]}</p></div>}</div></div></div>;
}
