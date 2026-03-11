import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Play, Gift, Zap, Star } from "lucide-react";

// ─── Banner Ad ───────────────────────────────────────────────────────────────

const BANNER_ADS = [
  {
    id: 1,
    brand: "🎮 AppGamePro",
    text: "Descarga el pack premium — 100 categorías extra",
    cta: "Ver más",
    bg: "linear-gradient(135deg, #1a237e 0%, #283593 100%)",
    accent: "#f9a825",
  },
  {
    id: 2,
    brand: "⚡ SpeedWords",
    text: "¿Puedes escribir más rápido que la IA? Prueba el desafío",
    cta: "Probar",
    bg: "linear-gradient(135deg, #b71c1c 0%, #e53935 100%)",
    accent: "#fff",
  },
  {
    id: 3,
    brand: "🏆 STOP Pro",
    text: "Sin anuncios + 3 meses gratis. ¡Oferta limitada!",
    cta: "Activar",
    bg: "linear-gradient(135deg, #1b5e20 0%, #2e7d32 100%)",
    accent: "#a5d6a7",
  },
];

export function BannerAd({ className = "" }: { className?: string }) {
  const [adIndex, setAdIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  const ad = BANNER_ADS[adIndex % BANNER_ADS.length];

  if (!visible) return null;

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
              {ad.brand} · Publicidad
            </p>
            <p className="text-white text-sm font-semibold leading-tight truncate">
              {ad.text}
            </p>
          </div>
          <button
            className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-black transition-all hover:scale-105 active:scale-95"
            style={{ background: ad.accent, color: ad.bg.includes("1a237e") ? "#1a237e" : "#fff" }}
            onClick={() => setAdIndex(i => i + 1)}
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
        {/* "Ad" label */}
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

export function RewardedAd({ onComplete, onSkip, rewardType = "points", rewardAmount = 20 }: RewardedAdProps) {
  const [countdown, setCountdown] = useState(15);
  const [phase, setPhase] = useState<"pre" | "watching" | "done">("pre");
  const [progress, setProgress] = useState(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  const startWatching = () => {
    setPhase("watching");
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
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, []);

  const rewardLabels = {
    points: `+${rewardAmount} puntos`,
    hint: "Pista gratuita",
    extraTime: "+30 segundos",
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
        style={{ background: "linear-gradient(145deg, #1a237e, #0d1757)", border: "2px solid rgba(249,168,37,0.4)" }}
      >
        {phase === "pre" && (
          <div className="p-8 text-center space-y-6">
            <div className="flex justify-center">{rewardIcons[rewardType]}</div>
            <div>
              <h3 className="text-2xl font-black text-white mb-2">¡Gana un premio!</h3>
              <p className="text-white/70">Mira un vídeo corto y gana</p>
              <p className="text-[#f9a825] text-3xl font-black mt-2">{rewardLabels[rewardType]}</p>
            </div>
            {/* Simulated ad preview */}
            <div
              className="rounded-2xl overflow-hidden relative h-36 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2d1b69, #11998e)" }}
            >
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="text-center text-white">
                  <div className="text-4xl mb-2">🎯</div>
                  <p className="font-bold">Vídeo publicitario</p>
                  <p className="text-xs opacity-60 mt-1">Duración: 15 segundos</p>
                </div>
              </div>
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-bold">
                ANUNCIO
              </div>
            </div>
            <div className="flex gap-3">
              <button
                onClick={onSkip}
                className="flex-1 py-3 rounded-xl border-2 border-white/20 text-white/60 font-bold text-sm hover:bg-white/10 transition-all"
              >
                Saltar
              </button>
              <button
                onClick={startWatching}
                className="flex-1 py-3 rounded-xl font-black text-sm flex items-center justify-center gap-2"
                style={{ background: "#e63012", color: "white" }}
              >
                <Play className="w-4 h-4 fill-white" /> Ver vídeo
              </button>
            </div>
          </div>
        )}

        {phase === "watching" && (
          <div className="p-8 space-y-6">
            {/* Simulated video player */}
            <div
              className="rounded-2xl overflow-hidden relative h-44 flex items-center justify-center"
              style={{ background: "linear-gradient(135deg, #2d1b69, #11998e)" }}
            >
              <div className="text-center text-white">
                <motion.div
                  animate={{ scale: [1, 1.1, 1] }}
                  transition={{ repeat: Infinity, duration: 2 }}
                  className="text-5xl mb-2"
                >
                  🎮
                </motion.div>
                <p className="font-bold text-lg">¡Mira el anuncio completo!</p>
                <p className="text-sm opacity-70 mt-1">para recibir tu recompensa</p>
              </div>
              {/* Countdown overlay */}
              <div className="absolute bottom-3 right-3 bg-black/60 text-white text-sm px-3 py-1 rounded-full font-bold">
                {countdown}s
              </div>
              <div className="absolute top-2 right-2 bg-black/50 text-white text-xs px-2 py-1 rounded font-bold">
                ANUNCIO
              </div>
            </div>
            {/* Progress bar */}
            <div>
              <div className="flex justify-between text-sm text-white/60 mb-2">
                <span>Progreso</span>
                <span>{countdown}s restantes</span>
              </div>
              <div className="h-3 bg-white/10 rounded-full overflow-hidden">
                <motion.div
                  className="h-full rounded-full"
                  style={{ background: "#f9a825", width: `${progress}%` }}
                  transition={{ duration: 0.5 }}
                />
              </div>
            </div>
            <p className="text-center text-white/50 text-sm">No puedes saltar este anuncio</p>
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
            <h3 className="text-2xl font-black text-[#f9a825]">¡Premio conseguido!</h3>
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
  const [countdown, setCountdown] = useState(5);

  useEffect(() => {
    const timer = setInterval(() => {
      setCountdown(prev => {
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
        style={{ background: "linear-gradient(135deg, #2d1b69, #11998e)", border: "2px solid rgba(255,255,255,0.1)" }}
      >
        <div className="p-6 space-y-4">
          <div className="text-xs text-white/40 font-bold uppercase tracking-wider text-center">
            Publicidad · Apoya STOP gratis
          </div>
          <div className="h-48 rounded-2xl bg-black/30 flex items-center justify-center">
            <div className="text-center text-white">
              <div className="text-5xl mb-3">🚀</div>
              <p className="font-bold text-xl">Juego Premium Pro</p>
              <p className="text-white/60 text-sm mt-1">Descarga gratis en la App Store</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <p className="text-white/50 text-sm">Se cierra en {countdown}s</p>
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
