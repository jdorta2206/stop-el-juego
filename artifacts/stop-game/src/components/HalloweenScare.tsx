import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

function PhotographicHorror({ reduced, variant }: { reduced: boolean; variant: string }) {
  const seed = variant === "ghost" ? 11 : variant === "spider" ? 22 : variant === "skull" ? 33 : variant === "pumpkin" ? 44 : 55;

  return (
    <motion.svg
      viewBox="0 0 900 1200"
      preserveAspectRatio="xMidYMid slice"
      className="h-full w-full"
      aria-hidden="true"
      animate={reduced ? { scale: 1 } : { scale: [1.14, 1.01, 1.08, 1.14] }}
      transition={reduced ? { duration: 1.2 } : { duration: 1.62, times: [0, .16, .72, 1], ease: "easeOut" }}
    >
      <defs>
        <radialGradient id="night" cx="50%" cy="45%">
          <stop offset="0%" stopColor="#211719" />
          <stop offset="48%" stopColor="#050304" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <radialGradient id="skinReal" cx="36%" cy="24%">
          <stop offset="0%" stopColor="#d5c7bf" />
          <stop offset="23%" stopColor="#9b8881" />
          <stop offset="52%" stopColor="#4a3938" />
          <stop offset="78%" stopColor="#1a1012" />
          <stop offset="100%" stopColor="#020202" />
        </radialGradient>
        <radialGradient id="socket" cx="50%" cy="50%">
          <stop offset="0%" stopColor="#000" />
          <stop offset="72%" stopColor="#090305" />
          <stop offset="100%" stopColor="#3c1718" />
        </radialGradient>
        <radialGradient id="iris" cx="42%" cy="35%">
          <stop offset="0%" stopColor="#fffdf2" />
          <stop offset="16%" stopColor="#fff" />
          <stop offset="31%" stopColor="#e7b6a9" />
          <stop offset="46%" stopColor="#721316" />
          <stop offset="100%" stopColor="#070000" />
        </radialGradient>
        <radialGradient id="mouthReal" cx="50%" cy="30%">
          <stop offset="0%" stopColor="#260406" />
          <stop offset="36%" stopColor="#070001" />
          <stop offset="100%" stopColor="#000" />
        </radialGradient>
        <linearGradient id="blood" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#a20d13" />
          <stop offset="100%" stopColor="#160001" />
        </linearGradient>
        <filter id="grain">
          <feTurbulence type="fractalNoise" baseFrequency=".075" numOctaves="5" seed={seed} />
          <feColorMatrix values="1 0 0 0 0  0 .72 0 0 0  0 0 .72 0 0  0 0 0 .34 0" />
          <feBlend in="SourceGraphic" mode="multiply" />
        </filter>
        <filter id="softBlur"><feGaussianBlur stdDeviation="12" /></filter>
        <filter id="eyeGlow"><feGaussianBlur stdDeviation="5" result="b" /><feMerge><feMergeNode in="b" /><feMergeNode in="SourceGraphic" /></feMerge></filter>
        <filter id="faceWarp">
          <feTurbulence type="fractalNoise" baseFrequency=".012" numOctaves="2" seed={seed + 7} result="n" />
          <feDisplacementMap in="SourceGraphic" in2="n" scale={reduced ? 2 : 5} />
        </filter>
        <clipPath id="portraitClip"><ellipse cx="450" cy="635" rx="430" ry="650" /></clipPath>
      </defs>

      <rect width="900" height="1200" fill="url(#night)" />

      {/* Extreme close-up: almost photographic rather than a cartoon face. */}
      <ellipse cx="450" cy="650" rx="445" ry="665" fill="#000" opacity=".95" filter="url(#softBlur)" />
      <g filter="url(#faceWarp)">
        <ellipse cx="450" cy="635" rx="430" ry="650" fill="url(#skinReal)" />
        <g clipPath="url(#portraitClip)" filter="url(#grain)">
          {/* asymmetrical brow/forehead */}
          <path d="M30 390 C120 210 255 125 425 190 C520 226 595 145 760 235 C875 298 915 430 910 535 L900 0 L0 0Z" fill="#080607" opacity=".76" />
          <path d="M85 438 C185 330 292 302 380 354 C305 430 245 468 115 492Z" fill="#070305" opacity=".96" />
          <path d="M520 356 C625 298 748 330 825 440 L792 498 C695 462 612 438 535 427Z" fill="#060204" opacity=".98" />

          {/* deep eye sockets */}
          <path d="M85 470 C150 390 295 380 382 457 C349 570 270 622 155 592 C94 572 65 524 85 470Z" fill="url(#socket)" />
          <path d="M515 455 C605 365 770 390 838 490 C846 558 805 610 720 620 C620 630 548 565 515 455Z" fill="url(#socket)" />

          {/* eyes: tiny pupils, wet and fixed */}
          <ellipse cx="270" cy="505" rx="72" ry="64" fill="url(#iris)" filter="url(#eyeGlow)" />
          <ellipse cx="675" cy="500" rx="52" ry="48" fill="url(#iris)" filter="url(#eyeGlow)" />
          <ellipse cx="276" cy="509" rx="16" ry="35" fill="#000" />
          <ellipse cx="679" cy="505" rx="12" ry="27" fill="#000" />
          <circle cx="250" cy="482" r="10" fill="#fff" opacity=".95" />
          <circle cx="661" cy="486" r="7" fill="#fff" opacity=".9" />
          <path d="M165 435 C225 398 310 402 370 448" fill="none" stroke="#140a0c" strokeWidth="28" strokeLinecap="round" />
          <path d="M575 430 C650 392 760 414 810 466" fill="none" stroke="#12090b" strokeWidth="30" strokeLinecap="round" />

          {/* collapsed nose / human silhouette */}
          <path d="M410 470 C390 560 365 660 388 720 C405 762 463 775 503 739 C531 713 525 664 502 620 L486 486 C466 452 432 448 410 470Z" fill="#1a1113" opacity=".88" />
          <path d="M388 717 C420 696 478 694 510 720 C490 770 410 778 388 717Z" fill="#050304" />

          {/* unnatural open mouth */}
          <path d="M185 790 C250 705 365 692 462 730 C560 692 690 720 760 815 C735 1010 620 1074 465 1035 C305 1072 185 995 185 790Z" fill="url(#mouthReal)" stroke="#4b080c" strokeWidth="20" />
          <path d="M205 806 C300 758 378 775 455 798 C540 760 650 770 740 825" fill="none" stroke="#b21920" strokeWidth="24" opacity=".75" />

          {/* irregular teeth, not a cartoon grid */}
          <path d="M238 802 L265 875 L292 805 L321 887 L348 804 L378 892 L408 804 L440 900 L468 805 L500 889 L530 800 L563 882 L592 798 L625 864 L653 804 L683 858" fill="none" stroke="#ded8ca" strokeWidth="24" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M275 980 C350 946 575 950 665 975" fill="none" stroke="#5f1114" strokeWidth="15" opacity=".75" />

          {/* cracks, veins and wet blood trails */}
          <g fill="none" stroke="#251011" strokeLinecap="round">
            <path d="M145 250 L190 330 L162 405 L215 456" strokeWidth="10" />
            <path d="M760 250 L705 340 L748 420 L695 478" strokeWidth="9" />
            <path d="M352 170 L390 252 L360 330" strokeWidth="8" />
            <path d="M560 180 L525 265 L555 340" strokeWidth="8" />
            <path d="M118 590 C165 655 140 715 170 760" strokeWidth="7" />
            <path d="M785 600 C735 675 770 735 735 790" strokeWidth="8" />
          </g>
          <path d="M225 610 C208 700 250 742 222 835 C214 865 224 887 239 904" fill="none" stroke="url(#blood)" strokeWidth="13" opacity=".9" />
          <path d="M690 605 C708 690 670 748 700 842 C708 870 696 900 681 922" fill="none" stroke="url(#blood)" strokeWidth="11" opacity=".82" />

          {/* saliva threads */}
          <path d="M300 910 C304 946 297 965 304 992 M594 912 C590 946 598 968 590 1000" stroke="#b8b0a8" strokeWidth="5" opacity=".48" />
        </g>
      </g>

      {/* hard vignette + film grain lines: no emojis, no cartoon symbols */}
      <rect width="900" height="1200" fill="none" stroke="#000" strokeWidth="190" opacity=".82" />
      {!reduced && (
        <motion.g animate={{ opacity: [0, .2, 0], x: [0, -5, 4, 0] }} transition={{ duration: .42, repeat: 2 }}>
          <path d="M0 285 H900 M0 289 H900 M0 672 H900 M0 676 H900 M0 930 H900 M0 934 H900" stroke="#fff" strokeWidth="2" opacity=".12" />
        </motion.g>
      )}
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
