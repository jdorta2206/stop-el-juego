import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

function Ghost({ reduced }: { reduced: boolean }) {
  return (
    <div className="relative h-full w-full">
      <motion.div
        className="absolute left-[10%] right-[10%] top-[8%] bottom-[0] rounded-[48%_52%_22%_22%] bg-gradient-to-b from-slate-200 via-slate-500 to-slate-950 shadow-[0_0_90px_rgba(220,230,255,.42)]"
        animate={reduced ? { y: 0 } : { y: [18, -4, 6, 0], x: [0, -8, 8, 0] }}
        transition={{ duration: .72, ease: "easeOut" }}
      >
        <div className="absolute left-[14%] top-[62%] h-[28%] w-[22%] rounded-full bg-black/80" />
        <div className="absolute right-[14%] top-[62%] h-[28%] w-[22%] rounded-full bg-black/80" />
        <div className="absolute left-[29%] top-[30%] h-[17%] w-[19%] rounded-full bg-black shadow-[0_0_26px_#f8fafc]" />
        <div className="absolute right-[29%] top-[30%] h-[17%] w-[19%] rounded-full bg-black shadow-[0_0_26px_#f8fafc]" />
        <motion.div
          className="absolute left-[38%] top-[51%] h-[24%] w-[24%] rounded-[50%] bg-black"
          animate={reduced ? { scale: 1 } : { scale: [1, 1.18, .96, 1.08, 1] }}
          transition={{ duration: .55 }}
        />
        <div className="absolute bottom-[-3%] left-[5%] right-[5%] h-[18%] bg-slate-950 [clip-path:polygon(0_0,8%_55%,18%_20%,29%_70%,40%_18%,51%_68%,62%_20%,74%_66%,86%_18%,100%_55%,100%_100%,0_100%)]" />
      </motion.div>
    </div>
  );
}

function Clown({ reduced }: { reduced: boolean }) {
  return (
    <div className="relative h-full w-full">
      <motion.div
        className="absolute left-[7%] right-[7%] top-[7%] bottom-[2%] rounded-[48%_52%_45%_55%] bg-gradient-to-b from-zinc-100 via-zinc-300 to-zinc-800 shadow-[0_0_110px_rgba(255,20,20,.5)]"
        animate={reduced ? { y: 0 } : { y: [16, -3, 5, 0], rotate: [0, -2, 2, 0], scale: [1, 1.05, .99, 1.03] }}
        transition={{ duration: .7, ease: "easeOut" }}
      >
        <div className="absolute -left-[7%] top-[10%] h-[28%] w-[23%] rounded-full bg-black shadow-[0_0_30px_#111]" />
        <div className="absolute -right-[7%] top-[10%] h-[28%] w-[23%] rounded-full bg-black shadow-[0_0_30px_#111]" />
        <div className="absolute left-[10%] top-[19%] h-[28%] w-[30%] bg-black [clip-path:polygon(50%_0,100%_100%,0_100%)] shadow-[0_0_18px_rgba(255,0,0,.8)]" />
        <div className="absolute right-[10%] top-[19%] h-[28%] w-[30%] bg-black [clip-path:polygon(50%_0,100%_100%,0_100%)] shadow-[0_0_18px_rgba(255,0,0,.8)]" />
        <div className="absolute left-[21%] top-[30%] h-[11%] w-[18%] rounded-full bg-red-500 shadow-[0_0_26px_#f00]" />
        <div className="absolute right-[21%] top-[30%] h-[11%] w-[18%] rounded-full bg-red-500 shadow-[0_0_26px_#f00]" />
        <div className="absolute left-[43%] top-[34%] h-[15%] w-[14%] rounded-full bg-red-700 shadow-[0_0_25px_#f00]" />
        <motion.div
          className="absolute left-[16%] right-[16%] top-[49%] h-[34%] rounded-[45%_45%_55%_55%] bg-black border-4 border-red-900 overflow-hidden"
          animate={reduced ? { scale: 1 } : { scale: [1, 1.12, .98, 1.06, 1] }}
          transition={{ duration: .6 }}
        >
          <div className="absolute left-[8%] right-[8%] top-[15%] h-[11%] bg-white" />
          <div className="absolute left-[13%] right-[13%] top-[36%] h-[10%] bg-white" />
          <div className="absolute inset-x-[12%] bottom-[8%] h-[30%] bg-red-950 [clip-path:polygon(0_0,10%_100%,20%_0,30%_100%,40%_0,50%_100%,60%_0,70%_100%,80%_0,90%_100%,100%_0,100%_100%,0_100%)]" />
        </motion.div>
        <div className="absolute left-[34%] right-[34%] top-[-7%] h-[17%] rounded-t-full bg-red-900 shadow-[0_0_35px_rgba(255,0,0,.45)]" />
      </motion.div>
    </div>
  );
}

