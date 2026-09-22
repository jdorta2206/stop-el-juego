import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

function PhotographicHorror({ reduced, variant }: { reduced: boolean; variant: string }) {
  const seed = variant === "ghost" ? 1 : variant === "spider" ? 2 : variant === "skull" ? 3 : variant === "pumpkin" ? 4 : 5;
  const face = [
    { skin: "#b8aaa2", shadow: "#241919", eye: "#d7f1ee", mouth: "#050000", crack: "#24100f" },
    { skin: "#8e8581", shadow: "#12090b", eye: "#f7f0df", mouth: "#010101", crack: "#160b0b" },
    { skin: "#c8b7ae", shadow: "#351313", eye: "#ffdfdf", mouth: "#020000", crack: "#3a1717" },
    { skin: "#66504a", shadow: "#170607", eye: "#ffb9a6", mouth: "#000", crack: "#28100e" },
    { skin: "#aaa09a", shadow: "#090607", eye: "#f4f7ff", mouth: "#020101", crack: "#201010" },
  ][(seed - 1) % 5];

  return (
    <motion.svg viewBox="0 0 900 1200" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden="true"
      animate={reduced ? { scale: 1 } : { scale: [1.08, 1, 1.035, 1.08] }}
      transition={reduced ? { duration: 1.2 } : { duration: 1.7, times: [0, .12, .7, 1], ease: "easeOut" }}>
      <defs>
        <radialGradient id="bg" cx="50%" cy="42%"><stop offset="0%" stopColor="#241010"/><stop offset="45%" stopColor="#080304"/><stop offset="100%" stopColor="#000"/></radialGradient>
        <radialGradient id="skin" cx="38%" cy="28%"><stop offset="0%" stopColor={face.skin}/><stop offset="38%" stopColor="#786c68"/><stop offset="72%" stopColor="#302728"/><stop offset="100%" stopColor="#070506"/></radialGradient>
        <radialGradient id="eye" cx="45%" cy="40%"><stop offset="0%" stopColor="#fff"/><stop offset="20%" stopColor={face.eye}/><stop offset="42%" stopColor="#8c1717"/><stop offset="100%" stopColor="#090000"/></radialGradient>
        <radialGradient id="mouth" cx="50%" cy="35%"><stop offset="0%" stopColor="#300707"/><stop offset="45%" stopColor={face.mouth}/><stop offset="100%" stopColor="#000"/></radialGradient>
        <filter id="rough"><feTurbulence type="fractalNoise" baseFrequency=".028" numOctaves="4" seed={seed}/><feDisplacementMap in="SourceGraphic" scale={reduced ? 3 : 9}/></filter>
        <filter id="blur"><feGaussianBlur stdDeviation="7"/></filter>
        <filter id="glow"><feGaussianBlur stdDeviation="9" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <clipPath id="faceClip"><ellipse cx="450" cy="570" rx="350" ry="515"/></clipPath>
      </defs>
      <rect width="900" height="1200" fill="url(#bg)"/>
      <ellipse cx="450" cy="600" rx="365" ry="535" fill="#000" opacity=".9" filter="url(#blur)"/>
      <g filter="url(#rough)">
        <ellipse cx="450" cy="570" rx="350" ry="515" fill="url(#skin)"/>
        <g clipPath="url(#faceClip)">
          <path d="M120 430 Q240 270 370 330 Q450 360 530 320 Q690 270 785 450 L760 1030 Q600 1130 450 1080 Q270 1130 120 1010Z" fill="#000" opacity=".3"/>
          <ellipse cx="292" cy="485" rx="132" ry="118" fill={face.shadow}/>
          <ellipse cx="610" cy="485" rx="138" ry="123" fill={face.shadow}/>
          <ellipse cx="295" cy="492" rx="45" ry="39" fill="url(#eye)" filter="url(#glow)"/>
          <ellipse cx="605" cy="490" rx="46" ry="40" fill="url(#eye)" filter="url(#glow)"/>
          <ellipse cx="302" cy="499" rx="13" ry="22" fill="#000"/>
          <ellipse cx="598" cy="497" rx="13" ry="22" fill="#000"/>
          <circle cx="286" cy="480" r="6" fill="#fff"/><circle cx="589" cy="478" r="6" fill="#fff"/>
          <path d="M405 500 C380 590 365 640 395 682 C420 704 480 704 507 676 C535 640 520 585 496 500 C475 470 425 470 405 500Z" fill="#171012" opacity=".9"/>
          <path d="M410 650 Q450 625 490 650 L505 705 Q450 735 395 705Z" fill="#050303"/>
          <ellipse cx="450" cy="820" rx="205" ry="158" fill="url(#mouth)" stroke="#5c1010" strokeWidth="12"/>
          <path d="M265 795 Q450 850 635 790" fill="none" stroke="#a51b1b" strokeWidth="18" opacity=".75"/>
          <path d="M285 855 Q450 910 615 850" fill="none" stroke="#5b0b0b" strokeWidth="10" opacity=".8"/>
          <path d="M300 790 l12 65 l13 -64 M345 798 l12 73 l13 -72 M390 803 l12 70 l13 -69 M435 805 l12 76 l13 -75 M480 803 l12 70 l13 -69 M525 798 l12 73 l13 -72 M570 792 l12 67 l13 -66" fill="#e6ded4" opacity=".96" stroke="#cfc6bc" strokeWidth="2"/>
          <g fill="none" stroke={face.crack} strokeWidth="8" strokeLinecap="round" opacity=".9">
            <path d="M190 270 L235 355 L205 420 L250 485 L220 560"/><path d="M700 300 L650 370 L690 445 L640 520 L675 600"/>
            <path d="M360 190 L395 260 L370 330"/><path d="M535 190 L505 265 L535 335"/>
          </g>
          <g stroke="#500d0d" strokeWidth="9" opacity=".8">
            <path d="M250 590 C230 690 260 735 245 790"/><path d="M655 575 C675 680 650 730 670 800"/>
            <path d="M330 920 C320 975 345 1005 330 1045"/><path d="M570 920 C585 975 560 1010 575 1050"/>
          </g>
        </g>
      </g>
      <rect width="900" height="1200" fill="none" stroke="#000" strokeWidth="130" opacity=".78"/>
      {!reduced && <motion.g animate={{ x: [0, -8, 6, 0] }} transition={{ duration: .55, repeat: 2 }}>
        <path d="M0 330 H900 M0 335 H900 M0 760 H900 M0 765 H900" stroke="#fff" strokeWidth="2" opacity=".08"/>
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
    master.gain.exponentialRampToValueAtTime(0.72, now + 0.018);
    master.gain.exponentialRampToValueAtTime(0.0001, now + 1.45);
    master.connect(ctx.destination);

    // Deep impact: short, non-rhythmic body under the scream.
    const sub = ctx.createOscillator();
    const subGain = ctx.createGain();
    sub.type = "sine";
    sub.frequency.setValueAtTime(78, now);
    sub.frequency.exponentialRampToValueAtTime(31, now + 0.34);
    subGain.gain.setValueAtTime(0.62, now);
    subGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.42);
    sub.connect(subGain).connect(master);
    sub.start(now);
    sub.stop(now + 0.45);

    // Voiced scream: several harmonics make it sound like a human voice
    // instead of broadband noise, while the pitch bends violently.
    const screamBus = ctx.createGain();
    screamBus.gain.setValueAtTime(0.0001, now);
    screamBus.gain.exponentialRampToValueAtTime(0.82, now + 0.045);
    screamBus.gain.setValueAtTime(0.68, now + 0.34);
    screamBus.gain.exponentialRampToValueAtTime(0.0001, now + 1.34);
    screamBus.connect(master);

    const fundamental = ctx.createOscillator();
    fundamental.type = "sawtooth";
    fundamental.frequency.setValueAtTime(185, now + 0.02);
    fundamental.frequency.exponentialRampToValueAtTime(365, now + 0.22);
    fundamental.frequency.exponentialRampToValueAtTime(235, now + 0.62);
    fundamental.frequency.exponentialRampToValueAtTime(155, now + 1.28);
    fundamental.connect(screamBus);
    fundamental.start(now);
    fundamental.stop(now + 1.36);

    const harmonic2 = ctx.createOscillator();
    harmonic2.type = "sawtooth";
    harmonic2.frequency.setValueAtTime(370, now + 0.02);
    harmonic2.frequency.exponentialRampToValueAtTime(730, now + 0.22);
    harmonic2.frequency.exponentialRampToValueAtTime(310, now + 1.28);
    const h2Gain = ctx.createGain();
    h2Gain.gain.value = 0.24;
    harmonic2.connect(h2Gain).connect(screamBus);
    harmonic2.start(now);
    harmonic2.stop(now + 1.36);

    // Moving vocal formants create the harsh "A/I" character of a scream.
    const formantLow = ctx.createBiquadFilter();
    formantLow.type = "bandpass";
    formantLow.Q.value = 5.5;
    formantLow.frequency.setValueAtTime(620, now);
    formantLow.frequency.exponentialRampToValueAtTime(1050, now + 0.24);
    formantLow.frequency.exponentialRampToValueAtTime(420, now + 1.22);

    const formantHigh = ctx.createBiquadFilter();
    formantHigh.type = "bandpass";
    formantHigh.Q.value = 6;
    formantHigh.frequency.setValueAtTime(1500, now);
    formantHigh.frequency.exponentialRampToValueAtTime(2800, now + 0.20);
    formantHigh.frequency.exponentialRampToValueAtTime(1100, now + 1.22);

    // Feed the voiced source through both formants and blend them.
    const voiceMix = ctx.createGain();
    voiceMix.gain.value = 0.9;
    screamBus.disconnect();
    fundamental.connect(formantLow).connect(voiceMix);
    fundamental.connect(formantHigh).connect(voiceMix);
    harmonic2.connect(formantHigh);
    voiceMix.connect(master);

    // A tiny burst of breath/noise at the attack sells the sudden scream.
    const breath = ctx.createBufferSource();
    const breathBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.16), ctx.sampleRate);
    const breathData = breathBuffer.getChannelData(0);
    for (let i = 0; i < breathData.length; i++) {
      const t = i / breathData.length;
      breathData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.8);
    }
    breath.buffer = breathBuffer;
    const breathFilter = ctx.createBiquadFilter();
    breathFilter.type = "bandpass";
    breathFilter.frequency.value = 2400;
    breathFilter.Q.value = 1.2;
    const breathGain = ctx.createGain();
    breathGain.gain.setValueAtTime(0.32, now);
    breathGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);
    breath.connect(breathFilter).connect(breathGain).connect(master);
    breath.start(now);
    breath.stop(now + 0.17);

    window.setTimeout(() => { try { void ctx.close(); } catch {} }, 1700);
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
