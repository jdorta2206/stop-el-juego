import { useRef, useCallback } from "react";

const MAX_VOICES = 12;
let activeVoices = 0;

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
  } catch (error) {
    console.warn("Audio tone could not be played", error);
    activeVoices = Math.max(0, activeVoices - 1);
  }
}

function makeNoiseBuffer(ctx: AudioContext, durationSec = 0.1): AudioBuffer {
  const sampleRate = ctx.sampleRate;
  const frameCount = Math.ceil(sampleRate * durationSec);
  const buf = ctx.createBuffer(1, frameCount, sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < frameCount; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function playNoise(ctx: AudioContext, startTime: number, duration: number, volume = 0.15, highpass = 800) {
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
  } catch (error) {
    console.warn("Audio noise could not be played", error);
    activeVoices = Math.max(0, activeVoices - 1);
  }
}

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
  } catch (error) {
    console.warn("Audio kick could not be played", error);
    activeVoices = Math.max(0, activeVoices - 1);
  }
}

function withReverb(fn: (offset: number) => void, taps = 4, spacing = 0.07, decayFactor = 0.45) {
  fn(0);
  for (let i = 1; i <= taps; i++) {
    const v = Math.pow(decayFactor, i);
    fn(i * spacing * v * 0.5);
  }
}

export function useSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      const AudioContextCtor = window.AudioContext ??
        (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioContextCtor) throw new Error("Web Audio API is not supported");
      ctxRef.current = new AudioContextCtor();
    }
    if (ctxRef.current.state === "suspended") void ctxRef.current.resume();
    return ctxRef.current;
  }, []);

  const play = useCallback((fn: (ctx: AudioContext) => void) => {
    if (muted) return;
    try {
      fn(getCtx());
    } catch (error) {
      console.warn("Game audio could not be played", error);
    }
  }, [muted, getCtx]);

  const playCorrect = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playTone(ctx, 523, t, 0.18, "sine", 0.22);
    playTone(ctx, 659, t + 0.07, 0.22, "sine", 0.2);
    playTone(ctx, 784, t + 0.14, 0.28, "sine", 0.16);
  }), [play]);

  const playWrong = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playNoise(ctx, t, 0.05, 0.12, 400);
    playTone(ctx, 220, t, 0.08, "sawtooth", 0.14);
    playTone(ctx, 165, t + 0.06, 0.14, "sawtooth", 0.1);
  }), [play]);

  const playWin = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [261, 392, 523, 659, 784].forEach((f, i) => playTone(ctx, f, t + i * 0.08, 0.4, "sine", 0.18, 0.01, 0.15));
    [523, 659, 784, 1047].forEach(f => playTone(ctx, f, t + 0.42, 0.55, "triangle", 0.14, 0.01, 0.3));
    [1047, 1319, 1568, 2093].forEach((f, i) => playTone(ctx, f, t + 0.5 + i * 0.06, 0.3, "sine", 0.1, 0.01, 0.18));
    playKick(ctx, t, 0.28);
    playNoise(ctx, t + 0.42, 0.06, 0.08, 2000);
  }), [play]);

  const playLose = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [494, 440, 392, 330].forEach((f, i) => playTone(ctx, f, t + i * 0.13, 0.3, "sine", 0.18));
    playNoise(ctx, t, 0.04, 0.06, 600);
  }), [play]);

  const playLevelUp = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [392, 523, 659, 784].forEach((f, i) => playTone(ctx, f, t + i * 0.1, 0.22, "sine", 0.2, 0.005, 0.08));
    playTone(ctx, 1047, t + 0.42, 0.7, "sine", 0.28, 0.01, 0.4);
    [523, 659, 784].forEach((f, i) => playTone(ctx, f, t + 0.42, 0.6, "triangle", 0.1 - i * 0.02, 0.01, 0.35));
    [1319, 1568, 2093].forEach((f, i) => playTone(ctx, f, t + 0.5 + i * 0.07, 0.35, "sine", 0.08, 0.01, 0.22));
    playKick(ctx, t + 0.42, 0.32);
    playNoise(ctx, t + 0.42, 0.05, 0.1, 2500);
  }), [play]);

  const playCombo = useCallback((count: number) => play(ctx => {
    const t = ctx.currentTime;
    const base = Math.min(count, 5);
    const freqs = [523, 659, 784, 988, 1175].slice(0, base);
    if (freqs.length === 0) return;
    freqs.forEach((f, i) => playTone(ctx, f, t + i * 0.05, 0.18, "square", 0.12));
    playTone(ctx, freqs[freqs.length - 1] * 2, t + base * 0.05, 0.3, "sine", 0.18);
    if (count >= 3) playNoise(ctx, t, 0.04, 0.08, 3000);
  }), [play]);

  const playStop = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playKick(ctx, t, 0.55);
    playNoise(ctx, t, 0.07, 0.22, 1200);
    [130, 261, 392, 523].forEach(f => playTone(ctx, f, t, 0.35, "sawtooth", 0.18, 0.002, 0.12));
    playTone(ctx, 1047, t + 0.02, 0.5, "sine", 0.3, 0.008, 0.25);
    [0.1, 0.18, 0.26].forEach((delay, i) => playTone(ctx, 1047, t + delay, 0.3, "sine", 0.08 * Math.pow(0.5, i), 0.01, 0.2));
  }), [play]);

  const playRoundStart = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playNoise(ctx, t, 0.03, 0.09, 2000);
    playTone(ctx, 440, t, 0.1, "sine", 0.18);
    playTone(ctx, 880, t + 0.09, 0.2, "sine", 0.16);
  }), [play]);

  const playEvent = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [659, 784, 988, 1175].forEach((f, i) => playTone(ctx, f, t + i * 0.06, 0.25, "sine", 0.18));
    playTone(ctx, 1568, t + 0.28, 0.45, "sine", 0.22, 0.02, 0.2);
    playNoise(ctx, t, 0.08, 0.06, 3000);
  }), [play]);

  return { playCorrect, playWrong, playWin, playLose, playLevelUp, playCombo, playStop, playRoundStart, playEvent };
}
