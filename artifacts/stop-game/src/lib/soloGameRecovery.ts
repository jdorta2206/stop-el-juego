/**
 * Durable, account-bound checkpoint for a solo game.
 *
 * This module deliberately does not serialize React state itself. SoloGame
 * must pass an explicit, allow-listed snapshot so timers, callbacks and
 * transient UI state can never be restored accidentally.
 */
export const SOLO_GAME_RECOVERY_VERSION = 1;
export const SOLO_GAME_RECOVERY_MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const SOLO_GAME_RECOVERY_MAX_BYTES = 256 * 1024;

export type SoloGameRecoveryEnvelope<T> = {
  version: typeof SOLO_GAME_RECOVERY_VERSION;
  gameId: string;
  playerId: string;
  mode: string;
  savedAt: number;
  payload: T;
};

export interface RecoveryStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

const STORAGE_PREFIX = "stop_solo_game_recovery_v1:";

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function isValidEnvelope<T>(value: unknown, now: number): value is SoloGameRecoveryEnvelope<T> {
  if (!isRecord(value) || value.version !== SOLO_GAME_RECOVERY_VERSION) return false;
  if (typeof value.gameId !== "string" || value.gameId.length < 8 || value.gameId.length > 128) return false;
  if (typeof value.playerId !== "string" || value.playerId.length < 1 || value.playerId.length > 128) return false;
  if (typeof value.mode !== "string" || value.mode.length < 1 || value.mode.length > 32) return false;
  if (typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)) return false;
  if (value.savedAt > now + 60_000 || now - value.savedAt > SOLO_GAME_RECOVERY_MAX_AGE_MS) return false;
  return Object.prototype.hasOwnProperty.call(value, "payload");
}

function storageKey(playerId: string): string {
  return STORAGE_PREFIX + encodeURIComponent(playerId);
}

/** Saves a validated, account-scoped snapshot. Returns false if storage is unavailable. */
export function saveSoloGameRecovery<T>(
  storage: RecoveryStorage,
  envelope: SoloGameRecoveryEnvelope<T>,
): boolean {
  if (!isValidEnvelope<T>(envelope, Date.now())) return false;
  try {
    const serialized = JSON.stringify(envelope);
    if (new TextEncoder().encode(serialized).byteLength > SOLO_GAME_RECOVERY_MAX_BYTES) return false;
    storage.setItem(storageKey(envelope.playerId), serialized);
    return true;
  } catch {
    return false;
  }
}

/** Reads only the current player's fresh checkpoint; invalid data is discarded. */
export function readSoloGameRecovery<T>(
  storage: RecoveryStorage,
  playerId: string,
  now = Date.now(),
): SoloGameRecoveryEnvelope<T> | null {
  if (!playerId || playerId.length > 128) return null;
  const key = storageKey(playerId);
  let raw: string | null;
  try {
    raw = storage.getItem(key);
  } catch {
    return null;
  }
  if (!raw) return null;
  try {
    if (new TextEncoder().encode(raw).byteLength > SOLO_GAME_RECOVERY_MAX_BYTES) {
      storage.removeItem(key);
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    if (!isValidEnvelope<T>(parsed, now) || parsed.playerId !== playerId) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    // Malformed JSON must not remain in storage and be retried on every launch.
    try { storage.removeItem(key); } catch { /* best effort */ }
    return null;
  }
}

export function clearSoloGameRecovery(storage: RecoveryStorage, playerId: string): void {
  if (!playerId || playerId.length > 128) return;
  try { storage.removeItem(storageKey(playerId)); } catch { /* best effort */ }
}
