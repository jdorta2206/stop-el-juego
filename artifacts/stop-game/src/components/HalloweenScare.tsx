import { useEffect, useRef, useState } from "react";
import { HALLOWEEN_SCARE_ASSETS } from "@/lib/halloweenScareAssets";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";
import {
  HALLOWEEN_SCARE_IMAGE,
  preloadHalloweenScareImage,
} from "@/lib/halloweenScareImage";
import {
  playHalloweenScareAudio,
  preloadHalloweenScareAudio,
  stopHalloweenScareAudio,
} from "@/lib/halloweenScareAudio";

/**
 * Real bundled scare visual.
 *
 * This deliberately contains no CSS-drawn face/eyes/mouth. The visual is the
 * local real image asset from halloweenScareImage.ts, decoded before use.
 */
function RealScareVisual({ reduced, scareId }: { reduced: boolean; scareId: keyof typeof HALLOWEEN_SCARE_ASSETS }) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-black pointer-events-none"
      initial={{ scale: reduced ? 1 : 1.06 }}
      animate={reduced ? { scale: 1 } : { scale: [1.06, 1, 1.035] }}
      transition={
        reduced
          ? { duration: 1.25, ease: "easeOut" }
          : { duration: 1.5, times: [0, 0.22, 1], ease: "easeOut" }
      }
    >
      <motion.img
        src={HALLOWEEN_SCARE_ASSETS[scareId]}
        alt=""
        aria-hidden="true"
        draggable={false}
        decoding="async"
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
        style={{
          filter: reduced
            ? "brightness(.62) contrast(1.04) saturate(.7)"
            : "brightness(.68) contrast(1.28) saturate(1.12)",
        }}
        animate={
          reduced
            ? { scale: 1 }
            : { scale: [1.08, 1, 1.045], x: [0, -5, 3], y: [0, 2, -1] }
        }
        transition={
          reduced
            ? { duration: 1.25, ease: "easeOut" }
            : { duration: 1.5, times: [0, 0.22, 1], ease: "easeOut" }
        }
      />
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_20%,rgba(0,0,0,.52)_70%,rgba(0,0,0,.92)_100%)]"
      />
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
  const [osReducedMotion, setOsReducedMotion] = useState(false);\n  const onDoneRef = useRef(onDone);\n  useEffect(() => { onDoneRef.current = onDone; }, [onDone]);

  // Preload BOTH real assets as soon as the overlay component is mounted.
  // The image decoder and audio element are therefore warm before playback.
  useEffect(() => {
    void preloadHalloweenScareImage();
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
    try {
      (document.activeElement as HTMLElement | null)?.blur();
    } catch {}
    try {
      window.scrollTo(0, 0);
    } catch {}
    try {
      navigator.vibrate?.([30, 45, 85]);
    } catch {}

    if (!muted && !reduced) {
      void playHalloweenScareAudio();
    }

    // About 1.5s total; reduced-motion remains shorter and calmer.
    const duration = reduced ? 1350 : 1500;
    const done = window.setTimeout(() => {
      stopHalloweenScareAudio();
      onDoneRef.current?.();
    }, duration);

    return () => {
      window.clearTimeout(done);
      // Never let the scream/audio bleed into normal gameplay if the overlay
      // unmounts early or a new scare replaces the current one.
      stopHalloweenScareAudio();
    };
  }, [scare.id, muted, reduced]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={reduced ? { opacity: [0, 0.98, 0] } : { opacity: [0, 1, 1, 0] }}
      exit={{ opacity: 0 }}
      transition={
        reduced
          ? { duration: 1.35, times: [0, 0.22, 1], ease: "easeOut" }
          : { duration: 1.5, times: [0, 0.08, 0.82, 1], ease: "easeOut" }
      }
      className="fixed inset-0 z-[120] pointer-events-none overflow-hidden select-none"
      style={{ background: reduced ? "rgba(0,0,0,.92)" : "rgba(0,0,0,.96)" }}
      role="alert"
      aria-live="assertive"
    >
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative h-full w-full max-w-none pointer-events-none">
          <RealScareVisual reduced={reduced} scareId={scare.id as keyof typeof HALLOWEEN_SCARE_ASSETS} />
        </div>
      </div>
    </motion.div>
  );
}
