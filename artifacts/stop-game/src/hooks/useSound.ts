import { useRef, useCallback } from "react";

function playTone(
  ctx: AudioContext,
  freq: number,
  startTime: number,
  duration: number,
  type: OscillatorType = "sine",
  volume = 0.28,
  attack = 0.01,
  release = 0.08,
) {
  try {
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
  } catch {}
}

export function useSound(muted: boolean) {
  const ctxRef = useRef<AudioContext | null>(null);

  const getCtx = useCallback(() => {
    if (!ctxRef.current || ctxRef.current.state === "closed") {
      ctxRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }
    if (ctxRef.current.state === "suspended") {
      ctxRef.current.resume();
    }
    return ctxRef.current;
  }, []);

  const play = useCallback((fn: (ctx: AudioContext) => void) => {
    if (muted) return;
    try { fn(getCtx()); } catch {}
  }, [muted, getCtx]);

  // Pleasant ascending chord — correct word / positive feedback
  const playCorrect = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playTone(ctx, 523, t, 0.18, "sine", 0.22);
    playTone(ctx, 659, t + 0.07, 0.22, "sine", 0.2);
    playTone(ctx, 784, t + 0.14, 0.28, "sine", 0.16);
  }), [play]);

  // Low descending buzz — wrong/empty
  const playWrong = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playTone(ctx, 220, t, 0.08, "sawtooth", 0.14);
    playTone(ctx, 165, t + 0.06, 0.14, "sawtooth", 0.1);
  }), [play]);

  // Victory fanfare — round won
  const playWin = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    const notes = [523, 659, 784, 1047];
    notes.forEach((f, i) => playTone(ctx, f, t + i * 0.09, 0.35, "sine", 0.2));
    playTone(ctx, 1319, t + 0.4, 0.5, "sine", 0.12, 0.02, 0.2);
    // Harmonic shimmer
    [784, 1047, 1319].forEach((f, i) =>
      playTone(ctx, f, t + 0.45 + i * 0.07, 0.3, "triangle", 0.08)
    );
  }), [play]);

  // Sad descending — round lost
  const playLose = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [494, 440, 392, 330].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.13, 0.3, "sine", 0.18)
    );
  }), [play]);

  // Level-up fanfare — triumphant ascending arpeggio
  const playLevelUp = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [523, 659, 784, 1047, 1319, 1568].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.07, 0.4, "sine", 0.22)
    );
    [784, 988, 1175, 1568].forEach((f, i) =>
      playTone(ctx, f, t + 0.1 + i * 0.07, 0.35, "triangle", 0.1)
    );
  }), [play]);

  // Combo! — fast energetic burst, higher pitch per combo level
  const playCombo = useCallback((count: number) => play(ctx => {
    const t = ctx.currentTime;
    const base = Math.min(count, 5);
    const freqs = [523, 659, 784, 988, 1175].slice(0, base);
    freqs.forEach((f, i) =>
      playTone(ctx, f, t + i * 0.055, 0.18, "square", 0.13)
    );
    // Final high accent
    playTone(ctx, freqs[freqs.length - 1] * 2, t + base * 0.055, 0.25, "sine", 0.18);
  }), [play]);

  // STOP button — dramatic chord stab
  const playStop = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [261, 330, 392, 523].forEach(f =>
      playTone(ctx, f, t, 0.28, "sawtooth", 0.16, 0.005, 0.05)
    );
    playTone(ctx, 1047, t + 0.04, 0.45, "sine", 0.28, 0.01, 0.18);
  }), [play]);

  // New round start — brief alert
  const playRoundStart = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    playTone(ctx, 440, t, 0.1, "sine", 0.18);
    playTone(ctx, 880, t + 0.09, 0.18, "sine", 0.14);
  }), [play]);

  // Double XP event — exciting fanfare
  const playEvent = useCallback(() => play(ctx => {
    const t = ctx.currentTime;
    [659, 784, 988, 1175].forEach((f, i) =>
      playTone(ctx, f, t + i * 0.06, 0.25, "sine", 0.2)
    );
    playTone(ctx, 1568, t + 0.28, 0.4, "sine", 0.22, 0.02, 0.15);
  }), [play]);

  return { playCorrect, playWrong, playWin, playLose, playLevelUp, playCombo, playStop, playRoundStart, playEvent };
}
