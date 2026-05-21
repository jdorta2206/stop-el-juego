import { useCallback, useMemo } from "react";

const HAPTIC_PREF_KEY = "stop_haptic_v1";

function vibrate(pattern: number | number[]) {
  try {
    if (typeof navigator !== "undefined" && typeof navigator.vibrate === "function") {
      navigator.vibrate(pattern);
    }
  } catch { /* noop */ }
}

function isEnabled(): boolean {
  try {
    const raw = localStorage.getItem(HAPTIC_PREF_KEY);
    if (raw === null) return true;
    return raw === "1";
  } catch { return true; }
}

export function setHapticEnabled(on: boolean) {
  try { localStorage.setItem(HAPTIC_PREF_KEY, on ? "1" : "0"); } catch { /* noop */ }
}

export function useHaptic(force?: boolean) {
  const enabled = force ?? isEnabled();

  const fire = useCallback((pattern: number | number[]) => {
    if (!enabled) return;
    vibrate(pattern);
  }, [enabled]);

  return useMemo(() => ({
    tap:        () => fire(10),
    select:     () => fire(18),
    submit:     () => fire([12, 40, 18]),
    stopHit:    () => fire([60, 30, 90]),
    countdown:  () => fire(25),
    win:        () => fire([80, 60, 80, 60, 200]),
    lose:       () => fire([180]),
    error:      () => fire([40, 30, 40]),
    achievement: () => fire([30, 30, 30, 30, 120]),
  }), [fire]);
}
