import { useEffect } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

function HorrorFace({ id }: { id: HalloweenScare["id"] }) {
  const accent = id === "spider" ? "#6ee7b7" : id === "vampire" ? "#dc2626" : "#f8fafc";
  return (
    <div className="relative w-[82vw] max-w-[430px] aspect-[0.82]">
      <motion.div aria-hidden className="absolute inset-0 rounded-[48%_52%_44%_56%] overflow-hidden"
        style={{ background: "radial-gradient(circle at 50% 38%, #2a2a2a 0%, #070707 42%, #000 72%)", boxShadow: "0 0 80px rgba(255,0,0,.22), inset 0 0 55px rgba(255,255,255,.05)", filter: "contrast(1.45)" }}
        animate={{ x: [0, -5, 6, -2, 0], scale: [0.92, 1.06, 1] }} transition={{ duration: 0.75, times: [0, 0.18, 1] }}>
        <div className="absolute left-[18%] top-[29%] w-[24%] h-[14%] rounded-[50%] rotate-[10deg]" style={{ background: accent, boxShadow: "0 0 28px " + accent }} />
        <div className="absolute right-[18%] top-[29%] w-[24%] h-[14%] rounded-[50%] rotate-[-10deg]" style={{ background: accent, boxShadow: "0 0 28px " + accent }} />
        <div className="absolute left-[28%] top-[50%] w-[44%] h-[31%] rounded-[0_0_50%_50%]" style={{ background: "#050505", border: "3px solid rgba(255,255,255,.12)", boxShadow: "inset 0 -18px 0 #000" }} />
        <div className="absolute left-[34%] top-[54%] w-[7%] h-[18%] bg-white/80 rotate-[8deg]" />
        <div className="absolute left-[47%] top-[55%] w-[7%] h-[22%] bg-white/80 rotate-[-4deg]" />
        <div className="absolute left-[60%] top-[53%] w-[7%] h-[17%] bg-white/80 rotate-[7deg]" />
        <div className="absolute inset-x-[8%] bottom-[8%] h-[18%] opacity-60" style={{ background: "repeating-linear-gradient(170deg, transparent 0 8px, rgba(185,28,28,.8) 9px 11px, transparent 12px 18px)" }} />
      </motion.div>
      <motion.div className="absolute inset-0 pointer-events-none mix-blend-screen opacity-80" style={{ background: "repeating-linear-gradient(0deg, transparent 0 5px, rgba(255,255,255,.09) 6px 7px)" }} animate={{ x: [-8, 8, -3, 0], opacity: [0, 1, 0.3, 0] }} transition={{ duration: 0.42, times: [0, 0.2, 0.55, 1] }} />
    </div>
  );
}

export function HalloweenScareOverlay({ scare, onDone }: { scare: HalloweenScare; onDone?: () => void }) {
  useEffect(() => {
    try { navigator.vibrate?.([35, 45, 90]); } catch {}
    let ctx: AudioContext | null = null;
    try {
      ctx = new AudioContext(); const now = ctx.currentTime;
      const gain = ctx.createGain(); const osc = ctx.createOscillator(); const sub = ctx.createOscillator();
      gain.gain.setValueAtTime(0.0001, now); gain.gain.exponentialRampToValueAtTime(0.22, now + 0.025); gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.75);
      osc.type = "sawtooth"; osc.frequency.setValueAtTime(155, now); osc.frequency.exponentialRampToValueAtTime(52, now + 0.62);
      sub.type = "sine"; sub.frequency.setValueAtTime(70, now); sub.frequency.exponentialRampToValueAtTime(34, now + 0.7);
      osc.connect(gain); sub.connect(gain); gain.connect(ctx.destination); osc.start(now); sub.start(now); osc.stop(now + 0.8); sub.stop(now + 0.8);
      window.setTimeout(() => { void ctx?.close(); }, 1000);
    } catch {}
    const done = window.setTimeout(() => onDone?.(), 1450);
    return () => { window.clearTimeout(done); try { void ctx?.close(); } catch {} };
  }, [onDone]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: [0, 1, 1, 0], scale: [1.08, 1, 1.02, 1.16] }} exit={{ opacity: 0 }} transition={{ duration: 1.45, times: [0, 0.07, 0.72, 1], ease: "easeOut" }} className="fixed inset-0 z-[120] pointer-events-none overflow-hidden select-none" style={{ background: "radial-gradient(circle at center, rgba(120,0,0,.15), rgba(0,0,0,.93) 58%, #000)" }} role="alert" aria-live="assertive">
      <motion.div className="absolute inset-0" animate={{ opacity: [0, .85, .25, .7, 0], x: [0, -7, 8, -3, 0] }} transition={{ duration: 0.65, times: [0, .12, .3, .52, 1] }} style={{ background: "repeating-linear-gradient(0deg, rgba(255,255,255,.08) 0 1px, transparent 1px 5px), linear-gradient(90deg, transparent 0 47%, rgba(255,0,0,.35) 48% 52%, transparent 53%)" }} />
      <div className="absolute inset-0 flex items-center justify-center"><HorrorFace id={scare.id} /></div>
      <motion.div className="absolute inset-x-0 bottom-[11%] text-center font-black uppercase tracking-[0.28em] text-white/80 text-[10px]" animate={{ opacity: [0, 1, 0] }} transition={{ duration: 0.8, delay: 0.15 }}>{scare.text}</motion.div>
      <motion.div className="absolute inset-0 bg-red-900/20 mix-blend-multiply" animate={{ opacity: [0, .65, 0, .35, 0] }} transition={{ duration: 0.5 }} />
    </motion.div>
  );
}