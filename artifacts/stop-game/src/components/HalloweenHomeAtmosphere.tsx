import { useEffect, useRef } from "react";

type HalloweenAmbientController = {
  start: () => void;
  stop: () => void;
};

let controller: HalloweenAmbientController | null = null;

function createController(): HalloweenAmbientController {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let nodes: OscillatorNode[] = [];
  let lfo: OscillatorNode | null = null;
  let started = false;

  const start = () => {
    if (started || typeof window === "undefined") return;
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      const frequencies = [55, 82.41, 110];
      nodes = frequencies.map((frequency, index) => {
        const osc = ctx!.createOscillator();
        const gain = ctx!.createGain();
        osc.type = index === 0 ? "sine" : "triangle";
        osc.frequency.value = frequency;
        gain.gain.value = index === 0 ? 0.24 : 0.075;
        osc.connect(gain);
        gain.connect(master!);
        osc.start();
        return osc;
      });

      lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();
      lfo.frequency.value = 0.075;
      lfoGain.gain.value = 0.018;
      lfo.connect(lfoGain);
      lfoGain.connect(master.gain);
      lfo.start();

      const now = ctx.currentTime;
      master.gain.setValueAtTime(0.0001, now);
      master.gain.exponentialRampToValueAtTime(0.045, now + 2.5);
      started = true;
    } catch {
      stop();
    }
  };

  const stop = () => {
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      master?.gain.cancelScheduledValues(now);
      master?.gain.setTargetAtTime(0.0001, now, 0.18);
      window.setTimeout(() => {
        nodes.forEach((node) => { try { node.stop(); } catch {} });
        try { lfo?.stop(); } catch {}
        void ctx?.close();
        nodes = [];
        lfo = null;
        master = null;
        ctx = null;
        started = false;
      }, 700);
    } catch {}
  };

  return { start, stop };
}

export function HalloweenHomeAtmosphere({
  enabled,
  active,
}: {
  enabled: boolean;
  active: boolean;
}) {
  const controllerRef = useRef<HalloweenAmbientController | null>(null);

  useEffect(() => {
    if (!active || !enabled) {
      controllerRef.current?.stop();
      controllerRef.current = null;
      return;
    }

    const controllerInstance = createController();
    controllerRef.current = controllerInstance;

    const startAudio = () => controllerInstance.start();
    const events = ["pointerdown", "touchstart", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, startAudio, { once: true, passive: true }));

    return () => {
      events.forEach((event) => window.removeEventListener(event, startAudio));
      controllerInstance.stop();
      if (controllerRef.current === controllerInstance) controllerRef.current = null;
    };
  }, [active, enabled]);

  if (!active || !enabled) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
        style={{
          background: "radial-gradient(circle at 50% 38%, rgba(190,25,25,.11), transparent 48%)",
          mixBlendMode: "screen",
        }}
      >
        <div
          className="absolute inset-[-12%]"
          style={{
            background: "radial-gradient(circle at 50% 40%, rgba(255,235,205,.16), transparent 34%)",
            animation: "halloween-home-pulse 7.5s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at 52% 45%, rgba(255,255,235,.12), transparent 30%)",
            animation: "halloween-home-flicker 11s steps(1,end) infinite",
          }}
        />
      </div>
      <style>{`
        @keyframes halloween-home-pulse {
          0%, 100% { opacity: .12; transform: scale(.96); }
          46% { opacity: .16; transform: scale(1); }
          49% { opacity: .34; transform: scale(1.015); }
          52% { opacity: .08; transform: scale(.98); }
          68% { opacity: .20; transform: scale(1.01); }
        }
        @keyframes halloween-home-flicker {
          0%, 34%, 37%, 61%, 63%, 100% { opacity: 0; }
          35% { opacity: .10; }
          36% { opacity: .24; }
          62% { opacity: .16; }
        }
        @media (prefers-reduced-motion: reduce) {
          .halloween-home-atmosphere { animation: none !important; }
        }
      `}</style>
    </>
  );
}
