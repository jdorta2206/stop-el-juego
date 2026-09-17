// Pauses browser interval callbacks while a rewarded-ad modal/native activity is active.
// SoloGame's countdown is driven by setInterval; pausing the interval callback is
// intentional here so the remaining seconds do not continue to drain while the
// player is watching/starting a rewarded ad.
let installed = false;
let paused = false;

export function installTimerPauseGuard() {
  if (installed || typeof window === "undefined") return;
  installed = true;

  const win = window as any;
  if (win.__stopTimerPauseGuardInstalled) return;
  win.__stopTimerPauseGuardInstalled = true;

  const nativeSetInterval = window.setInterval.bind(window);
  const nativeClearInterval = window.clearInterval.bind(window);

  win.__stopTimerPause = () => { paused = true; };
  win.__stopTimerResume = () => { paused = false; };
  win.__stopTimerIsPaused = () => paused;

  window.setInterval = ((handler: TimerHandler, timeout?: number, ...args: any[]) => {
    const wrapped: TimerHandler = (...callbackArgs: any[]) => {
      if (paused) return;
      if (typeof handler === "function") {
        handler(...callbackArgs);
      } else {
        // Preserve the native string-handler behavior for completeness.
        Function(handler)();
      }
    };
    return nativeSetInterval(wrapped, timeout, ...args);
  }) as typeof window.setInterval;

  window.clearInterval = ((id: number | undefined) => {
    nativeClearInterval(id);
  }) as typeof window.clearInterval;
}

export function pauseGameTimer() {
  installTimerPauseGuard();
  if (typeof window !== "undefined") (window as any).__stopTimerPause?.();
}

export function resumeGameTimer() {
  if (typeof window !== "undefined") (window as any).__stopTimerResume?.();
}
