import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Gift, Zap, Star } from "lucide-react";
import { getT } from "@/i18n/index";

// ─── Ad network config ───────────────────────────────────────────────────────
// Currently using Adsterra (320x50 iframe banner). Override via env if needed.
// Kill-switch: set VITE_ADS_DISABLED=1 to disable ALL ads instantly (use this
// if Google Play sends a "Disruptive Ads" policy warning — no redeploy needed
// to switch behavior, just toggle the secret and restart).
const ADS_DISABLED = import.meta.env.VITE_ADS_DISABLED === "1";
const ADSTERRA_BANNER_KEY = ADS_DISABLED
  ? undefined
  : ((import.meta.env.VITE_ADSTERRA_BANNER_KEY as string | undefined) ??
     "20fbacba6cfa090f0fdc325a456cc87b");
const ADSTERRA_BANNER_W = 320;
const ADSTERRA_BANNER_H = 50;

// Rectangle 300x250 — used inside RewardedAd modal as the "video" area.
const ADSTERRA_RECT_KEY = ADS_DISABLED
  ? undefined
  : ((import.meta.env.VITE_ADSTERRA_RECT_KEY as string | undefined) ??
     "8a1eada922ebe1e12f69cae426193885");
const ADSTERRA_RECT_W = 300;
const ADSTERRA_RECT_H = 250;

// Legacy AdSense config (kept for the rewarded/interstitial mock paths) —
// AdSense is currently disabled to avoid TOS conflicts with Adsterra.
const ADSENSE_CLIENT = import.meta.env.VITE_ADSENSE_CLIENT_ID as string | undefined;
const BANNER_SLOT    = import.meta.env.VITE_ADSENSE_BANNER_SLOT as string | undefined;
const VIDEO_SLOT     = import.meta.env.VITE_ADSENSE_VIDEO_SLOT as string | undefined;
const ADSENSE_READY  = !!ADSENSE_CLIENT;

// ─── Adsterra iframe ad component ────────────────────────────────────────────
// Their invoke.js looks at document.currentScript.parentNode to know where to
// drop the iframe, so we mount real <script> elements inside a per-instance div.
function AdsterraSlot({
  adKey,
  width,
  height,
  className = "",
  labelDark = false,
}: {
  adKey: string;
  width: number;
  height: number;
  className?: string;
  labelDark?: boolean;
}) {
  const t = getT();
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (el.dataset.adInjected === "1") return; // StrictMode guard
    el.dataset.adInjected = "1";

    const cfg = document.createElement("script");
    cfg.type = "text/javascript";
    cfg.text =
      `atOptions = { 'key' : '${adKey}', ` +
      `'format' : 'iframe', 'height' : ${height}, ` +
      `'width' : ${width}, 'params' : {} };`;
    el.appendChild(cfg);

    const loader = document.createElement("script");
    loader.type = "text/javascript";
    loader.src = `https://www.highperformanceformat.com/${adKey}/invoke.js`;
    loader.async = true;
    el.appendChild(loader);

    return () => {
      try { el.innerHTML = ""; el.dataset.adInjected = ""; } catch {}
    };
  }, [adKey, width, height]);

  return (
    <div
      className={`relative overflow-hidden rounded-xl ${labelDark ? "bg-black/30" : "bg-black/5"} ${className}`}
      style={{ width, height: height + 14, margin: "0 auto" }}
    >
      <div
        className={`absolute top-0 left-2 text-[9px] font-mono z-10 leading-none pt-0.5 ${labelDark ? "text-white/40" : "text-black/30"}`}
      >
        {t.ads.label}
      </div>
      <div ref={containerRef} style={{ width, height, marginTop: 12 }} />
    </div>
  );
}

// Push an AdSense slot after it mounts
function pushAd(ref: React.RefObject<HTMLElement | null>) {
  try {
    const win = window as any;
    win.adsbygoogle = win.adsbygoogle || [];
    win.adsbygoogle.push({});
  } catch (_) {}
}

// ─── Mock ads (shown when AdSense is not configured) ─────────────────────────

const MOCK_BANNER_ADS = [
  {
    id: 1,
    brand: "🏆 STOP Premium",
    text: "Sin anuncios + categorías ilimitadas — solo €1,99/mes",
    cta: "Ver oferta",
    bg: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
    accent: "#f9a825",
  },
  {
    id: 2,
    brand: "🎮 Modo Multijugador",
    text: "¡Juega contra amigos en tiempo real! Créa tu sala ahora",
    cta: "Jugar",
    bg: "linear-gradient(135deg, #b71c1c 0%, #e53935 100%)",
    accent: "#fff",
  },
  {
    id: 3,
    brand: "📢 Anunciante",
    text: "Tu anuncio podría aparecer aquí — Google AdSense pendiente",
    cta: "Info",
    bg: "linear-gradient(135deg, #37474f 0%, #546e7a 100%)",
    accent: "#90a4ae",
  },
];

