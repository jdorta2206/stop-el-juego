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
        className="absolute left-[4%] right-[4%] top-[3%] bottom-[-2%] overflow-hidden rounded-[46%_54%_49%_51%] border border-white/10"
        style={{
          background: "radial-gradient(ellipse at 48% 24%,rgba(255,255,255,.55),transparent 12%),radial-gradient(ellipse at 28% 52%,rgba(70,0,0,.45),transparent 23%),radial-gradient(ellipse at 72% 54%,rgba(90,0,0,.4),transparent 25%),radial-gradient(ellipse at 50% 72%,rgba(0,0,0,.72),transparent 34%),linear-gradient(105deg,#d4d4d4,#f1f1f1 25%,#9b9b9b 52%,#e7e7e7 72%,#666)",
          boxShadow: "0 0 90px rgba(0,0,0,.95),0 0 150px rgba(120,0,0,.38)",
        }}
        animate={reduced ? { scale: 1 } : { scale: [1.12,1,1.035,1.015], x: [14,0,-5,0], rotate: [1.5,0,-.7,0] }}
        transition={{ duration: .72, ease: "easeOut" }}
      >
        <div className="absolute left-[8%] top-[20%] h-[32%] w-[36%] rounded-[50%] bg-[radial-gradient(ellipse,#020202_0%,#090909_42%,#420000_65%,transparent_76%)] rotate-[-8deg]" />
        <div className="absolute right-[8%] top-[19%] h-[33%] w-[36%] rounded-[50%] bg-[radial-gradient(ellipse,#020202_0%,#090909_42%,#420000_65%,transparent_76%)] rotate-[8deg]" />
        <motion.div className="absolute left-[25%] top-[34%] h-[7%] w-[8%] rounded-full bg-white shadow-[0_0_18px_6px_rgba(255,255,255,.7)]" animate={reduced ? {} : { scale: [1,.35,1] }} transition={{ duration: .38, repeat: 1 }} />
        <motion.div className="absolute right-[25%] top-[32%] h-[7%] w-[8%] rounded-full bg-white shadow-[0_0_18px_6px_rgba(255,255,255,.7)]" animate={reduced ? {} : { scale: [1,.35,1] }} transition={{ duration: .38, repeat: 1 }} />
        <div className="absolute left-[17%] top-[7%] h-[35%] w-[20%] bg-[radial-gradient(ellipse,#650000,#180000_55%,transparent_72%)] rotate-[-22deg]" />
        <div className="absolute right-[17%] top-[7%] h-[35%] w-[20%] bg-[radial-gradient(ellipse,#650000,#180000_55%,transparent_72%)] rotate-[22deg]" />
        <div className="absolute left-[43%] top-[39%] h-[12%] w-[15%] rounded-[48%] bg-[radial-gradient(circle_at_40%_35%,#551010,#210000_58%,#030303)] shadow-[0_0_28px_rgba(150,0,0,.4)]" />
        <motion.div className="absolute left-[11%] right-[11%] top-[51%] h-[40%] overflow-hidden rounded-[48%_52%_55%_45%] border-[5px] border-black bg-[radial-gradient(ellipse_at_50%_15%,#3a0000,#050000_48%,#000)]" animate={reduced ? { scale: 1 } : { scale: [1,1.08,.99,1.04,1] }} transition={{ duration: .58 }}>
          <div className="absolute left-[7%] right-[7%] top-[8%] h-[17%] rounded-full bg-[#e9e9e4]" />
          <div className="absolute left-[10%] right-[10%] top-[33%] h-[15%] rounded-full bg-[#cfcfca]" />
          <div className="absolute left-[12%] right-[12%] bottom-[8%] h-[28%] bg-gradient-to-b from-red-950 to-black" />
          {Array.from({ length: 9 }).map((_,i)=><span key={i} className="absolute top-[10%] h-[17%] w-[7%] bg-[#eee] shadow-[0_2px_4px_rgba(0,0,0,.7)]" style={{ left: (11+i*9.5)+"%", transform: "rotate("+(i%2?5:-4)+"deg)" }} />)}
        </motion.div>
        <div className="absolute left-[8%] top-[52%] h-[30%] w-[3px] rotate-[28deg] bg-red-950/80" />
        <div className="absolute right-[8%] top-[49%] h-[31%] w-[3px] rotate-[-25deg] bg-red-950/80" />
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
    master.gain.setValueAtTime(0.0001,now);
    master.gain.exponentialRampToValueAtTime(.72,now+.008);
    master.gain.exponentialRampToValueAtTime(.0001,now+1.35);
    master.connect(ctx.destination);

    const formant=ctx.createBiquadFilter();
    formant.type="bandpass"; formant.Q.value=5.5;
    formant.frequency.setValueAtTime(900,now);
    formant.frequency.exponentialRampToValueAtTime(1850,now+.16);
    formant.frequency.exponentialRampToValueAtTime(520,now+1.05);
    formant.connect(master);

    for(const [base,level] of [[185,.38],[370,.26],[555,.2],[740,.13]] as const){
      const osc=ctx.createOscillator(), g=ctx.createGain();
      osc.type="sawtooth";
      osc.frequency.setValueAtTime(base,now);
      osc.frequency.exponentialRampToValueAtTime(base*1.85,now+.16);
      osc.frequency.exponentialRampToValueAtTime(base*.62,now+1.12);
      g.gain.setValueAtTime(level,now);
      g.gain.exponentialRampToValueAtTime(.0001,now+1.25);
      osc.connect(g).connect(formant); osc.start(now); osc.stop(now+1.3);
    }

    const noise=ctx.createBufferSource();
    const buffer=ctx.createBuffer(1,Math.floor(ctx.sampleRate*1.25),ctx.sampleRate);
    const data=buffer.getChannelData(0);
    for(let i=0;i<data.length;i++){const env=Math.min(1,i/(ctx.sampleRate*.018))*Math.max(0,1-i/data.length);data[i]=(Math.random()*2-1)*env;}
    noise.buffer=buffer;
    const nf=ctx.createBiquadFilter(); nf.type="bandpass"; nf.frequency.setValueAtTime(1450,now); nf.frequency.exponentialRampToValueAtTime(700,now+1.05); nf.Q.value=2.2;
    const ng=ctx.createGain(); ng.gain.setValueAtTime(.34,now); ng.gain.exponentialRampToValueAtTime(.0001,now+1.18);
    noise.connect(nf).connect(ng).connect(master); noise.start(now); noise.stop(now+1.22);

    const impact=ctx.createOscillator(), ig=ctx.createGain();
    impact.type="sine"; impact.frequency.setValueAtTime(72,now); impact.frequency.exponentialRampToValueAtTime(28,now+.28);
    ig.gain.setValueAtTime(.85,now); ig.gain.exponentialRampToValueAtTime(.0001,now+.36);
    impact.connect(ig).connect(master); impact.start(now); impact.stop(now+.4);
    window.setTimeout(()=>{try{void ctx.close();}catch{}},1600);
  }catch{}
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