function HorrorFace({ id, reduced }: { id: HalloweenScare["id"]; reduced: boolean }) {
  if (id === "ghost") return <Ghost reduced={reduced} />;
  if (id === "clown") return <Clown reduced={reduced} />;

  return (
    <div className="relative h-full w-full">
      <motion.div
        className="absolute inset-[7%] rounded-[46%] bg-black shadow-[0_0_120px_rgba(255,0,0,.55)]"
        animate={reduced ? { scale: 1 } : { scale: [1, 1.14, .98, 1.05, 1], x: [0, -10, 9, -4, 0] }}
        transition={{ duration: .7 }}
      >
        <div className="absolute left-[17%] top-[28%] h-[16%] w-[26%] rounded-full bg-red-100 shadow-[0_0_35px_#f00]" />
        <div className="absolute right-[17%] top-[28%] h-[16%] w-[26%] rounded-full bg-red-100 shadow-[0_0_35px_#f00]" />
        <div className="absolute left-[25%] right-[25%] top-[50%] h-[34%] rounded-[0_0_50%_50%] bg-black border-4 border-red-900" />
      </motion.div>
    </div>
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
    master.gain.exponentialRampToValueAtTime(0.9, now + 0.012);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.15);
    master.connect(ctx.destination);

    // A short human-like shriek: two detuned formant bands with a fast pitch rise/fall.
    for (const [freq, gainValue] of [[530, 0.32], [760, 0.22], [1040, 0.13]] as const) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.9, now + 0.13);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.48, now + 0.92);
      gain.gain.setValueAtTime(gainValue, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.08);
      osc.connect(gain).connect(master);
      osc.start(now);
      osc.stop(now + 1.12);
    }

    // The attack is a sharp impact, not a spring/bounce sound.
    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = "sine";
    impact.frequency.setValueAtTime(115, now);
    impact.frequency.exponentialRampToValueAtTime(38, now + 0.38);
    impactGain.gain.setValueAtTime(0.75, now);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    impact.connect(impactGain).connect(master);
    impact.start(now);
    impact.stop(now + 0.45);

    const noise = ctx.createBufferSource();
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.9), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    noise.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = "bandpass";
    filter.frequency.setValueAtTime(2100, now);
    filter.frequency.exponentialRampToValueAtTime(650, now + 0.75);
    filter.Q.value = 1.1;
    const ng = ctx.createGain();
    ng.gain.setValueAtTime(0.32, now);
    ng.gain.exponentialRampToValueAtTime(0.0001, now + 0.82);
    noise.connect(filter).connect(ng).connect(master);
    noise.start(now);
    noise.stop(now + 0.86);

    window.setTimeout(() => { try { void ctx.close(); } catch {} }, 1500);
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
        <div className="relative h-[76vh] w-[92vw] max-w-[560px]">
          <HorrorFace id={scare.id} reduced={reduced} />
        </div>
      </div>
      <motion.div
        className="absolute inset-x-0 bottom-[9%] text-center font-black uppercase tracking-[0.3em] text-white text-xs pointer-events-none"
        animate={{ opacity: [0, 1, 0] }}
        transition={{ duration: .95, delay: .08 }}
      >
        {scare.title}
      </motion.div>
    </motion.div>
  );
}
