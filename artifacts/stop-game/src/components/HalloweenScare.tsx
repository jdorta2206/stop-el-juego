import { useEffect, useRef, useState } from "react";
import { HALLOWEEN_SCARE_ASSETS, preloadHalloweenScareAssets } from "@/lib/halloweenScareAssets";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";
import {
  playHalloweenScareAudio,
  preloadHalloweenScareAudio,
  stopHalloweenScareAudio,
} from "@/lib/halloweenScareAudio";

/**
 * Real scare visual selected randomly from the Halloween asset set.
 *
 * This deliberately contains no CSS-drawn face/eyes/mouth. The visual is the
 * No CSS-drawn face, SVG face or emoji is used for the scare itself.
 */
function RealScareVisual({ reduced, scareId }: { reduced: boolean; scareId: keyof typeof HALLOWEEN_SCARE_ASSETS }) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-black pointer-events-none touch-none"
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
  const [osReducedMotion, setOsReducedMotion] = useState(false);
  const onDoneRef = useRef(onDone);
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  useEffect(() => {
    onDoneRef.current = onDone;
  }, [onDone]);

  // Preload BOTH real assets as soon as the overlay component is mounted.
  // The image decoder and audio element are therefore warm before playback.
  useEffect(() => {
    void preloadHalloweenScareAssets();
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
    // The Android keyboard belongs to the OS and cannot be painted over by a
    // web/TWA layer. During the scare we intentionally dismiss it so the real
    // scare can occupy the complete available viewport, then restore the exact
    // input focus when the scare finishes.
    const activeElement = document.activeElement;
    if (activeElement instanceof HTMLElement) {
      restoreFocusRef.current = activeElement;
      activeElement.blur();
    }
    try {
      const virtualKeyboard = (navigator as Navigator & {
        virtualKeyboard?: { hide?: () => void };
      }).virtualKeyboard;
      virtualKeyboard?.hide?.();
    } catch {}

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    try {
      navigator.vibrate?.([30, 45, 85]);
    } catch {}

    if (!muted && !reduced) {
      void playHalloweenScareAudio(scare.id as Parameters<typeof playHalloweenScareAudio>[0]);
    }

    // About 1.5s total; reduced-motion remains shorter and calmer.
    const duration = reduced ? 1350 : 1500;
    const done = window.setTimeout(() => {
      stopHalloweenScareAudio(scare.id as Parameters<typeof playHalloweenScareAudio>[0]);
      document.body.style.overflow = previousOverflow;
      const element = restoreFocusRef.current;
      restoreFocusRef.current = null;
      onDoneRef.current?.();
      // Return focus after the overlay is gone so the player can continue
      // typing immediately without having to tap the answer field again.
      requestAnimationFrame(() => {
        try {
          element?.focus({ preventScroll: true });
        } catch {
          element?.focus();
        }
      });
    }, duration);

    return () => {
      window.clearTimeout(done);
      document.body.style.overflow = previousOverflow;
      // Never let the scream/audio bleed into normal gameplay if the overlay
      // unmounts early or a new scare replaces the current one.
      stopHalloweenScareAudio(scare.id as Parameters<typeof playHalloweenScareAudio>[0]);
      const element = restoreFocusRef.current;
      restoreFocusRef.current = null;
      if (element) {
        requestAnimationFrame(() => {
          try {
            element.focus({ preventScroll: true });
          } catch {
            element.focus();
          }
        });
      }
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
      className="fixed inset-0 z-[2147483647] pointer-events-auto overflow-hidden select-none touch-none overscroll-none"
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
