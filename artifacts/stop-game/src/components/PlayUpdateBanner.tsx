import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useT } from "@/i18n/useT";
import { detectPaymentChannel } from "@/lib/playBilling";

const TWA_PACKAGE = "app.replit.stop_el_juego.twa";
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${TWA_PACKAGE}`;

// Dismissed flag is per-session: the prompt reappears each time the app is
// opened (so users still on the old build keep being nudged), but it won't
// nag again within the same session once they tap "update" or "later".
const DISMISS_KEY = "stop_play_update_prompt_v1";

// True only when launched from OUR specific installed app. A TWA navigates
// with document.referrer === "android-app://<its package>", so matching our
// exact package id catches every version of the app (even old builds that
// don't expose Play Billing) while ignoring links opened from other Android
// apps (which carry a different package in the referrer).
function isOwnAppReferrer(): boolean {
  return (
    typeof document !== "undefined" &&
    document.referrer.startsWith(`android-app://${TWA_PACKAGE}`)
  );
}

export function PlayUpdateBanner() {
  const { lang } = useT();
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (sessionStorage.getItem(DISMISS_KEY)) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    // Let the app paint first, then surface the prompt.
    const reveal = () => {
      timer = setTimeout(() => {
        if (!cancelled) setShow(true);
      }, 700);
    };

    if (isOwnAppReferrer()) {
      // Old or new build of our app — show the update nudge.
      reveal();
    } else {
      // Fallback for TWA sessions where the referrer is empty (deep links,
      // restored sessions): use the authoritative Play Billing check, which
      // Chrome only resolves inside the installed TWA.
      detectPaymentChannel().then((channel) => {
        if (!cancelled && channel === "play") reveal();
      });
    }

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, []);

  const close = () => {
    setShow(false);
    try {
      sessionStorage.setItem(DISMISS_KEY, "1");
    } catch {
      /* sessionStorage unavailable — fine, prompt just won't persist */
    }
  };

  const title =
    lang === "en"
      ? "New version available!"
      : lang === "pt"
      ? "Nova versão disponível!"
      : lang === "fr"
      ? "Nouvelle version disponible !"
      : "¡Nueva versión disponible!";

  const body =
    lang === "en"
      ? "Update the app on Google Play to get the latest improvements and new features."
      : lang === "pt"
      ? "Atualiza a app no Google Play para teres as últimas melhorias e novidades."
      : lang === "fr"
      ? "Mets à jour l'app sur Google Play pour profiter des dernières améliorations et nouveautés."
      : "Actualiza la app desde Google Play para disfrutar de las últimas mejoras y novedades.";

  const cta =
    lang === "en"
      ? "Update on Google Play"
      : lang === "pt"
      ? "Atualizar no Google Play"
      : lang === "fr"
      ? "Mettre à jour sur Google Play"
      : "Actualizar en Google Play";

  const later =
    lang === "en" ? "Not now" : lang === "pt" ? "Agora não" : lang === "fr" ? "Plus tard" : "Ahora no";

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          key="play-update-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[60] flex items-center justify-center px-5"
          style={{ background: "rgba(3,7,30,0.78)", backdropFilter: "blur(4px)" }}
          onClick={close}
        >
          <motion.div
            initial={{ scale: 0.85, y: 30, opacity: 0 }}
            animate={{ scale: 1, y: 0, opacity: 1 }}
            exit={{ scale: 0.85, y: 30, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.38 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-sm rounded-3xl p-6 shadow-2xl flex flex-col items-center text-center gap-4"
            style={{
              background: "linear-gradient(145deg, #1a237e 0%, #0d1757 100%)",
              border: "2px solid rgba(249,168,37,0.45)",
            }}
          >
            <motion.span
              className="text-5xl"
              animate={{ rotate: [0, -8, 8, -8, 0] }}
              transition={{ repeat: Infinity, duration: 2.4, repeatDelay: 1.2 }}
            >
              🚀
            </motion.span>

            <div>
              <p className="text-white font-black text-lg leading-tight">{title}</p>
              <p className="text-white/60 text-sm mt-2 leading-relaxed">{body}</p>
            </div>

            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              onClick={close}
              className="w-full py-3 rounded-2xl font-black text-[#0d1757] text-base"
              style={{ background: "#f9a825" }}
            >
              {cta}
            </a>

            <button
              onClick={close}
              className="text-white/40 text-sm font-bold py-1"
            >
              {later}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
