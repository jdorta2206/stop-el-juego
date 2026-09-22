import { useEffect, useRef } from "react";

interface HalloweenAmbienceProps {
  active: boolean;
  muted: boolean;
}

/**
 * Continuous Halloween tension bed. It intentionally stays subtle under gameplay:
 * low drone + dissonant harmonics + slow pulse + occasional distant texture.
 * No external media is downloaded.
 */
export function HalloweenAmbience({ active, muted }: HalloweenAmbienceProps) {
  const ctxRef = useRef<AudioContext | null>(null);
  const nodesRef = useRef<AudioNode[]>([]);
  const timersRef = useRef<number[]>([]);

  useEffect(() => {
    const stop = () => {
      for (const t of timersRef.current) window.clearTimeout(t);
      timersRef.current = [];
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
        master.gain.value = 0.075;
        master.connect(ctx.destination);
        nodesRef.current.push(master);

        const low = ctx.createOscillator();
        const lowGain = ctx.createGain();
        low.type = "sine";
        low.frequency.value = 42;
        lowGain.gain.value = 0.9;
        low.connect(lowGain).connect(master);
        low.start();
        nodesRef.current.push(low);

        const drone = ctx.createOscillator();
        const droneGain = ctx.createGain();
        drone.type = "sawtooth";
        drone.frequency.value = 67.2;
        droneGain.gain.value = 0.065;
        drone.connect(droneGain).connect(master);
        drone.start();
        nodesRef.current.push(drone);

        const tension = ctx.createOscillator();
        const tensionGain = ctx.createGain();
        tension.type = "triangle";
        tension.frequency.value = 71.5;
        tensionGain.gain.value = 0.075;
        tension.connect(tensionGain).connect(master);
        tension.start();
        nodesRef.current.push(tension);

        const lfo = ctx.createOscillator();
        const lfoGain = ctx.createGain();
        lfo.frequency.value = 0.035;
        lfoGain.gain.value = 9;
        lfo.connect(lfoGain).connect(low.frequency);
        lfo.start();
        nodesRef.current.push(lfo);

        const scheduleHeartbeat = () => {
          if (cancelled || ctx.state === "closed") return;
          const now = ctx.currentTime;
          const pulse = ctx.createOscillator();
          const gain = ctx.createGain();
          pulse.type = "sine";
          pulse.frequency.setValueAtTime(62, now);
          pulse.frequency.exponentialRampToValueAtTime(48, now + 0.42);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.14, now + 0.08);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.62);
          pulse.connect(gain).connect(master);
          pulse.start(now);
          pulse.stop(now + 0.68);
          timersRef.current.push(window.setTimeout(scheduleHeartbeat, 2600 + Math.random() * 2400));
        };
        scheduleHeartbeat();

        const scheduleWhisper = () => {
          if (cancelled || ctx.state === "closed") return;
          const now = ctx.currentTime;

          // A very soft, breath-like noise texture — not a melody or ringtone.
          const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 1.9), ctx.sampleRate);
          const data = buffer.getChannelData(0);
          for (let i = 0; i < data.length; i++) {
            const t = i / data.length;
            data[i] = (Math.random() * 2 - 1) * Math.pow(Math.sin(Math.PI * t), 1.6);
          }
          const source = ctx.createBufferSource();
          source.buffer = buffer;

          const filter = ctx.createBiquadFilter();
          filter.type = "bandpass";
          filter.Q.value = 0.8;
          filter.frequency.setValueAtTime(850 + Math.random() * 500, now);
          filter.frequency.exponentialRampToValueAtTime(260 + Math.random() * 120, now + 1.7);

          const gain = ctx.createGain();
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.exponentialRampToValueAtTime(0.028, now + 0.35);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.85);

          source.connect(filter).connect(gain).connect(master);
          source.start(now);
          source.stop(now + 1.9);

          timersRef.current.push(window.setTimeout(scheduleWhisper, 6500 + Math.random() * 8500));
        };
        scheduleWhisper();
      } catch {
        // Audio is an enhancement; never block the game.
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
