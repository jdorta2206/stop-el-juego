import { useEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import type { HalloweenScare } from "@/lib/halloweenEvent";

function PhotographicHorror({ reduced }: { reduced: boolean }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let frame = 0;
    let raf = 0;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const w = Math.max(1, canvas.clientWidth);
      const h = Math.max(1, canvas.clientHeight);
      canvas.width = Math.floor(w * dpr);
      canvas.height = Math.floor(h * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    resize();
    window.addEventListener("resize", resize);

    const noise = document.createElement("canvas");
    noise.width = 180;
    noise.height = 180;
    const nctx = noise.getContext("2d");
    if (nctx) {
      const img = nctx.createImageData(noise.width, noise.height);
      for (let i = 0; i < img.data.length; i += 4) {
        const v = 70 + Math.random() * 95;
        img.data[i] = v;
        img.data[i + 1] = v * 0.96;
        img.data[i + 2] = v * 0.9;
        img.data[i + 3] = 18 + Math.random() * 25;
      }
      nctx.putImageData(img, 0, 0);
    }

    const draw = () => {
      frame += 1;
      const w = canvas.clientWidth;
      const h = canvas.clientHeight;
      const t = Math.min(frame / (reduced ? 80 : 48), 1);
      const pulse = reduced ? 0 : Math.sin(frame * 0.55) * (1 - t) * 0.018;
      const zoom = reduced ? 1 : 1.03 + t * 0.15 + pulse;

      ctx.save();
      ctx.clearRect(0, 0, w, h);
      ctx.translate(w / 2, h / 2);
      ctx.scale(zoom, zoom);
      ctx.translate(-w / 2, -h / 2);

      const bg = ctx.createRadialGradient(w * .5, h * .46, h * .05, w * .5, h * .5, h * .72);
      bg.addColorStop(0, "#160909");
      bg.addColorStop(.45, "#050303");
      bg.addColorStop(1, "#000");
      ctx.fillStyle = bg;
      ctx.fillRect(0, 0, w, h);

      const cx = w * .5;
      const cy = h * .5;
      const rx = w * .47;
      const ry = h * .60;

      ctx.save();
      ctx.beginPath();
      ctx.ellipse(cx, cy, rx, ry, 0, 0, Math.PI * 2);
      ctx.clip();

      const skin = ctx.createRadialGradient(cx - rx * .18, cy - ry * .34, ry * .05, cx, cy, ry * 1.05);
      skin.addColorStop(0, "#d7c8bc");
      skin.addColorStop(.28, "#8f817b");
      skin.addColorStop(.58, "#403936");
      skin.addColorStop(.82, "#161313");
      skin.addColorStop(1, "#030303");
      ctx.fillStyle = skin;
      ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);

      if (nctx) {
        ctx.globalAlpha = .42;
        ctx.globalCompositeOperation = "multiply";
        ctx.fillStyle = ctx.createPattern(noise, "repeat") || "#777";
        ctx.fillRect(cx - rx, cy - ry, rx * 2, ry * 2);
        ctx.globalCompositeOperation = "source-over";
        ctx.globalAlpha = 1;
      }

      const socket = (x: number, y: number, rw: number, rh: number, tilt: number) => {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(tilt);
        const g = ctx.createRadialGradient(0, 0, rh * .08, 0, 0, rh);
        g.addColorStop(0, "#000");
        g.addColorStop(.58, "#020202");
        g.addColorStop(.82, "#180404");
        g.addColorStop(1, "rgba(0,0,0,0)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(0, 0, rw, rh, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      };

      socket(cx - rx * .36, cy - ry * .18, rx * .28, ry * .20, -.10);
      socket(cx + rx * .36, cy - ry * .20, rx * .30, ry * .22, .12);

      const eye = (x: number, y: number, r: number, side: number) => {
        const g = ctx.createRadialGradient(x - r * .2, y - r * .2, r * .05, x, y, r);
        g.addColorStop(0, "#fff");
        g.addColorStop(.24, "#e8e0d5");
        g.addColorStop(.5, "#5e0505");
        g.addColorStop(.78, "#120000");
        g.addColorStop(1, "#000");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.ellipse(x, y, r * (side > 0 ? .95 : 1.08), r, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.ellipse(x + side * r * .16, y + r * .05, r * .25, r * .58, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "rgba(255,255,255,.8)";
        ctx.beginPath();
        ctx.arc(x - side * r * .08, y - r * .25, r * .07, 0, Math.PI * 2);
        ctx.fill();
      };

      eye(cx - rx * .35, cy - ry * .18, rx * .09, -1);
      eye(cx + rx * .36, cy - ry * .20, rx * .085, 1);

      const nose = ctx.createLinearGradient(cx - rx * .08, cy - ry * .05, cx + rx * .08, cy + ry * .18);
      nose.addColorStop(0, "rgba(20,10,10,.2)");
      nose.addColorStop(.5, "rgba(0,0,0,.8)");
      nose.addColorStop(1, "rgba(80,20,20,.25)");
      ctx.fillStyle = nose;
      ctx.beginPath();
      ctx.moveTo(cx - rx * .09, cy - ry * .03);
      ctx.lineTo(cx + rx * .09, cy - ry * .02);
      ctx.lineTo(cx + rx * .12, cy + ry * .22);
      ctx.lineTo(cx - rx * .13, cy + ry * .22);
      ctx.closePath();
      ctx.fill();

      const mouthY = cy + ry * .30;
      const mouth = ctx.createRadialGradient(cx, mouthY - ry * .02, 1, cx, mouthY, rx * .40);
      mouth.addColorStop(0, "#120000");
      mouth.addColorStop(.55, "#030000");
      mouth.addColorStop(1, "#000");
      ctx.fillStyle = mouth;
      ctx.beginPath();
      ctx.ellipse(cx, mouthY, rx * .42, ry * .25, 0, 0, Math.PI * 2);
      ctx.fill();

      ctx.strokeStyle = "rgba(170,20,20,.65)";
      ctx.lineWidth = Math.max(2, rx * .012);
      ctx.beginPath();
      ctx.moveTo(cx - rx * .38, mouthY - ry * .02);
      ctx.quadraticCurveTo(cx, mouthY + ry * .10, cx + rx * .40, mouthY - ry * .04);
      ctx.stroke();

      for (let i = 0; i < 13; i++) {
        const tx = cx - rx * .34 + i * rx * .056;
        const ty = mouthY - ry * .13 + (i % 2) * ry * .018;
        ctx.fillStyle = i % 3 === 0 ? "#c8c0b8" : "#e5ded6";
        ctx.beginPath();
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + rx * .025, ty + ry * .13);
        ctx.lineTo(tx + rx * .05, ty);
        ctx.closePath();
        ctx.fill();
      }

      ctx.strokeStyle = "rgba(45,0,0,.8)";
      ctx.lineWidth = Math.max(1, rx * .008);
      for (let i = 0; i < 9; i++) {
        const x = cx - rx * .40 + i * rx * .10;
        ctx.beginPath();
        ctx.moveTo(x, cy - ry * .54);
        ctx.bezierCurveTo(x - 8, cy - ry * .35, x + 7, cy - ry * .22, x - 3, cy - ry * .06);
        ctx.stroke();
      }

      ctx.restore();

      const vignette = ctx.createRadialGradient(cx, cy, h * .10, cx, cy, h * .70);
      vignette.addColorStop(0, "rgba(0,0,0,0)");
      vignette.addColorStop(.65, "rgba(0,0,0,.18)");
      vignette.addColorStop(1, "rgba(0,0,0,.95)");
      ctx.fillStyle = vignette;
      ctx.fillRect(0, 0, w, h);

      ctx.restore();

      if (frame < (reduced ? 82 : 105)) raf = requestAnimationFrame(draw);
    };

    raf = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
    };
  }, [reduced]);

  return <canvas ref={canvasRef} className="h-full w-full" aria-hidden="true" />;
}

function HorrorFace({ reduced }: { reduced: boolean }) {
  return <PhotographicHorror reduced={reduced} />;
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

    const impact = ctx.createOscillator();
    const impactGain = ctx.createGain();
    impact.type = "sine";
    impact.frequency.setValueAtTime(96, now);
    impact.frequency.exponentialRampToValueAtTime(34, now + 0.24);
    impactGain.gain.setValueAtTime(0.75, now);
    impactGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.32);
    impact.connect(impactGain).connect(master);
    impact.start(now);
    impact.stop(now + 0.34);

    const attack = ctx.createBufferSource();
    const attackBuffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.22), ctx.sampleRate);
    const attackData = attackBuffer.getChannelData(0);
    for (let i = 0; i < attackData.length; i++) {
      const t = i / attackData.length;
      attackData[i] = (Math.random() * 2 - 1) * Math.pow(1 - t, 2.2);
    }
    attack.buffer = attackBuffer;
    const attackFilter = ctx.createBiquadFilter();
    attackFilter.type = "bandpass";
    attackFilter.frequency.setValueAtTime(1800, now);
    attackFilter.Q.value = 0.75;
    const attackGain = ctx.createGain();
    attackGain.gain.setValueAtTime(0.55, now);
    attackGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);
    attack.connect(attackFilter).connect(attackGain).connect(master);
    attack.start(now);
    attack.stop(now + 0.22);

    const scream = ctx.createBufferSource();
    const duration = 1.12;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let low = 0;
    for (let i = 0; i < data.length; i++) {
      const t = i / data.length;
      const env = Math.pow(Math.sin(Math.PI * Math.min(1, t)), 0.55);
      const white = Math.random() * 2 - 1;
      low = low * 0.965 + white * 0.035;
      data[i] = (low * 0.75 + (white - low) * 0.25) * env;
    }
    scream.buffer = buffer;

    const formant1 = ctx.createBiquadFilter();
    formant1.type = "bandpass";
    formant1.Q.value = 7;
    formant1.frequency.setValueAtTime(520, now + 0.015);
    formant1.frequency.exponentialRampToValueAtTime(1050, now + 0.22);
    formant1.frequency.exponentialRampToValueAtTime(360, now + 0.98);

    const formant2 = ctx.createBiquadFilter();
    formant2.type = "bandpass";
    formant2.Q.value = 5;
    formant2.frequency.setValueAtTime(1250, now + 0.015);
    formant2.frequency.exponentialRampToValueAtTime(2450, now + 0.20);
    formant2.frequency.exponentialRampToValueAtTime(780, now + 0.98);

    const screamGain = ctx.createGain();
    screamGain.gain.setValueAtTime(0.0001, now);
    screamGain.gain.exponentialRampToValueAtTime(0.58, now + 0.035);
    screamGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.08);
    scream.connect(formant1).connect(screamGain);
    scream.connect(formant2).connect(screamGain);
    screamGain.connect(master);
    scream.start(now + 0.01);
    scream.stop(now + duration);

    window.setTimeout(() => { try { void ctx.close(); } catch {} }, 1400);
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
          <HorrorFace reduced={reduced} />
        </div>
      </div>
    </motion.div>
  );
}
