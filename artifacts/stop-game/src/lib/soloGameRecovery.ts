export type SoloGameRecoverySnapshot = {
  version: 1;
  playerId: string;
  gameMode: string;
  packId: string;
  savedAt: number;
  payload: Record<string, unknown>;
};

const STORAGE_PREFIX = "stop_solo_game_recovery_v1";
const MAX_AGE_MS = 24 * 60 * 60 * 1000;

function storageKey(playerId: string): string {
  return `${STORAGE_PREFIX}:${encodeURIComponent(playerId)}`;
}

export function saveSoloGameRecovery(
  playerId: string,
  gameMode: string,
  packId: string,
  payload: Record<string, unknown>,
): boolean {
  if (!playerId.trim() || !gameMode.trim() || !packId.trim()) return false;
  try {
    const snapshot: SoloGameRecoverySnapshot = {
      version: 1,
      playerId,
      gameMode,
      packId,
      savedAt: Date.now(),
      payload,
    };
    window.localStorage.setItem(storageKey(playerId), JSON.stringify(snapshot));
    return true;
  } catch {
    return false;
  }
}

export function readSoloGameRecovery(
  playerId: string,
): SoloGameRecoverySnapshot | null {
  if (!playerId.trim()) return null;
  try {
    const raw = window.localStorage.getItem(storageKey(playerId));
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SoloGameRecoverySnapshot>;
    if (
      value.version !== 1
      || value.playerId !== playerId
      || typeof value.gameMode !== "string"
      || typeof value.packId !== "string"
      || typeof value.savedAt !== "number"
      || !value.payload
      || typeof value.payload !== "object"
      || Array.isArray(value.payload)
      || Date.now() - value.savedAt > MAX_AGE_MS
      || value.savedAt > Date.now() + 60_000
    ) {
      window.localStorage.removeItem(storageKey(playerId));
      return null;
    }
    return value as SoloGameRecoverySnapshot;
  } catch {
    return null;
  }
}

export function clearSoloGameRecovery(playerId: string): void {
  if (!playerId.trim()) return;
  try {
    window.localStorage.removeItem(storageKey(playerId));
  } catch {
    // Recovery cleanup must never interrupt a game transition.
  }
}
