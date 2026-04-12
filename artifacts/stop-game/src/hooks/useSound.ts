import { useRef, useCallback } from "react";

const MAX_VOICES = 12;
let activeVoices = 0;

// ─── Core tone primitive ──────────────────────────────────────────────────────
function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.28,
  attack = 0.005,
  release = 0.08,
) {
  if (activeVoices >= MAX_VOICES) return;
  try {
    activeVoices++;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, startTime);
    gain.gain.linearRampToValueAtTime(volume, startTime + attack);
    gain.gain.setValueAtTime(volume, Math.max(startTime + attack + 0.001, startTime + duration - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + duration + 0.01);
    osc.onended = () => { activeVoices = Math.max(0, activeVoices - 1); };
  } catch { activeVoices = Math.max(0, activeVoices - 1); }
}

// ─── White noise buffer (percussive texture) ──────────────────────────────────
function makeNoiseBuffer(ctx: AudioContext, durationSec = 0.1): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.ceil(sampleRate * durationSec);
  const buf = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(
  ctx: AudioContext,
  startTime: number,
  duration: number,
  volume = 0.15,
  highpass = 800,
) {
  if (activeVoices >= MAX_VOICES) return;
  try {
    activeVoices++;
    const buf = makeNoiseBuffer(ctx, duration + 0.01);
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "highpass";
    filter.frequency.value = highpass;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
    src.connect(filter);
    filter.connect(gain);
    gain.connect(ctx.destination);
    src.start(startTime);
    src.stop(startTime + duration + 0.02);
    src.onended = () => { activeVoices = Math.max(0, activeVoices - 1); };
  } catch { activeVoices = Math.max(0, activeVoices - 1); }
}

// ─── Sub-bass kick (felt impact) ─────────────────────────────────────────────
function playKick(ctx: AudioContext, startTime: number, volume = 0.5) {
  if (activeVoices >= MAX_VOICES) return;
  try {
    activeVoices++;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.setValueAtTime(160, startTime);
    osc.frequency.exponentialRampToValueAtTime(30, startTime + 0.25);
    gain.gain.setValueAtTime(volume, startTime);
    gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.3);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(startTime);
    osc.stop(startTime + 0.32);
    osc.onended = () => { activeVoices = Math.max(0, activeVoices - 1); };
  } catch { activeVoices = Math.max(0, activeVoices - 1); }
}

// ─── Simple reverb tail (cheap but effective — N echoes at decay) ────────────
function withReverb(
  fn: (offset: number) => void,
  taps = 4,
  spacing = 0.07,
  decayFactor = 0.45,
) {
  fn(0);
  for (let i = 1; i <= taps; i++) {
    const v = Math.pow(decayFactor, i);
    fn(i * spacing * v * 0.5); // echoes converge over time
  }
}

