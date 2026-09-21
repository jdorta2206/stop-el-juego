import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

export function HalloweenScareOverlay({ scare, onDone }: { scare: HalloweenScare; onDone?: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.72, rotate: -4 }}
      animate={{ opacity: 1, scale: [1, 1.04, 1], rotate: [0, 2, -1, 0] }}
      exit={{ opacity: 0, scale: 1.12 }}
      transition={{ duration: 0.45 }}
      onClick={onDone}
      className="fixed inset-0 z-[120] flex items-center justify-center p-6 cursor-pointer"
      style={{ background: "rgba(0,0,0,0.76)", backdropFilter: "blur(3px)" }}
      role="alert"
      aria-live="assertive"
    >
      <div className="text-center select-none">
        <motion.div
          animate={{ scale: [1, 1.18, 1] }}
          transition={{ duration: 0.7, repeat: 2 }}
          className="text-[7rem] sm:text-[10rem] leading-none drop-shadow-[0_0_35px_rgba(168,85,247,0.7)]"
        >
          {scare.emoji}
        </motion.div>
        <p className="mt-5 text-3xl sm:text-5xl font-black text-white tracking-tight">{scare.title}</p>
        <p className="mt-2 text-sm sm:text-lg font-bold text-white/70">{scare.text}</p>
        <p className="mt-6 text-[10px] uppercase tracking-[0.25em] text-white/35">Halloween 2026</p>
      </div>
    </motion.div>
  );
}
