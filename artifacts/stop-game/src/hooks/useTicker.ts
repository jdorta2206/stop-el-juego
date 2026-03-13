import { useRef, useEffect, useCallback } from "react";

type Phase = "normal" | "hurry" | "panic" | "off";

function getPhase(timeLeft: number, total: number): Phase {
  if (timeLeft <= 0) return "off";
  if (timeLeft <= 10) return "panic";
  if (timeLeft <= 25) return "hurry";
  return "normal";
}

// Generates a single sharp tick click using Web Audio API
function playTick(ctx: AudioContext, pitch: number = 1, volume: number = 0.35) {
  const now = ctx.currentTime;

  // Body — low thud
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.frequency.setValueAtTime(180 * pitch, now);
  osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);
  gain.gain.setValueAtTime(volume, now);
  gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
  osc.connect(gain);
  gain.connect(ctx.destination);
  osc.start(now);
  osc.stop(now + 0.06);

  // Click transient — high snap
  const noise = ctx.createOscillator();
  const noiseGain = ctx.createGain();
  noise.type = "square";
  noise.frequency.setValueAtTime(900 * pitch, now);
  noiseGain.gain.setValueAtTime(volume * 0.4, now);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.02);
  noise.connect(noiseGain);
  noiseGain.connect(ctx.destination);
  noise.start(now);
  noise.stop(now + 0.02);
}

// Plays a quick ascending 3-note ding for urgency cues
function playDing(ctx: AudioContext) {
  const now = ctx.currentTime;
  [660, 880, 1100].forEach((freq, i) => {
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, now + i * 0.12);
    gain.gain.linearRampToValueAtTime(0.18, now + i * 0.12 + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.12 + 0.25);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now + i * 0.12);
    osc.stop(now + i * 0.12 + 0.28);
  });
}

export function useTicker(timeLeft: number, total: number, active: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const prevPhaseRef = useRef<Phase>("off");
  const mutedRef = useRef(false);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new AudioContext();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const stopTicking = useCallback(() => {
    if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
  }, []);

  const startTicking = useCallback((phase: Phase) => {
    stopTicking();
    if (phase === "off" || mutedRef.current) return;

    const ctx = getCtx();

    const intervalMs =
      phase === "panic"  ? 400 :
      phase === "hurry"  ? 650 :
                           1000;

    const pitch =
      phase === "panic"  ? 1.5 :
      phase === "hurry"  ? 1.15 :
                           1.0;

    const volume =
      phase === "panic"  ? 0.5 :
      phase === "hurry"  ? 0.4 :
                           0.3;

    // Play immediately, then on interval
    playTick(ctx, pitch, volume);
    intervalRef.current = setInterval(() => {
      if (mutedRef.current) return;
      playTick(ctx, pitch, volume);
    }, intervalMs);
  }, [getCtx, stopTicking]);

  useEffect(() => {
    if (!active) {
      stopTicking();
      prevPhaseRef.current = "off";
      return;
    }

    const phase = getPhase(timeLeft, total);

    // Phase changed — restart with new rhythm and optionally play ding
    if (phase !== prevPhaseRef.current) {
      if (phase === "hurry" || phase === "panic") {
        try { playDing(getCtx()); } catch {}
      }
      startTicking(phase);
      prevPhaseRef.current = phase;
    }

    // Stop when time runs out
    if (phase === "off") {
      stopTicking();
    }
  }, [timeLeft, active, total, startTicking, stopTicking, getCtx]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      stopTicking();
      ctxRef.current?.close();
    };
  }, [stopTicking]);

  const toggleMute = useCallback(() => {
    mutedRef.current = !mutedRef.current;
    if (mutedRef.current) {
      stopTicking();
    }
    return mutedRef.current;
  }, [stopTicking]);

  return { toggleMute };
}
