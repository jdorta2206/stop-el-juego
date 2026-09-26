const STORAGE_KEY = "stop-halloween-reduced-effects";

export function getHalloweenReducedEffects(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1";
  } catch {
    return false;
  }
}

export function setHalloweenReducedEffects(enabled: boolean): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, enabled ? "1" : "0");
  } catch {}
}
