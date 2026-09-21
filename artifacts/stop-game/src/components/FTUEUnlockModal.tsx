import { motion, AnimatePresence } from "framer-motion";
import { Trophy, Users, Swords, Sparkles } from "lucide-react";

interface FTUEUnlockModalProps {
  open: boolean;
  onClose: () => void;
}

export function FTUEUnlockModal({ open, onClose }: FTUEUnlockModalProps) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[105] flex items-center justify-center p-4"
          style={{ background: "rgba(6,3,24,0.9)", backdropFilter: "blur(10px)" }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.8, y: 24 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.8 }}
            transition={{ type: "spring", bounce: 0.45, duration: 0.65 }}
            className="w-full max-w-sm rounded-3xl p-6 text-center"
            style={{
              background: "linear-gradient(135deg, #111a5c 0%, #4a130f 100%)",
              border: "2px solid rgba(249,168,37,0.65)",
              boxShadow: "0 24px 70px rgba(0,0,0,0.7), 0 0 90px rgba(249,168,37,0.22)",
            }}
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.6, delay: 0.15 }}
              className="mx-auto w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: "linear-gradient(135deg, #f9a825, #dc2626)" }}
            >
              <Trophy className="w-11 h-11 text-white" fill="white" />
            </motion.div>

            <p className="text-[#f9a825] text-[10px] font-black uppercase tracking-[0.22em] mb-1">
              3 partidas completadas
            </p>
            <h2 className="text-3xl font-black text-white mb-2" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
              ¡Ya eres jugador!
            </h2>
            <p className="text-white/75 text-sm leading-relaxed mb-5">
              Ya conoces lo básico. Ahora puedes descubrir todo lo que STOP tiene preparado.
            </p>

            <div className="grid grid-cols-2 gap-2 mb-5 text-left">
              <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Users className="w-5 h-5 text-[#f9a825] mb-1" />
                <p className="text-white font-black text-sm">Multijugador</p>
                <p className="text-white/45 text-[10px]">Reta a tus amigos</p>
              </div>
              <div className="rounded-2xl p-3" style={{ background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)" }}>
                <Swords className="w-5 h-5 text-red-400 mb-1" />
                <p className="text-white font-black text-sm">Torneos</p>
                <p className="text-white/45 text-[10px]">Compite y escala</p>
              </div>
            </div>

            <div className="flex items-center justify-center gap-2 text-white/55 text-xs font-bold mb-5">
              <Sparkles className="w-4 h-4 text-[#f9a825]" />
              Nuevos modos, retos, ranking y colección ya disponibles
            </div>

            <motion.button
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
              ¡Descubrir STOP!
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
