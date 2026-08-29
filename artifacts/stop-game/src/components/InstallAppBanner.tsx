import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Share, Plus, X, LogIn } from "lucide-react";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { useT } from "@/i18n/useT";
import { usePlayer } from "@/hooks/use-player";

const DISMISS_KEY = "stop_install_banner_dismissed_at_v1";
const COOLDOWN_MS = 30 * 24 * 60 * 60 * 1000;
const SHOW_DELAY_MS = 8000;

type Platform = "android" | "ios" | "other";

function detectPlatform(): Platform {
  if (typeof navigator === "undefined") return "other";
  const ua = navigator.userAgent || "";
  const isIOS = /iPad|iPhone|iPod/.test(ua) && !(window as any).MSStream;
  if (isIOS) {
    const isSafari = /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua);
    return isSafari ? "ios" : "other";
  }
  if (/Android/.test(ua)) return "android";
  return "other";
}

function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(display-mode: standalone)").matches || (window.navigator as any).standalone === true;
}

export function InstallAppBanner() {
  const { lang } = useT();
  const { player, showAuth } = usePlayer();
  const { canInstall, isInstalled, isInstalling, triggerInstall } = usePWAInstall();
  const [platform, setPlatform] = useState<Platform>("other");
  const [visible, setVisible] = useState(false);

  useEffect(() => { setPlatform(detectPlatform()); }, []);

  useEffect(() => {
    if (isInstalled || isStandalone()) return;
    const dismissedAt = Number(localStorage.getItem(DISMISS_KEY) || 0);
    if (dismissedAt && Date.now() - dismissedAt < COOLDOWN_MS) return;
    const eligible = (platform === "android" && canInstall) || platform === "ios";
    if (!eligible) return;
    const timer = setTimeout(() => setVisible(true), SHOW_DELAY_MS);
    return () => clearTimeout(timer);
  }, [platform, canInstall, isInstalled]);

  const dismiss = () => {
    setVisible(false);
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
  };

  const handleInstall = async () => {
    const result = await triggerInstall();
    if (result === "accepted") setVisible(false);
    else if (result === "dismissed") dismiss();
  };

  const t = {
    title: lang === "en" ? "Install STOP on your device" : lang === "pt" ? "Instala STOP no teu dispositivo" : lang === "fr" ? "Installe STOP sur ton appareil" : "Instala STOP en tu dispositivo",
    bodyAndroid: lang === "en" ? "Add it to your home screen and play with one tap, even offline." : lang === "pt" ? "Adiciona-o ao ecrã inicial e joga com um toque, mesmo offline." : lang === "fr" ? "Ajoute-le à ton écran d'accueil et joue d'un tap, même hors ligne." : "Añádelo a tu pantalla de inicio y juega con un toque, incluso sin conexión.",
    bodyIos: lang === "en" ? "On iPhone: tap Share, then “Add to Home Screen”." : lang === "pt" ? "No iPhone: toca em Partilhar e depois em “Adicionar ao Ecrã Principal”." : lang === "fr" ? "Sur iPhone : appuie sur Partager, puis sur « Sur l'écran d'accueil »." : "En iPhone: pulsa Compartir y luego “Añadir a pantalla de inicio”.",
    install: lang === "en" ? "Install" : lang === "pt" ? "Instalar" : lang === "fr" ? "Installer" : "Instalar",
    later: lang === "en" ? "Later" : lang === "pt" ? "Depois" : lang === "fr" ? "Plus tard" : "Más tarde",
    iosShare: lang === "en" ? "Share" : lang === "pt" ? "Partilhar" : lang === "fr" ? "Partager" : "Compartir",
    iosAdd: lang === "en" ? "Add to Home Screen" : lang === "pt" ? "Adicionar ao Ecrã Principal" : lang === "fr" ? "Sur l'écran d'accueil" : "Añadir a pantalla de inicio",
  };

  return (
    <>
      {!player && !isStandalone() && (
        <button
          type="button"
          onClick={showAuth}
          className="hidden md:flex fixed top-3 right-4 z-[60] items-center gap-2 px-4 py-2.5 rounded-full font-black text-sm text-[#0d1757] shadow-lg hover:scale-105 active:scale-95 transition-transform"
          style={{ background: "#f9a825" }}
          aria-label="Iniciar sesión o registrarse"
        >
          <LogIn className="w-4 h-4" />
          <span>Iniciar sesión / Registrarse</span>
        </button>
      )}

      <AnimatePresence>
        {visible && (
          <motion.div key="install-banner" initial={{ y: 140, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 140, opacity: 0 }} transition={{ type: "spring", bounce: 0.32 }} className="fixed bottom-20 left-0 right-0 z-50 flex justify-center px-4">
            <div className="w-full max-w-sm rounded-3xl p-5 shadow-2xl flex flex-col gap-3" style={{ background: "linear-gradient(145deg, #1a237e 0%, #0d1757 100%)", border: "2px solid rgba(249,168,37,0.4)" }}>
              <div className="flex items-start gap-3">
                <span className="text-3xl mt-0.5">📲</span>
                <div className="flex-1">
                  <p className="text-white font-black text-sm leading-tight">{t.title}</p>
                  <p className="text-white/55 text-xs mt-1 leading-relaxed">{platform === "ios" ? t.bodyIos : t.bodyAndroid}</p>
                </div>
                <button onClick={dismiss} aria-label="dismiss" className="text-white/30 hover:text-white/60 leading-none mt-0.5"><X className="w-4 h-4" /></button>
              </div>
              {platform === "ios" && (
                <div className="rounded-2xl p-3 flex flex-col gap-2" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>
                  <div className="flex items-center gap-2 text-white/85 text-xs font-bold"><span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-[#0d1757]" style={{ background: "#f9a825" }}>1</span><Share className="w-4 h-4 text-[#5ac8fa]" /><span>{t.iosShare}</span></div>
                  <div className="flex items-center gap-2 text-white/85 text-xs font-bold"><span className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black text-[#0d1757]" style={{ background: "#f9a825" }}>2</span><Plus className="w-4 h-4 text-[#5ac8fa]" /><span>{t.iosAdd}</span></div>
                </div>
              )}
              <div className="flex items-center gap-2 mt-1">
                {platform === "android" && canInstall && <button onClick={handleInstall} disabled={isInstalling} className="flex-1 px-4 py-2.5 rounded-xl font-black text-sm text-[#0d1757]" style={{ background: "#f9a825" }}>{isInstalling ? "..." : t.install}</button>}
                <button onClick={dismiss} className={`${platform === "android" && canInstall ? "" : "flex-1"} px-4 py-2.5 rounded-xl font-bold text-sm text-white/60`} style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}>{t.later}</button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
