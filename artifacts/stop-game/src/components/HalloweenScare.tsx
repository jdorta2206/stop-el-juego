import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";
import { HALLOWEEN_SCARE_IMAGE } from "@/lib/halloweenScareImage";

function HorrorFace({ reduced, variant }: { reduced: boolean; variant: string }) {
  return (
    <motion.div
      className="absolute inset-0 overflow-hidden bg-black"
      animate={reduced ? { scale: 1 } : { scale: [1.08, 1, 1.04, 1.08] }}
      transition={reduced ? { duration: 1.2 } : { duration: 1.7, times: [0, .12, .72, 1], ease: "easeOut" }}
    >
      <motion.img
        src={HALLOWEEN_SCARE_IMAGE}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="absolute inset-0 h-full w-full object-cover select-none pointer-events-none"
        style={{ filter: reduced ? "brightness(.55) contrast(1.05) saturate(.75)" : "brightness(.7) contrast(1.25) saturate(1.2)" }}
        animate={reduced ? { scale: 1 } : { scale: [1.12, 1, 1.08], x: [0, -10, 7, 0], y: [0, 4, -3, 0] }}
        transition={reduced ? { duration: 1.2 } : { duration: 1.7, times: [0, .15, .72], ease: "easeOut" }}
      />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,transparent_22%,rgba(0,0,0,.78)_78%,#000_100%)] pointer-events-none" />
      {!reduced && <motion.div className="absolute inset-0 bg-red-950/30 pointer-events-none" animate={{ opacity: [0, .7, .18, 0] }} transition={{ duration: .62, times: [0, .12, .42, 1] }} />}
    </motion.div>
  );
}

function playScream() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.95, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.75);

    // Short room impulse: makes the scream feel like it is happening in a space,
    // instead of sounding like a synthetic beep.
    const convolver = ctx.createConvolver();
    const impulse = ctx.createBuffer(2, Math.floor(ctx.sampleRate * 0.65), ctx.sampleRate);
    for (let ch = 0; ch < impulse.numberOfChannels; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < data.length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / data.length, 3.8);
      }
    }
    convolver.buffer = impulse;
    const dry = ctx.createGain();
    const wet = ctx.createGain();
    dry.gain.value = 0.78;
    wet.gain.value = 0.34;
    master.connect(dry).connect(ctx.destination);
    master.connect(convolver).connect(wet).connect(ctx.destination);

    // Human-like scream bed: shaped noise carries the breath/voice texture.
    const noiseBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.55), ctx.sampleRate);
    const noiseData = noiseBuffer.getChannelData(0);
    for (let i = 0; i < noiseData.length; i++) {
      const t = i / noiseData.length;
      const attack = Math.min(1, t * 34);
      const release = Math.pow(1 - t, 1.8);
      noiseData[i] = (Math.random() * 2 - 1) * attack * release;
    }
    const noise = ctx.createBufferSource();
    noise.buffer = noiseBuffer;

    const screamFilter = ctx.createBiquadFilter();
    screamFilter.type = "bandpass";
    screamFilter.Q.value = 2.2;
    screamFilter.frequency.setValueAtTime(1250, now);
    screamFilter.frequency.exponentialRampToValueAtTime(2450, now + 0.24);
    screamFilter.frequency.exponentialRampToValueAtTime(1550, now + 0.72);
    screamFilter.frequency.exponentialRampToValueAtTime(900, now + 1.42);

    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.72, now + 0.035);
    noiseGain.gain.exponentialRampToValueAtTime(0.34, now + 0.82);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    noise.connect(screamFilter).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + 1.58);

    // Vocal resonance: restrained sine components so the result is voiced,
    // not a buzzy sawtooth or a rhythmic "spring" sound.
    const voice = ctx.createOscillator();
    voice.type = "sine";
    voice.frequency.setValueAtTime(205, now);
    voice.frequency.exponentialRampToValueAtTime(390, now + 0.22);
    voice.frequency.exponentialRampToValueAtTime(275, now + 0.72);
    voice.frequency.exponentialRampToValueAtTime(170, now + 1.38);
    const voiceGain = ctx.createGain();
    voiceGain.gain.setValueAtTime(0.0001, now);
    voiceGain.gain.exponentialRampToValueAtTime(0.32, now + 0.04);
    voiceGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
    voice.connect(voiceGain).connect(master);
    voice.start(now);
    voice.stop(now + 1.5);

    const formant1 = ctx.createBiquadFilter();
    formant1.type = "bandpass";
    formant1.Q.value = 7;
    formant1.frequency.setValueAtTime(520, now);
    formant1.frequency.exponentialRampToValueAtTime(1180, now + 0.24);
    formant1.frequency.exponentialRampToValueAtTime(430, now + 1.35);

    const formant2 = ctx.createBiquadFilter();
    formant2.type = "bandpass";
    formant2.Q.value = 8;
    formant2.frequency.setValueAtTime(1450, now);
    formant2.frequency.exponentialRampToValueAtTime(3050, now + 0.22);
    formant2.frequency.exponentialRampToValueAtTime(1150, now + 1.3);

    const voiced = ctx.createGain();
    voiced.gain.value = 0.8;
    voice.connect(formant1).connect(voiced);
    voice.connect(formant2).connect(voiced);
    voiced.connect(master);

    // Very short breath/impact at the exact reveal frame.
    const attackBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.11), ctx.sampleRate);
    const attackData = attackBuffer.getChannelData(0);
    for (let i = 0; i < attackData.length; i++) {
      const t = i / attackData.length;
      attackData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 3.2);
    }
    const attack = ctx.createBufferSource();
    attack.buffer = attackBuffer;
    const attackFilter = ctx.createBiquadFilter();
    attackFilter.type = "bandpass";
    attackFilter.frequency.value = 1800;
    attackFilter.Q.value = 1.4;
    const attackGain = ctx.createGain();
    attackGain.gain.setValueAtTime(0.65, now);
    attackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.11);
    attack.connect(attackFilter).connect(attackGain).connect(master);
    attack.start(now);
    attack.stop(now + 0.12);

    window.setTimeout(() => { try { void ctx.close(); } catch {} }, 2200);
  } catch {}
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
    if (!reduced) {
      try { navigator.vibrate?.([30, 45, 85]); } catch {}
      if (!muted) playScream();
    }
    const done = window.setTimeout(() => onDone?.(), reduced ? 1350 : 1700);
    return () => window.clearTimeout(done);
  }, [onDone, muted, reduced]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={reduced
        ? { opacity: [0, .96, 0] }
        : { opacity: [0, 1, 1, 0], scale: [1.16, 1, 1.02, 1.08] }}
      exit={{ opacity: 0 }}
      transition={reduced
        ? { duration: 1.35, times: [0, .22, 1], ease: "easeOut" }
        : { duration: 1.7, times: [0, .06, .72, 1], ease: "easeOut" }}
      className="fixed inset-0 z-[120] pointer-events-none overflow-hidden select-none"
      style={{
        background: reduced
          ? "radial-gradient(circle, rgba(80,0,0,.12), rgba(0,0,0,.94) 58%, #000)"
          : "radial-gradient(circle, rgba(150,0,0,.34), rgba(0,0,0,.96) 58%, #000)",
      }}
      role="alert"
      aria-live="assertive"
    >
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={reduced ? { opacity: 0 } : { opacity: [0, .72, 0] }}
        transition={{ duration: .72, times: [0, .25, 1] }}
        style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0 1px, transparent 1px 6px)" }}
      />
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="relative h-full w-full max-w-none">
          <HorrorFace reduced={reduced} variant={scare.variant} />
        </div>
      </div>
    </motion.div>
  );
}
