import { Link } from "wouter";
import { motion, AnimatePresence } from "framer-motion";
import { Zap, Sparkles, Trophy, UserRound } from "lucide-react";
import { useT } from "@/i18n/useT";

interface FTUEWelcomeModalProps {
  open: boolean;
  onClose: () => void;
}

export function FTUEWelcomeModal({ open, onClose }: FTUEWelcomeModalProps) {
  const { t } = useT();
  const ftue = (t as unknown as { ftue: Record<string, string> }).ftue;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(6,3,24,0.85)", backdropFilter: "blur(8px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.85, opacity: 0 }}
            transition={{ type: "spring", bounce: 0.45, duration: 0.6 }}
            className="relative w-full max-w-sm rounded-3xl p-6 text-center"
            style={{
              background: "linear-gradient(135deg, #1a063a 0%, #5a1208 100%)",
              border: "2px solid rgba(249,168,37,0.55)",
              boxShadow: "0 20px 60px rgba(0,0,0,0.6), 0 0 80px rgba(249,168,37,0.25)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <motion.div
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6, delay: 0.1 }}
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{
                background: "linear-gradient(135deg, #f9a825, #dc2626)",
                boxShadow: "0 8px 24px rgba(249,168,37,0.5)",
              }}
            >
              <Sparkles className="w-10 h-10 text-white" />
            </motion.div>

            <h2 className="text-2xl font-black text-white mb-2" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
              {ftue?.welcomeTitle ?? "¡Bienvenido a STOP!"}
            </h2>

            <p className="text-white/80 text-sm leading-relaxed mb-5">
              {ftue?.welcomeBody ?? "Mira la letra, escribe una palabra por categoría y pulsa STOP. Tus primeras 3 partidas son una guía rápida para que aprendas jugando."}
            </p>

            <div className="mb-5 rounded-2xl px-4 py-3 text-left" style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.10)" }}>
              <div className="flex items-center gap-2 text-white font-black text-sm">
                <UserRound className="w-4 h-4 text-green-300" />
                {ftue?.tutorialGuestTitle ?? "Puedes empezar como invitado"}
              </div>
              <p className="text-white/50 text-[11px] mt-1 pl-6">
                {ftue?.tutorialGuestBody ?? "Sin registro obligatorio. Primero juega; ya decidirás después si quieres guardar tu progreso."}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-2 mb-6">
              <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(249,168,37,0.12)", border: "1px solid rgba(249,168,37,0.25)" }}>
                <Zap className="w-5 h-5 text-[#f9a825] mx-auto mb-1" />
                <p className="text-[10px] font-black text-white/90 leading-tight">{ftue?.tipFast ?? "60 segundos"}</p>
              </div>
              <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.25)" }}>
                <Sparkles className="w-5 h-5 text-green-400 mx-auto mb-1" />
                <p className="text-[10px] font-black text-white/90 leading-tight">{ftue?.tipOriginal ?? "Originalidad +pts"}</p>
              </div>
              <div className="rounded-xl p-2.5 text-center" style={{ background: "rgba(220,38,38,0.12)", border: "1px solid rgba(220,38,38,0.25)" }}>
                <Trophy className="w-5 h-5 text-[#dc2626] mx-auto mb-1" />
                <p className="text-[10px] font-black text-white/90 leading-tight">{ftue?.tipLevel ?? "Sube de nivel"}</p>
              </div>
            </div>

            <Link href="/solo?auto=1&ftue=1">
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                onClick={onClose}
                className="w-full py-4 rounded-2xl font-black text-lg text-white"
                style={{
                  background: "linear-gradient(135deg, #f9a825 0%, #dc2626 100%)",
                  boxShadow: "0 6px 20px rgba(249,168,37,0.45)",
                  fontFamily: "'Baloo 2', sans-serif",
                }}
              >
                {ftue?.welcomeCta ?? "¡JUGAR AHORA!"}
              </motion.button>
            </Link>

            <button
              onClick={onClose}
              className="mt-3 text-white/40 text-xs hover:text-white/70 transition-colors"
            >
              {ftue?.skip ?? "Saltar"}
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