export function useSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const play = useCallback((fn: (ctx: AudioContext) => void) => {
    if (muted) return;
    try { fn(getCtx()); } catch {}
  }, [muted, getCtx]);

  // ✅ Correct word — bright ascending chord
  const playCorrect = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playTone(ctx, 523, t, 0.18, "sine", 0.22);
    playTone(ctx, 659, t + 0.07, 0.22, "sine", 0.2);
    playTone(ctx, 784, t + 0.14, 0.28, "sine", 0.16);
  }), [play]);

  // ❌ Wrong/empty — punchy descending buzz
  const playWrong = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playNoise(ctx, t, 0.05, 0.12, 400);
    playTone(ctx, 220, t, 0.08, "sawtooth", 0.14);
    playTone(ctx, 165, t + 0.06, 0.14, "sawtooth", 0.1);
  }), [play]);

  // 🏆 Victory fanfare — epic ascending with shimmer + reverb tail
  const playWin = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    // Rising arpeggio
    [261, 392, 523, 659, 784].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.08, 0.4, "sine", 0.18, 0.01, 0.15)
    );
    // Power chord hit
    [523, 659, 784, 1047].forEach(f =>
      playTone(ctx, f, t + 0.42, 0.55, "triangle", 0.14, 0.01, 0.3)
    );
    // High sparkle
    [1047, 1319, 1568, 2093].forEach((f, i) =>
      playTone(ctx, f, t + 0.5 + i * 0.06, 0.3, "sine", 0.1, 0.01, 0.18)
    );
    // Sub kick
    playKick(ctx, t, 0.28);
    // Noise transient on impact
    playNoise(ctx, t + 0.42, 0.06, 0.08, 2000);
  }), [play]);

  // 😢 Round lost — soft descending
  const playLose = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [494, 440, 392, 330].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.13, 0.3, "sine", 0.18)
    );
    playNoise(ctx, t, 0.04, 0.06, 600);
  }), [play]);

  // 🆙 Level-up — triumphant "da-da-da-DUM" + shimmer
  const playLevelUp = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    // 4-note pick-up phrase
    [392, 523, 659, 784].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.1, 0.22, "sine", 0.2, 0.005, 0.08)
    );
    // Triumphant top note (held)
    playTone(ctx, 1047, t + 0.42, 0.7, "sine", 0.28, 0.01, 0.4);
    // Harmonic stack
    [523, 659, 784].forEach((f, i) =>
      playTone(ctx, f, t + 0.42, 0.6, "triangle", 0.1 - i * 0.02, 0.01, 0.35)
    );
    // Glitter on top
    [1319, 1568, 2093].forEach((f, i) =>
      playTone(ctx, f, t + 0.5 + i * 0.07, 0.35, "sine", 0.08, 0.01, 0.22)
    );
    // Sub punch + noise snap
    playKick(ctx, t + 0.42, 0.32);
    playNoise(ctx, t + 0.42, 0.05, 0.1, 2500);
  }), [play]);

  // 🔥 Combo — energetic burst that grows with count
  const playCombo = useCallback((count: number) => play(ctx => {
    const t = ctx.currentTime;
    const base = Math.min(count, 5);
    const freqs = [523, 659, 784, 988, 1175].slice(0, base);
    freqs.forEach((f, i) =>
      playTone(ctx, f, t + i * 0.05, 0.18, "square", 0.12)
    );
    playTone(ctx, freqs[freqs.length - 1] * 2, t + base * 0.05, 0.3, "sine", 0.18);
    if (count >= 3) playNoise(ctx, t, 0.04, 0.08, 3000);
  }), [play]);

  // 🛑 STOP — dramatic chord stab with physical kick + noise snap
  const playStop = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    // Sub-bass kick for impact felt in the body
    playKick(ctx, t, 0.55);
    // Noise snap (the "crack")
    playNoise(ctx, t, 0.07, 0.22, 1200);
    // Chord stab — 4 voices together
    [130, 261, 392, 523].forEach(f =>
      playTone(ctx, f, t, 0.35, "sawtooth", 0.18, 0.002, 0.12)
    );
    // High piercing accent
    playTone(ctx, 1047, t + 0.02, 0.5, "sine", 0.3, 0.008, 0.25);
    // Reverb echoes
    [0.1, 0.18, 0.26].forEach((delay, i) => {
      const vol = 0.08 * Math.pow(0.5, i);
      playTone(ctx, 1047, t + delay, 0.3, "sine", vol, 0.01, 0.2);
    });
  }), [play]);

  // ▶️ New round start — punchy alert
  const playRoundStart = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playNoise(ctx, t, 0.03, 0.09, 2000);
    playTone(ctx, 440, t, 0.1, "sine", 0.18);
    playTone(ctx, 880, t + 0.09, 0.2, "sine", 0.16);
  }), [play]);

  // ⚡ Random event — ascending whoosh
  const playEvent = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [659, 784, 988, 1175].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.06, 0.25, "sine", 0.18)
    );
    playTone(ctx, 1568, t + 0.28, 0.45, "sine", 0.22, 0.02, 0.2);
    playNoise(ctx, t, 0.08, 0.06, 3000);
  }), [play]);

  // 🎭 Bluff perfect — triumphant shimmer, you got away with it
  const playBluffPerfect = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [392, 523, 659, 784, 1047].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.06, 0.35, "sine", 0.18)
    );
    playTone(ctx, 1319, t + 0.35, 0.55, "triangle", 0.14, 0.02, 0.25);
    [784, 1047].forEach((f, i) =>
      playTone(ctx, f, t + 0.42 + i * 0.08, 0.3, "triangle", 0.08)
    );
    playNoise(ctx, t + 0.35, 0.04, 0.07, 4000);
  }), [play]);

  // 🕵️ Bluff caught — dramatic exposed! buzz
  const playBluffCaught = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playNoise(ctx, t, 0.06, 0.18, 300);
    playTone(ctx, 440, t, 0.06, "sawtooth", 0.2, 0.003, 0.04);
    [330, 277, 220, 185].forEach((f, i) =>
      playTone(ctx, f, t + 0.06 + i * 0.1, 0.18, "sawtooth", 0.14)
    );
    playTone(ctx, 110, t + 0.5, 0.4, "sine", 0.2, 0.02, 0.25);
  }), [play]);

  // ⚖️ Judge reveal — ominous suspense before AI bluff judgment
  const playJudge = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [110, 138, 164].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.08, 0.65, "sine", 0.16, 0.05, 0.3)
    );
    playTone(ctx, 220, t + 0.3, 0.55, "triangle", 0.1, 0.06, 0.35);
    playTone(ctx, 330, t + 0.58, 0.45, "sine", 0.08, 0.04, 0.3);
    playNoise(ctx, t, 0.04, 0.05, 100);
  }), [play]);

  // 🔍 Hidden reveal — mysterious ascending for hidden category
  const playHiddenReveal = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [330, 415, 523, 622].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.08, 0.28, "triangle", 0.16)
    );
    playTone(ctx, 740, t + 0.38, 0.45, "sine", 0.14, 0.03, 0.25);
    // Sparkle tail
    [1047, 1319].forEach((f, i) =>
      playTone(ctx, f, t + 0.5 + i * 0.07, 0.25, "sine", 0.07, 0.01, 0.18)
    );
  }), [play]);

  // ⌨️ Key click — mechanical noise burst (sounds like a real key)
  const playKeyClick = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    // Short noise burst — highpass gives it a "clicky" top-end
    playNoise(ctx, t, 0.022, 0.1, 4000 + Math.random() * 2000);
    // Tiny body thump
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 200 + Math.random() * 80;
    g.gain.setValueAtTime(0.07, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.035);
    osc.connect(g);
    g.connect(ctx.destination);
    osc.start(t);
    osc.stop(t + 0.04);
  }), [play]);

  // ⏰ Countdown tick — urgent escalation in last 5s
  const playTick = useCallback((urgency = 1) => play(ctx => {
    const t = ctx.currentTime;
    const freq = urgency >= 4 ? 1200 : urgency >= 3 ? 880 : urgency >= 2 ? 660 : 440;
    const vol = 0.2 + urgency * 0.05;
    // Hard noise snap for punch
    playNoise(ctx, t, 0.025, 0.08 + urgency * 0.015, 1500);
    // Tone body
    playTone(ctx, freq, t, 0.07, "sine", vol, 0.001, 0.045);
  }), [play]);

  // 🏅 Achievement unlocked — cascading sparkle + reverb tail + sub punch
  const playAchievement = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    // Sub punch
    playKick(ctx, t, 0.25);
    // Noise snap
    playNoise(ctx, t, 0.04, 0.12, 3000);
    // Rising sparkle waterfall
    [523, 659, 784, 988, 1175, 1319, 1568].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.05, 0.32, "sine", 0.2, 0.008, 0.15)
    );
    // Shimmer overtones
    [784, 1047, 1319, 1568, 2093].forEach((f, i) =>
      playTone(ctx, f, t + 0.06 + i * 0.04, 0.25, "triangle", 0.1, 0.008, 0.12)
    );
    // Long sustain accent
    playTone(ctx, 2093, t + 0.4, 0.65, "sine", 0.14, 0.02, 0.4);
    // Reverb echoes (3 taps)
    [0.12, 0.22, 0.32].forEach((delay, i) => {
      const vol = 0.06 * Math.pow(0.55, i);
      playTone(ctx, 1568, t + 0.4 + delay, 0.3, "sine", vol, 0.01, 0.25);
    });
  }), [play]);

  return {
    playCorrect, playWrong, playWin, playLose, playLevelUp,
    playCombo, playStop, playRoundStart, playEvent,
    playBluffPerfect, playBluffCaught, playJudge, playHiddenReveal,
    playKeyClick, playTick, playAchievement,
  };
}
