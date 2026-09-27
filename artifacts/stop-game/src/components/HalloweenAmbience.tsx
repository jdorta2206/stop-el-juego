import { useEffect, useRef } from "react";

interface HalloweenAmbienceProps {
  active: boolean;
  muted: boolean;
}

/**
 * Procedural horror ambience. No GIF/video/audio file is downloaded.
 * Uses Web Audio oscillators + filtered noise and stays very quiet under the timer.
 */
export function HalloweenAmbience({ active, muted }: HalloweenAmbienceProps) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const timerRef = useRef<number | null>(null);

  useEffect(() => {
    const stop = () => {
      if (timerRef.current != null) {
        window.clearTimeout(timerRef.current);
        timerRef.current = null;
      }
      for (const node of nodesRef.current) {
        try { (node as any).stop?.(); } catch {}
        try { node.disconnect(); } catch {}
      }
      nodesRef.current = [];
      const ctx = ctxRef.current;
      if (ctx && ctx.state !== "closed") {
        try { void ctx.suspend(); } catch {}
      }
    };

    if (!active || muted) {
      stop();
      return;
    }

    let cancelled = false;

    const start = async () => {
      try {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (!AudioCtx) return;
        const ctx = ctxRef.current ?? new AudioCtx();
        ctxRef.current = ctx;
        if (ctx.state === "suspended") await ctx.resume();
        if (cancelled) return;

        const master = ctx.createGain();
        master.gain.value = 0.055;
        master.connect(ctx.destination);
        nodesRef.current.push(master);

        const low = ctx.createOscillator();
        const lowGain = ctx.createGain();
        low.type = "sine";
        low.frequency.setValueAtTime(48, ctx.currentTime);
        lowGain.gain.value = 0.75;
        low.connect(lowGain).connect(master);
        low.start();
        nodesRef.current.push(low);

        const drone = ctx.createOscillator();
        const droneGain = ctx.createGain();
        drone.type = "triangle";
        drone.frequency.setValueAtTime(92, ctx.currentTime);
        droneGain.gain.value = 0.18;
        drone.connect(droneGain).connect(master);
        drone.start();
        nodesRef.current.push(drone);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.type = "sine";
        lfo.frequency.value = 0.085;
        lfoGain.gain.value = 22;
        lfo.connect(lfoGain).connect(low.frequency);
        lfo.start();
        nodesRef.current.push(lfo);

        const schedulePulse = () => {
          if (cancelled || !ctxRef.current || ctxRef.current.state === "closed") return;
          const now = ctx.currentTime;
          const pulse = ctx.createOscillator();
          const pulseGain = ctx.createGain();
          pulse.type = "sine";
          pulse.frequency.setValueAtTime(180, now);
          pulse.frequency.exponentialRampToValueAtTime(72, now + 1.8);
          pulseGain.gain.setValueAtTime(0.0001, now);
          pulseGain.gain.exponentialRampToValueAtTime(0.045, now + 0.35);
          pulseGain.gain.exponentialRampToValueAtTime(0.0001, now + 1.8);
          pulse.connect(pulseGain).connect(master);
          pulse.start(now);
          pulse.stop(now + 1.9);
          timerRef.current = window.setTimeout(schedulePulse, 6500);
        };
        schedulePulse();
      } catch {
        // Audio is enhancement only; the game must continue normally.
      }
    };

    void start();

    return () => {
      cancelled = true;
      stop();
    };
  }, [active, muted]);

  return null;
}
