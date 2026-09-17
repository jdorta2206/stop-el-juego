let paused = false;

export function pauseGameTimer(): void {
  paused = true;
}

export function resumeGameTimer(): void {
  paused = false;
}

export function isGameTimerPaused(): boolean {
  return paused;
}