// ─── Banner Ad ────────────────────────────────────────────────────────────────

export function BannerAd({ className = "" }: { className?: string }) {
  const insRef = useRef<HTMLModElement>(null);
  const [adIndex, setAdIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    // Push manual slot if configured
    if (ADSENSE_READY && BANNER_SLOT && insRef.current) {
      pushAd(insRef as any);
    }
  }, []);

  if (!visible) return null;

  // ── Adsterra banner (current production network) ──
  if (ADSTERRA_BANNER_KEY) {
    return (
      <div className={`relative ${className}`}>
        <AdsterraSlot adKey={ADSTERRA_BANNER_KEY} width={ADSTERRA_BANNER_W} height={ADSTERRA_BANNER_H} />
        <button
          onClick={() => setVisible(false)}
          aria-label="Cerrar anuncio"
          className="absolute top-0 right-0 p-1 text-black/30 hover:text-black/60 z-20"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  // ── Manual AdSense slot (if BANNER_SLOT is configured) ──
  if (ADSENSE_READY && BANNER_SLOT) {
    return (
      <div className={`relative overflow-hidden rounded-xl ${className}`} style={{ minHeight: 60 }}>
        <div className="absolute top-1 left-2 text-[9px] text-black/30 font-mono z-10">{getT().ads.label}</div>
        <ins
          ref={insRef}
          className="adsbygoogle"
          style={{ display: "block", minHeight: 50 }}
          data-ad-client={ADSENSE_CLIENT}
          data-ad-slot={BANNER_SLOT}
          data-ad-format="auto"
          data-full-width-responsive="true"
        />
      </div>
    );
  }

  // ── Auto Ads mode (client set, no slot) ──
  // Google Auto Ads injects ads automatically via the script in index.html.
  // Return null here — no manual <ins> needed (and it would error without a slot).
  if (ADSENSE_READY && !BANNER_SLOT) {
    return null;
  }

  // ── Mock banner (no AdSense configured) ──
  const ad = MOCK_BANNER_ADS[adIndex % MOCK_BANNER_ADS.length];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        className={`relative overflow-hidden rounded-xl shadow-lg ${className}`}
        style={{ background: ad.bg, minHeight: 56 }}
      >
        <div className="flex items-center gap-3 px-4 py-2.5">
          <div className="flex-1 min-w-0">
            <p
              className="text-xs font-bold uppercase tracking-wider opacity-70 mb-0.5"
              style={{ color: ad.accent }}
            >
              {ad.brand} · {getT().ads.label}
            </p>
            <p className="text-white text-sm font-semibold leading-tight truncate">{ad.text}</p>
          </div>
          <button
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black transition-all hover:scale-105 active:scale-95"
            style={{ background: ad.accent, color: ad.bg.includes("1a237e") ? "#1a237e" : "#fff" }}
            onClick={() => setAdIndex((i) => i + 1)}
          >
            {ad.cta}
          </button>
          <button
            onClick={() => setVisible(false)}
            className="text-white/40 hover:text-white/70 flex-shrink-0 ml-1"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
        <div className="absolute top-1 right-8 text-[10px] text-white/30 font-mono">AD</div>
      </motion.div>
    </AnimatePresence>
  );
}

// ─── Rewarded Video Ad ────────────────────────────────────────────────────────

interface RewardedAdProps {
  onComplete: (reward: number) => void;
  onSkip: () => void;
  rewardType?: "points" | "hint" | "extraTime";
  rewardAmount?: number;
}

