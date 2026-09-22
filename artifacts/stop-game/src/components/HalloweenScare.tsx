import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

function PhotographicHorror({ reduced, variant }: { reduced: boolean; variant: string }) {
  // Original realistic horror-clown portrait: pallid skin, cracked makeup,
  // predatory eyes and an unnaturally wide grin. It is not a copy of any
  // existing film character.
  const seed = variant === "clown" ? 71 : variant === "nightmare" ? 83 : variant === "specter" ? 97 : 109;

  return (
    <motion.svg
      viewBox="0 0 900 1200"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
      animate={reduced ? { scale: 1 } : { scale: [1.18, 1.01, 1.09, 1.16] }}
      transition={reduced ? { duration: 1.2 } : { duration: 1.62, times: [0, .12, .7, 1], ease: "easeOut" }}
    >
      <defs>
        <radialGradient id="clownNight"><stop offset="0%" stopColor="#171112"/><stop offset="58%" stopColor="#030203"/><stop offset="100%" stopColor="#000"/></radialGradient>
        <radialGradient id="clownSkin" cx="45%" cy="35%">
          <stop offset="0%" stopColor="#eee8df"/><stop offset="32%" stopColor="#c9c0b7"/><stop offset="63%" stopColor="#756761"/><stop offset="100%" stopColor="#171014"/>
        </radialGradient>
        <radialGradient id="clownSocket"><stop offset="0%" stopColor="#000"/><stop offset="78%" stopColor="#090305"/><stop offset="100%" stopColor="#381016"/></radialGradient>
        <radialGradient id="clownIris"><stop offset="0%" stopColor="#fff"/><stop offset="18%" stopColor="#e7d5c7"/><stop offset="43%" stopColor="#9b171c"/><stop offset="100%" stopColor="#120001"/></radialGradient>
        <linearGradient id="clownBlood" x1="0" y1="0" x2="0" y2="1"><stop stopColor="#d00f19"/><stop offset="1" stopColor="#260004"/></linearGradient>
        <filter id="clownGrain"><feTurbulence type="fractalNoise" baseFrequency=".085" numOctaves="5" seed={seed}/><feColorMatrix values="1 0 0 0 0  0 .72 0 0 0  0 0 .72 0 0  0 0 0 .36 0"/><feBlend in="SourceGraphic" mode="multiply"/></filter>
        <filter id="clownWarp"><feTurbulence type="fractalNoise" baseFrequency=".014" numOctaves="2" seed={seed+3} result="n"/><feDisplacementMap in="SourceGraphic" in2="n" scale={reduced ? 2 : 6}/></filter>
        <filter id="clownBlur"><feGaussianBlur stdDeviation="14"/></filter>
        <filter id="clownGlow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
      </defs>

      <rect width="900" height="1200" fill="url(#clownNight)"/>
      <ellipse cx="450" cy="640" rx="430" ry="660" fill="#000" opacity=".92" filter="url(#clownBlur)"/>

      <g filter="url(#clownWarp)">
        <ellipse cx="450" cy="640" rx="405" ry="625" fill="url(#clownSkin)"/>

        <g filter="url(#clownGrain)">
          {/* Receding dark hair / clown silhouette */}
          <path d="M35 520 C20 250 130 35 310 115 C365 20 535 20 590 115 C780 40 900 255 865 520 L790 430 C755 300 690 245 600 250 C540 175 360 175 300 250 C205 250 135 330 110 465Z" fill="#090609"/>
          <path d="M70 300 C95 105 250 45 355 125 C300 160 265 245 235 335Z" fill="#17070b"/>
          <path d="M830 300 C805 105 650 45 545 125 C600 160 635 245 665 335Z" fill="#17070b"/>

          {/* cracked white makeup */}
          <path d="M165 395 C255 285 350 270 450 315 C550 270 650 285 735 395 L770 700 C690 770 600 790 450 770 C300 790 210 770 130 700Z" fill="#ddd7d0" opacity=".92"/>
          <path d="M200 365 C275 315 350 315 410 345 M490 345 C560 310 650 320 705 375" fill="none" stroke="#5b151b" strokeWidth="16" strokeLinecap="round"/>

          {/* black/red eye makeup, asymmetric */}
          <path d="M125 450 C180 365 305 355 405 445 C365 585 245 640 155 565 C120 535 110 490 125 450Z" fill="url(#clownSocket)"/>
          <path d="M495 440 C610 350 755 370 790 470 C800 555 720 625 610 600 C540 585 505 520 495 440Z" fill="url(#clownSocket)"/>
          <path d="M175 420 C230 345 320 345 390 405 L365 440 C295 405 235 405 185 460Z" fill="#120207"/>
          <path d="M520 405 C600 335 705 350 760 425 L730 465 C665 405 600 405 535 445Z" fill="#120207"/>

          {/* eyes: human-looking, fixed, wet */}
          <ellipse cx="285" cy="495" rx="58" ry="50" fill="url(#clownIris)" filter="url(#clownGlow)"/>
          <ellipse cx="650" cy="490" rx="50" ry="44" fill="url(#clownIris)" filter="url(#clownGlow)"/>
          <ellipse cx="292" cy="500" rx="12" ry="31" fill="#000"/>
          <ellipse cx="657" cy="494" rx="11" ry="28" fill="#000"/>
          <circle cx="268" cy="478" r="8" fill="#fff"/>
          <circle cx="640" cy="477" r="7" fill="#fff"/>

          {/* classic red vertical makeup marks */}
          {variant === "clown" && <path d="M208 395 C220 455 218 545 185 625" fill="none" stroke="#9e1017" strokeWidth="24" strokeLinecap="round"/>}
          {variant === "clown" && <path d="M690 392 C678 455 681 550 718 632" fill="none" stroke="#9e1017" strokeWidth="24" strokeLinecap="round"/>}

          {/* long red clown nose, wet and disturbing */}
          <ellipse cx="455" cy="625" rx={variant === "clown" ? 58 : 38} ry={variant === "clown" ? 52 : 28} fill={variant === "clown" ? "#8f1018" : "#26161a"} stroke="#3b0408" strokeWidth="13"/>
          <ellipse cx="438" cy="610" rx="14" ry="9" fill="#f08b86" opacity=".75"/>

          {/* smile makeup stretching past the real mouth */}
          <path d="M185 735 C280 655 365 690 450 735 C535 690 625 655 720 735" fill="none" stroke="#8f0d15" strokeWidth="31" strokeLinecap="round"/>
          <path d="M190 748 C275 690 355 715 450 760 C545 715 625 690 710 748" fill="none" stroke="#350206" strokeWidth="20" strokeLinecap="round"/>

          {/* huge black mouth with irregular human teeth */}
          <path d="M190 755 C275 690 365 715 450 765 C535 715 625 690 710 755 C690 940 590 1020 450 1015 C310 1020 210 940 190 755Z" fill="#020102" stroke="#5c080e" strokeWidth="18"/>
          <path d="M220 765 C305 735 365 760 450 800 C535 760 595 735 680 765" fill="none" stroke="#b4141c" strokeWidth="19"/>
          <g fill="#e2ddd0">
            <path d="M235 770 l28 94 30-90 25 102 30-100 28 110 30-112 30 118 30-120 30 110 30-108 29 98 30-92 29 82 26-75"/>
          </g>
          <path d="M280 930 C350 895 550 900 620 932" fill="none" stroke="#721018" strokeWidth="16"/>

          {/* cracked makeup, veins and blood */}
          <g fill="none" stroke="#3a1518" strokeLinecap="round">
            <path d="M155 270 L205 350 L175 420 L225 470" strokeWidth="9"/>
            <path d="M745 270 L695 350 L725 420 L675 470" strokeWidth="9"/>
            <path d="M360 205 L395 285 L365 345" strokeWidth="7"/>
            <path d="M540 205 L505 285 L535 345" strokeWidth="7"/>
            <path d="M115 650 C175 690 135 735 180 780" strokeWidth="8"/>
            <path d="M785 650 C725 690 765 735 720 780" strokeWidth="8"/>
          </g>
          <path d="M180 580 C165 680 220 715 205 850" fill="none" stroke="url(#clownBlood)" strokeWidth="12"/>
          <path d="M720 580 C735 680 680 715 695 850" fill="none" stroke="url(#clownBlood)" strokeWidth="12"/>

          {/* saliva */}<path d="M300 895 C300 945 292 975 305 1010 M600 895 C600 945 608 975 595 1010" stroke="#c9c2ba" strokeWidth="5" opacity=".5"/>
        </g>
      </g>

      <rect width="900" height="1200" fill="none" stroke="#000" strokeWidth="180" opacity=".86"/>
      {!reduced && <motion.g animate={{ opacity:[0,.28,0], x:[0,-7,5,0] }} transition={{ duration:.36, repeat:2 }}>
        <path d="M0 290H900 M0 294H900 M0 700H900 M0 704H900 M0 930H900 M0 934H900" stroke="#fff" strokeWidth="2" opacity=".13"/>
      </motion.g>}
    </motion.svg>
  );
}

function HorrorFace({ reduced, variant }: { reduced: boolean; variant: string }) {
  return <PhotographicHorror reduced={reduced} variant={variant} />;
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
        <div className="relative h-[76vh] w-[92vw] max-w-[560px]">
          <HorrorFace reduced={reduced} variant={scare.variant} />
        </div>
      </div>
    </motion.div>
  );
}
