import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";
import { HALLOWEEN_SCARE_IMAGE } from "@/lib/halloweenScareImage";
import { playHalloweenScareAudio, preloadHalloweenScareAudio } from "@/lib/halloweenScareAudio";

function HorrorFace({ reduced }: { reduced: boolean }) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-black"
      animate={reduced ? { scale: 1 } : { scale: [1.08, 1, 1.05, 1.08] }}
      transition={reduced
        ? { duration: 1.25, ease: "easeOut" }
        : { duration: 1.65, times: [0, 0.16, 0.72, 1], ease: "easeOut" }}
    >
      <motion.img
        src={HALLOWEEN_SCARE_IMAGE}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
        style={{
          filter: reduced
            ? "brightness(.62) contrast(1.04) saturate(.7)"
            : "brightness(.68) contrast(1.28) saturate(1.12)",
        }}
        animate={reduced
          ? { scale: 1 }
          : { scale: [1.13, 1, 1.07], x: [0, -8, 6, 0], y: [0, 3, -2, 0] }}
        transition={reduced
          ? { duration: 1.25, ease: "easeOut" }
          : { duration: 1.65, times: [0, 0.18, 0.72, 1], ease: "easeOut" }}
      />
      <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_18%,rgba(0,0,0,.58)_68%,#000_100%)]" />
      {!reduced && (
        <motion.div
          className="absolute inset-0 pointer-events-none bg-black/20"
          animate={{ opacity: [0, 0.38, 0.18] }}
          transition={{ duration: 0.95, times: [0, 0.2, 1], ease: "easeOut" }}
        />
      )}
    </motion.div>
  );
}

export function HalloweenScareOverlay({
  scare,
  onDone,
  muted = false,
  reducedEffects = false,
}: {
  scare: HalloweenScare;
  onDone?: () => void;
  muted?: boolean;
  reducedEffects?: boolean;
}) {
  const [osReducedMotion, setOsReducedMotion] = useState(false);

  useEffect(() => {
    preloadHalloweenScareAudio();
    try {
      const media = window.matchMedia("(prefers-reduced-motion: reduce)");
      const update = () => setOsReducedMotion(media.matches);
      update();
      media.addEventListener?.("change", update);
      return () => media.removeEventListener?.("change", update);
    } catch {}
  }, []);

  const reduced = reducedEffects || osReducedMotion;

  useEffect(() => {
    try { (document.activeElement as HTMLElement | null)?.blur(); } catch {}
    try { window.scrollTo(0, 0); } catch {}
    try { navigator.vibrate?.([30, 45, 85]); } catch {}
    if (!muted && !reduced) {
      void playHalloweenScareAudio();
    }
    const done = window.setTimeout(() => onDone?.(), reduced ? 1350 : 1650);
    return () => window.clearTimeout(done);
  }, [onDone, muted, reduced]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={reduced
        ? { opacity: [0, 0.98, 0] }
        : { opacity: [0, 1, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={reduced
        ? { duration: 1.35, times: [0, 0.22, 1], ease: "easeOut" }
        : { duration: 1.65, times: [0, 0.06, 0.76, 1], ease: "easeOut" }}
      className="fixed inset-0 z-[120] pointer-events-none overflow-hidden select-none"
      style={{ background: reduced ? "rgba(0,0,0,.92)" : "rgba(0,0,0,.96)" }}
      role="alert"
      aria-live="assertive"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative h-full w-full max-w-none pointer-events-none">
          <HorrorFace reduced={reduced} />
        </div>
      </div>
    </motion.div>
  );
}
