let paused = false;

// Use a window-level flag as the source of truth as well as the module-local
// flag. Vite can produce more than one module instance across chunks; the
// native rewarded Activity keeps the WebView alive, so this must remain true
// regardless of which bundled copy calls the timer guard.
const GLOBAL_PAUSE_KEY = "__STOP_REWARDED_AD_PAUSED__";

function setGlobalPaused(value: boolean): void {
  if (typeof window === "undefined") return;
  try { (window as any)[GLOBAL_PAUSE_KEY] = value; } catch {}
}

function getGlobalPaused(): boolean {
  if (typeof window === "undefined") return false;
  try { return (window as any)[GLOBAL_PAUSE_KEY] === true; } catch { return false; }
}

export function pauseGameTimer(): void {
  paused = true;
  setGlobalPaused(true);
}

export function resumeGameTimer(): void {
  paused = false;
  setGlobalPaused(false);
}

export function isGameTimerPaused(): boolean {
  return paused || getGlobalPaused();
}
