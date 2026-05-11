import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { Trophy, Star } from "lucide-react";
import { useT } from "@/i18n/useT";

interface FirstVictoryCelebrationProps {
  open: boolean;
  xpGained: number;
  onClose: () => void;
  onEnableNotifications?: () => void;
}

export function FirstVictoryCelebration({
  open, xpGained, onClose, onEnableNotifications,
}: FirstVictoryCelebrationProps) {
  const { t } = useT();
  const ftue = (t as unknown as { ftue: Record<string, string> }).ftue;

  useEffect(() => {
    if (!open) return;
    confetti({
      particleCount: 220,
      spread: 110,
      origin: { y: 0.55 },
      colors: ["#f9a825", "#dc2626", "#4ade80", "#ffffff"],
    });
    const t2 = setTimeout(() => {
      confetti({
        particleCount: 140,
        spread: 90,
        startVelocity: 35,
        origin: { y: 0.6 },
        colors: ["#f9a825", "#ffffff"],
      });
    }, 600);
    return () => clearTimeout(t2);
  }, [open]);

  const supportsNotifications = typeof Notification !== "undefined";
  const notificationsAlreadyGranted =
    supportsNotifications && Notification.permission === "granted";
  const showNotifyButton =
    supportsNotifications && !notificationsAlreadyGranted && !!onEnableNotifications;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[110] flex items-center justify-center p-4"
          style={{ background: "rgba(6,3,24,0.88)", backdropFilter: "blur(10px)" }}
        >
          <motion.div
            initial={{ scale: 0.5, opacity: 0, rotate: -8 }}
            animate={{ scale: 1, opacity: 1, rotate: 0 }}
            exit={{ scale: 0.7, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.55, duration: 0.7 }}
            className="relative w-full max-w-sm rounded-3xl p-7 text-center"
            style={{
              background: "linear-gradient(135deg, #1a237e 0%, #5a1208 100%)",
              border: "2px solid rgba(249,168,37,0.7)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.7), 0 0 100px rgba(249,168,37,0.35)",
            }}
          >
            <motion.div
              animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.1, 1] }}
              transition={{ duration: 1.2, repeat: Infinity, repeatDelay: 0.6 }}
              className="mx-auto w-24 h-24 rounded-full flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, #f9a825, #dc2626)",
                boxShadow: "0 12px 32px rgba(249,168,37,0.6)",
              }}
            >
              <Trophy className="w-14 h-14 text-white" fill="white" />
            </motion.div>

            <motion.p
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.25 }}
              className="text-[10px] font-black uppercase tracking-[0.25em] text-[#f9a825] mb-1"
            >
              {ftue?.firstWinTag ?? "Tu primera victoria"}
            </motion.p>
            <motion.h2
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.3, type: "spring", bounce: 0.5 }}
              className="text-3xl font-black text-white mb-3"
              style={{ fontFamily: "'Baloo 2', sans-serif", textShadow: "0 4px 16px rgba(0,0,0,0.5)" }}
            >
              {ftue?.firstWinTitle ?? "¡GANASTE!"}
            </motion.h2>

            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ delay: 0.5, type: "spring", bounce: 0.6 }}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-5"
              style={{ background: "rgba(249,168,37,0.18)", border: "1.5px solid rgba(249,168,37,0.55)" }}
            >
              <Star className="w-4 h-4 text-[#f9a825]" fill="#f9a825" />
              <span className="text-white font-black text-base">+{xpGained} XP</span>
            </motion.div>

            <p className="text-white/85 text-sm leading-relaxed mb-5">
              {ftue?.firstWinBody ?? "Has hecho una partida completa. Ahora sigue jugando para subir de nivel y desbloquear logros."}
            </p>

            {showNotifyButton && (
              <motion.button
                initial={{ y: 10, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.7 }}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => {
                  onEnableNotifications?.();
                }}
                className="w-full py-3 rounded-2xl font-black text-sm text-white mb-2"
                style={{
                  background: "linear-gradient(135deg, rgba(74,222,128,0.25), rgba(34,197,94,0.15))",
                  border: "1.5px solid rgba(74,222,128,0.55)",
                }}
              >
                🔔 {ftue?.enableNotifications ?? "Avísame para no perder mi racha"}
              </motion.button>
            )}

            <motion.button
              initial={{ y: 10, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.8 }}
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={onClose}
              className="w-full py-3.5 rounded-2xl font-black text-base text-white"
              style={{
                background: "linear-gradient(135deg, #f9a825 0%, #dc2626 100%)",
                boxShadow: "0 6px 20px rgba(249,168,37,0.4)",
                fontFamily: "'Baloo 2', sans-serif",
              }}
            >
              {ftue?.firstWinCta ?? "¡Seguir jugando!"}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
