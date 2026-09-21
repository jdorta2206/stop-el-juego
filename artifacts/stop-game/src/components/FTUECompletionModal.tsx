import { AnimatePresence, motion } from "framer-motion";
import { Trophy, Users, X } from "lucide-react";
import { Link } from "wouter";
import { useT } from "@/i18n/useT";

interface Props { open: boolean; onClose: () => void; }

export function FTUECompletionModal({ open, onClose }: Props) {
  const { t } = useT();
  return (
    <AnimatePresence>
      {open && (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          style={{ background: "rgba(6,3,24,0.88)", backdropFilter: "blur(8px)" }}
          onClick={onClose}>
          <motion.div initial={{ opacity: 0, scale: 0.88, y: 24 }} animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92 }} transition={{ type: "spring", bounce: 0.35 }}
            className="relative w-full max-w-sm rounded-3xl p-6 text-center"
            style={{ background: "linear-gradient(145deg, #17114a 0%, #5a160f 100%)", border: "2px solid rgba(249,168,37,0.55)", boxShadow: "0 24px 80px rgba(0,0,0,0.65), 0 0 70px rgba(249,168,37,0.2)" }}
            onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={onClose} aria-label="Cerrar" className="absolute right-3 top-3 p-2 rounded-full text-white/50 hover:text-white">
              <X className="w-4 h-4" />
            </button>
            <motion.div initial={{ scale: 0, rotate: -15 }} animate={{ scale: 1, rotate: 0 }}
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #f9a825, #dc2626)", boxShadow: "0 10px 30px rgba(249,168,37,0.4)" }}>
              <Trophy className="w-10 h-10 text-white" />
            </motion.div>
            <p className="text-[#f9a825] text-xs font-black uppercase tracking-widest mb-1">{t.ftue?.tutorialBadge ?? "Tutorial"}</p>
            <h2 className="text-2xl font-black text-white mb-2">{t.ftue?.unlockTitle ?? "¡Has desbloqueado STOP!"}</h2>
            <p className="text-white/75 text-sm leading-relaxed mb-5">{t.ftue?.unlockBody ?? "Ya conoces lo básico. Ahora tienes todo el juego a tu alcance: juega con amigos, compite y descubre todos los modos."}</p>
            <div className="grid grid-cols-2 gap-3 mb-3">
              <Link href="/multiplayer" onClick={onClose}>
                <motion.div whileTap={{ scale: 0.96 }} className="py-3 rounded-2xl font-black text-white" style={{ background: "rgba(255,255,255,0.10)", border: "1px solid rgba(255,255,255,0.16)" }}>
                  <Users className="w-5 h-5 mx-auto mb-1" /><span className="text-xs">{t.home?.multiplayer ?? "Multijugador"}</span>
                </motion.div>
              </Link>
              <Link href="/torneo" onClick={onClose}>
                <motion.div whileTap={{ scale: 0.96 }} className="py-3 rounded-2xl font-black text-white" style={{ background: "rgba(249,168,37,0.18)", border: "1px solid rgba(249,168,37,0.35)" }}>
                  <Trophy className="w-5 h-5 mx-auto mb-1 text-[#f9a825]" /><span className="text-xs">Torneo</span>
                </motion.div>
              </Link>
            </div>
            <button type="button" onClick={onClose} className="w-full py-3 rounded-2xl text-white/65 text-xs font-black">{t.game?.goHome ?? "Seguir jugando"}</button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