export function RewardedAd({
  onComplete,
  onSkip,
  rewardType = "points",
  rewardAmount = 20,
}: RewardedAdProps) {
  const insRef = useRef<HTMLModElement>(null);
  const [countdown, setCountdown] = useState(15);
  const [phase, setPhase] = useState<"pre" | "watching" | "done">("pre");
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startWatching = () => {
    setPhase("watching");
    // Push real ad when video starts (legacy AdSense path; harmless if unused)
    if (ADSENSE_CLIENT && VIDEO_SLOT && insRef.current) {
      pushAd(insRef as any);
    }
    let elapsed = 0;
    intervalRef.current = setInterval(() => {
      elapsed++;
      setProgress((elapsed / 15) * 100);
      setCountdown(15 - elapsed);
      if (elapsed >= 15) {
        clearInterval(intervalRef.current!);
        setPhase("done");
        setTimeout(() => onComplete(rewardAmount), 500);
      }
    }, 1000);
  };

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, []);

  const t = getT();
  const rewardLabels = {
    points: `+${rewardAmount} pts`,
    hint: t.ads.reward,
    extraTime: "+30s",
  };
  const rewardIcons = {
    points: <Star className="w-8 h-8 text-[#f9a825]" />,
    hint: <Zap className="w-8 h-8 text-[#f9a825]" />,
    extraTime: <Gift className="w-8 h-8 text-[#f9a825]" />,
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80 backdrop-blur-sm" />
      <motion.div
        initial={{ scale: 0.85, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.85, opacity: 0 }}
        className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(145deg, #1a237e, #0d1757)",
          border: "2px solid rgba(249,168,37,0.4)",
        }}
      >
        {phase === "pre" && (
          <div className="p-8 text-center space-y-6">
            <div className="flex justify-center">{rewardIcons[rewardType]}</div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">{t.ads.reward}</h3>
              <p className="text-white/70">{t.ads.rewardSubtitle}</p>
              <p className="text-[#f9a825] text-3xl font-black mt-2">{rewardLabels[rewardType]}</p>
            </div>

            <p className="text-white/50 text-xs">{t.ads.adIntro}</p>

            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="flex-1 py-3 rounded-xl border-2 border-white/20 text-white/60 font-bold text-sm hover:bg-white/10 transition-all"
              >
                {t.ads.cancel}
              </button>
              <button
                onClick={startWatching}
                className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                style={{ background: "#b5301a", color: "white" }}
              >
                <Play className="w-4 h-4 fill-white" /> {t.ads.watchAd}
              </button>
            </div>
          </div>
        )}

        {phase === "watching" && (
          <div className="p-6 space-y-5">
            {ADSTERRA_RECT_KEY ? (
              <AdsterraSlot
                adKey={ADSTERRA_RECT_KEY}
                width={ADSTERRA_RECT_W}
                height={ADSTERRA_RECT_H}
                labelDark
              />
            ) : (
              <div
                className="rounded-2xl overflow-hidden relative h-44 flex items-center justify-center"
                style={{ background: "linear-gradient(135deg, #2d1b69, #11998e)" }}
              >
                <div className="text-center text-white">
                  <div className="text-5xl mb-2">🎮</div>
                  <p className="font-bold text-lg">{t.ads.loading}</p>
                </div>
              </div>
            )}
            <div>
              <div className="flex justify-between text-sm text-white/60 mb-2">
                <span>{t.ads.progress}</span>
                <span>{countdown}s {t.ads.remaining}</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "#f9a825", width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <p className="text-center text-white/50 text-sm">{t.ads.cannotSkip}</p>
          </div>
        )}

        {phase === "done" && (
          <motion.div
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="p-8 text-center space-y-4"
          >
            <motion.div
              initial={{ rotate: -20, scale: 0 }}
              animate={{ rotate: 0, scale: 1 }}
              transition={{ type: "spring", bounce: 0.6 }}
              className="text-6xl"
            >
              🎉
            </motion.div>
            <h3 className="text-2xl font-black text-[#f9a825]">{t.ads.prize}</h3>
            <p className="text-4xl font-black text-white">{rewardLabels[rewardType]}</p>
          </motion.div>
        )}
      </motion.div>
    </div>
  );
}

// ─── Interstitial Ad (between rounds) ────────────────────────────────────────

interface InterstitialAdProps {
  onDone: () => void;
}

export function InterstitialAd({ onDone }: InterstitialAdProps) {
  const insRef = useRef<HTMLModElement>(null);
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    // Push real ad on mount
    if (ADSENSE_CLIENT && VIDEO_SLOT && insRef.current) {
      pushAd(insRef as any);
    }

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          onDone();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(timer);
  }, [onDone]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/90" />
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        className="relative z-10 w-full max-w-sm rounded-3xl overflow-hidden shadow-2xl"
        style={{
          background: "linear-gradient(135deg, #0d1757, #1a237e)",
          border: "2px solid rgba(255,255,255,0.1)",
        }}
      >
        <div className="p-6 space-y-4">
          <div className="text-xs text-white/40 font-bold uppercase tracking-wider text-center">
            Publicidad · Apoya STOP gratis
          </div>

          {/* Real AdSense or mock */}
          {ADSENSE_CLIENT && VIDEO_SLOT ? (
            <div className="rounded-2xl overflow-hidden bg-black/30" style={{ minHeight: 200 }}>
              <ins
                ref={insRef}
                className="adsbygoogle"
                style={{ display: "block", minHeight: 200 }}
                data-ad-client={ADSENSE_CLIENT}
                data-ad-slot={VIDEO_SLOT}
                data-ad-format="rectangle"
                data-full-width-responsive="true"
              />
            </div>
          ) : (
            <div className="h-48 rounded-2xl bg-black/30 flex items-center justify-center">
              <div className="text-center text-white">
                <div className="text-5xl mb-3">🚀</div>
                <p className="font-bold text-xl">Espacio para anuncios</p>
                <p className="text-white/60 text-sm mt-1">Configura Google AdSense para ganar dinero</p>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <p className="text-white/50 text-sm">
              {countdown > 0 ? `Se cierra en ${countdown}s` : "Listo"}
            </p>
            {countdown === 0 && (
              <button
                onClick={onDone}
                className="px-4 py-2 rounded-lg bg-white/20 text-white font-bold text-sm hover:bg-white/30 transition-all"
              >
                Continuar →
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
