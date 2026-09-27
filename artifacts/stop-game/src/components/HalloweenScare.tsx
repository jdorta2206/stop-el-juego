import { useEffect } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

function HorrorFace({ id }: { id: HalloweenScare["id"] }) {
  const palette: Record<HalloweenScare["id"], { accent: string; eye: string; mouth: string }> = {
    ghost: { accent: "#e5e7eb", eye: "#ffffff", mouth: "#020617" },
    spider: { accent: "#22c55e", eye: "#d9f99d", mouth: "#020617" },
    skull: { accent: "#f8fafc", eye: "#ef4444", mouth: "#000000" },
    pumpkin: { accent: "#f97316", eye: "#fde047", mouth: "#080400" },
    vampire: { accent: "#dc2626", eye: "#ff1f1f", mouth: "#050505" },
  };
  const p = palette[id];

  return (
    <motion.div
      className="relative w-[92vw] max-w-[560px] aspect-[0.82]"
      initial={{ scale: 0.15, opacity: 0, rotate: -5 }}
      animate={{ scale: [0.15, 1.22, 1.03, 1.08], opacity: [0, 1, 1, 1], rotate: [-5, 2, -1, 0] }}
      transition={{ duration: 0.48, times: [0, 0.22, 0.55, 1], ease: "easeOut" }}
    >
      <motion.div
        aria-hidden
        className="absolute inset-0 rounded-[46%_54%_42%_58%] overflow-hidden"
        style={{
          background: "radial-gradient(circle at 50% 38%, #353535 0%, #090909 38%, #000 72%)",
          boxShadow: "0 0 120px rgba(255,0,0,.45), inset 0 0 70px rgba(255,255,255,.08)",
          filter: "contrast(1.6) brightness(0.92)",
        }}
        animate={{ x: [0, -12, 14, -7, 4, 0], scale: [1, 1.08, 0.98, 1.04, 1] }}
        transition={{ duration: 0.7, times: [0, .16, .32, .52, .7, 1] }}
      >
        <div className="absolute left-[16%] top-[27%] w-[27%] h-[16%] rounded-[50%] rotate-[12deg]"
          style={{ background: p.eye, boxShadow: "0 0 34px " + p.accent }} />
        <div className="absolute right-[16%] top-[27%] w-[27%] h-[16%] rounded-[50%] rotate-[-12deg]"
          style={{ background: p.eye, boxShadow: "0 0 34px " + p.accent }} />
        <div className="absolute left-[25%] top-[49%] w-[50%] h-[34%] rounded-[0_0_50%_50%]"
          style={{ background: p.mouth, border: "4px solid rgba(255,255,255,.18)", boxShadow: "inset 0 -24px 0 #000, 0 0 25px rgba(0,0,0,.9)" }} />
        {[34, 46, 58].map((left, i) => (
          <div key={i} className="absolute top-[53%] w-[7%] h-[22%] bg-white/90"
            style={{ left: left + "%", transform: `rotate(${i % 2 ? -4 : 7}deg)`, clipPath: "polygon(0 0,100% 0,82% 100%,18% 100%)" }} />
        ))}
        <div className="absolute inset-x-[6%] bottom-[5%] h-[22%] opacity-75"
          style={{ background: "repeating-linear-gradient(170deg, transparent 0 7px, rgba(185,28,28,.9) 8px 11px, transparent 12px 18px)" }} />
        {id === "spider" && (
          <>
            <div className="absolute -left-[5%] top-[5%] w-[32%] h-[1px] bg-green-200/70 rotate-[28deg]" />
            <div className="absolute -right-[5%] top-[8%] w-[34%] h-[1px] bg-green-200/70 rotate-[-28deg]" />
          </>
        )}
      </motion.div>

      <motion.div
        className="absolute inset-[-8%] pointer-events-none"
        animate={{ scale: [0.7, 1.12, 0.95], opacity: [0, .75, 0] }}
        transition={{ duration: 0.5 }}
        style={{ borderRadius: "50%", boxShadow: "0 0 80px rgba(255,0,0,.6)" }}
      />
      <motion.div
        className="absolute inset-0 pointer-events-none mix-blend-screen"
        style={{ background: "repeating-linear-gradient(0deg, transparent 0 4px, rgba(255,255,255,.10) 5px 6px)" }}
        animate={{ x: [-18, 18, -8, 0], opacity: [0, 1, .35, 0] }}
        transition={{ duration: 0.42, times: [0, .18, .55, 1] }}
      />
    </motion.div>
  );
}

function playRoar() {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    if (ctx.state === "suspended") void ctx.resume();

    const master = ctx.createGain();
    master.gain.setValueAtTime(0.0001, now);
    master.gain.exponentialRampToValueAtTime(0.62, now + 0.025);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    master.connect(ctx.destination);

    const roar = ctx.createOscillator();
    roar.type = "sawtooth";
    roar.frequency.setValueAtTime(185, now);
    roar.frequency.exponentialRampToValueAtTime(42, now + 1.0);
    roar.connect(master);
    roar.start(now);
    roar.stop(now + 1.2);

    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.setValueAtTime(92, now);
    sub.frequency.exponentialRampToValueAtTime(28, now + 1.1);
    const subGain = ctx.createGain();
    subGain.gain.value = 0.75;
    sub.connect(subGain).connect(master);
    sub.start(now);
    sub.stop(now + 1.2);

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.8), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.value = 850;
    filter.Q.value = 0.7;
    const noiseGain = ctx.createGain();
    noiseGain.gain.setValueAtTime(0.45, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.8);
    noise.connect(filter).connect(noiseGain).connect(master);
    noise.start(now);
    noise.stop(now + 0.82);

    window.setTimeout(() => { try { void ctx.close(); } catch {} }, 1500);
  } catch {}
}

export function HalloweenScareOverlay({ scare, onDone }: { scare: HalloweenScare; onDone?: () => void }) {
  useEffect(() => {
    try { navigator.vibrate?.([35, 35, 80, 45, 120]); } catch {}
    playRoar();
    const done = window.setTimeout(() => onDone?.(), 1550);
    return () => window.clearTimeout(done);
  }, [onDone]);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: [0, 1, 1, 0], scale: [1.15, 1, 1.02, 1.18] }}
      exit={{ opacity: 0 }}
      transition={{ duration: 1.55, times: [0, 0.05, 0.72, 1], ease: "easeOut" }}
      className="fixed inset-0 z-[120] pointer-events-none overflow-hidden select-none"
      style={{ background: "radial-gradient(circle at center, rgba(160,0,0,.28), rgba(0,0,0,.94) 56%, #000)" }}
      role="alert"
      aria-live="assertive"
    >
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0, .95, .2, .8, 0], x: [0, -14, 16, -7, 0] }}
        transition={{ duration: 0.62, times: [0, .12, .3, .55, 1] }}
        style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,.10) 0 1px, transparent 1px 5px), linear-gradient(90deg, transparent 0 45%, rgba(255,0,0,.42) 46% 54%, transparent 55%)" }}
      />
      <div className="absolute inset-0 flex items-center justify-center">
        <HorrorFace id={scare.id} />
      </div>
      <motion.div
        className="absolute inset-x-0 bottom-[10%] text-center font-black uppercase tracking-[0.3em] text-white text-xs"
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: 0.9, delay: 0.08 }}
      >
        {scare.title}
      </motion.div>
      <motion.div
        className="absolute inset-0 bg-red-900/25 mix-blend-multiply"
        animate={{ opacity: [0, .7, 0, .4, 0] }}
        transition={{ duration: 0.55 }}
      />
    </motion.div>
  );
}
