import { useEffect, useRef, useState } from "react";

type HalloweenAmbientController = {
  start: () => void;
  stop: () => void;
};

function createController(): HalloweenAmbientController {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let musicTimer: number | null = null;
  let stormTimer: number | null = null;
  let started = false;
  let step = 0;

  const playNote = (frequency: number, duration = 0.55, volume = 0.08, type: OscillatorType = "sine") => {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const filter = ctx.createBiquadFilter();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, now);
    filter.type = "lowpass";
    filter.frequency.value = type === "sawtooth" ? 900 : 1800;
    filter.Q.value = 1.2;

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(volume, now + 0.025);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(master);
    osc.start(now);
    osc.stop(now + duration + 0.03);
  };

  const playThunder = () => {
    if (!ctx || !master) return;
    const now = ctx.currentTime;
    const duration = 2.7;

    // Low rumble + filtered noise create a rolling thunder effect.
    const rumble = ctx.createOscillator();
    const rumbleGain = ctx.createGain();
    const rumbleFilter = ctx.createBiquadFilter();
    rumble.type = "sawtooth";
    rumble.frequency.setValueAtTime(48, now);
    rumble.frequency.exponentialRampToValueAtTime(29, now + duration);
    rumbleFilter.type = "lowpass";
    rumbleFilter.frequency.value = 180;
    rumbleGain.gain.setValueAtTime(0.0001, now);
    rumbleGain.gain.exponentialRampToValueAtTime(0.12, now + 0.08);
    rumbleGain.gain.exponentialRampToValueAtTime(0.055, now + 0.65);
    rumbleGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    rumble.connect(rumbleFilter);
    rumbleFilter.connect(rumbleGain);
    rumbleGain.connect(master);
    rumble.start(now);
    rumble.stop(now + duration + 0.05);

    const bufferSize = Math.floor(ctx.sampleRate * duration);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let last = 0;
    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      last = last * 0.985 + white * 0.015;
      data[i] = last;
    }

    const noise = ctx.createBufferSource();
    const noiseFilter = ctx.createBiquadFilter();
    const noiseGain = ctx.createGain();
    noise.buffer = buffer;
    noiseFilter.type = "lowpass";
    noiseFilter.frequency.setValueAtTime(500, now);
    noiseFilter.frequency.exponentialRampToValueAtTime(90, now + duration);
    noiseGain.gain.setValueAtTime(0.0001, now);
    noiseGain.gain.exponentialRampToValueAtTime(0.09, now + 0.18);
    noiseGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    noise.connect(noiseFilter);
    noiseFilter.connect(noiseGain);
    noiseGain.connect(master);
    noise.start(now);
    noise.stop(now + duration);

    // A second delayed rumble makes the thunder feel distant and rolling.
    window.setTimeout(() => {
      if (!ctx || !master) return;
      const late = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(38, late);
      osc.frequency.exponentialRampToValueAtTime(24, late + 1.7);
      gain.gain.setValueAtTime(0.0001, late);
      gain.gain.exponentialRampToValueAtTime(0.055, late + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, late + 1.7);
      osc.connect(gain);
      gain.connect(master);
      osc.start(late);
      osc.stop(late + 1.75);
    }, 500);
  };

  const tick = () => {
    if (!ctx) return;
    const bass = [55, 55, 65.41, 49, 55, 55, 73.42, 49];
    const melody = [220, 0, 196, 0, 174.61, 0, 164.81, 0];

    playNote(bass[step], 0.75, 0.075, "sawtooth");

    if (step % 2 === 0) {
      const root = [110, 130.81, 98][Math.floor(step / 2) % 3];
      playNote(root, 1.0, 0.035, "triangle");
      playNote(root * 1.189, 0.9, 0.022, "triangle");
      playNote(root * 1.498, 0.85, 0.018, "triangle");
    }

    if (melody[step] > 0) {
      playNote(melody[step], 0.42, 0.045, "sine");
      if (step === 6) playNote(melody[step] * 2, 0.28, 0.025, "sine");
    }

    step = (step + 1) % 8;
  };

  const start = () => {
    if (started || typeof window === "undefined") return;
    const AC = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;

    try {
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.0001;
      master.connect(ctx.destination);

      void ctx.resume().then(() => {
        if (!ctx || !master) return;
        const now = ctx.currentTime;
        master.gain.cancelScheduledValues(now);
        master.gain.setTargetAtTime(0.18, now, 0.8);

        tick();
        musicTimer = window.setInterval(tick, 620);

        // Sync the first thunder with the first cinematic lightning flash (~71% of 9s).
        const firstStormDelay = 6400;
        stormTimer = window.setTimeout(() => {
          playThunder();
          stormTimer = window.setInterval(playThunder, 9000);
        }, firstStormDelay);
      });

      started = true;
    } catch {
      stop();
    }
  };

  const stop = () => {
    if (!ctx) return;
    try {
      if (musicTimer !== null) {
        window.clearInterval(musicTimer);
        musicTimer = null;
      }
      if (stormTimer !== null) {
        window.clearTimeout(stormTimer);
        window.clearInterval(stormTimer);
        stormTimer = null;
      }

      const closingCtx = ctx;
      const closingMaster = master;
      const now = closingCtx.currentTime;
      closingMaster?.gain.cancelScheduledValues(now);
      closingMaster?.gain.setTargetAtTime(0.0001, now, 0.2);
      window.setTimeout(() => {
        try { void closingCtx.close(); } catch {}
      }, 700);
    } catch {}

    ctx = null;
    master = null;
    started = false;
    step = 0;
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
  const [audioStarted, setAudioStarted] = useState(false);

  useEffect(() => {
    if (!active || !enabled) {
      controllerRef.current?.stop();
      controllerRef.current = null;
      setAudioStarted(false);
      return;
    }

    const controllerInstance = createController();
    controllerRef.current = controllerInstance;

    const startAudio = () => {
      controllerInstance.start();
      setAudioStarted(true);
    };
    const resumeAudio = () => {
      controllerInstance.start();
      setAudioStarted(true);
    };
    const events = ["pointerdown", "touchstart", "keydown"] as const;
    events.forEach((event) => window.addEventListener(event, startAudio, { once: true, passive: true }));
    window.addEventListener("visibilitychange", resumeAudio);

    return () => {
      events.forEach((event) => window.removeEventListener(event, startAudio));
      window.removeEventListener("visibilitychange", resumeAudio);
      controllerInstance.stop();
      if (controllerRef.current === controllerInstance) controllerRef.current = null;
    };
  }, [active, enabled]);

  if (!active || !enabled) return null;

  return (
    <>
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 z-[20] overflow-hidden"
        style={{
          background: "radial-gradient(circle at 50% 38%, rgba(190,25,25,.20), transparent 48%)",
          mixBlendMode: "screen",
        }}
      >
        <div
          className="absolute inset-[-12%]"
          style={{
            background: "radial-gradient(circle at 50% 40%, rgba(255,235,205,.28), transparent 34%)",
            animation: "halloween-home-pulse 5.5s ease-in-out infinite",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(circle at 52% 45%, rgba(255,255,235,.24), transparent 30%)",
            animation: "halloween-home-flicker 5.5s steps(1,end) infinite",
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "linear-gradient(112deg, transparent 0%, transparent 43%, rgba(255,255,255,.38) 49%, transparent 55%, transparent 100%)",
            animation: "halloween-home-lightning 9s steps(1,end) infinite",
            opacity: 0,
          }}
        />
        <div
          className="absolute inset-0"
          style={{
            background: "radial-gradient(ellipse at 50% 18%, rgba(255,255,255,.34), transparent 24%)",
            animation: "halloween-home-flash 13s steps(1,end) infinite",
            opacity: 0,
          }}
        />
      </div>

      {!audioStarted && (
        <button
          type="button"
          onClick={() => {
            controllerRef.current?.start();
            setAudioStarted(true);
          }}
          className="pointer-events-auto fixed bottom-24 right-4 z-[60] rounded-full border border-red-400/60 bg-black/80 px-4 py-2 text-sm font-semibold text-white shadow-lg backdrop-blur"
          aria-label="Activar música de Halloween"
        >
          🔊 Activar música de terror
        </button>
      )}

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
        @keyframes halloween-home-lightning {
          0%, 71%, 72%, 73%, 100% { opacity: 0; transform: translateX(-18%) skewX(-10deg); }
          71.3% { opacity: .18; }
          71.6% { opacity: .65; }
          72.2% { opacity: .08; }
          72.6% { opacity: .42; }
        }
        @keyframes halloween-home-flash {
          0%, 39%, 40%, 41%, 100% { opacity: 0; }
          39.2% { opacity: .12; }
          39.35% { opacity: .55; }
          39.55% { opacity: .04; }
          40.4% { opacity: .28; }
        }
      `}</style>
    </>
  );
}
