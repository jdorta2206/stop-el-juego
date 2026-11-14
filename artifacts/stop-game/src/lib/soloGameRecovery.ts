/**
 * Durable, account-bound checkpoint for a solo game.
 *
 * Only the explicit, allow-listed PLAYING state is recoverable here. We do
 * not serialize React state, timers, callbacks, validation requests or UI
 * overlays. RESULTS/double-reward recovery needs its own finalization protocol.
 */
export const SOLO_GAME_RECOVERY_VERSION = 1;
export const SOLO_GAME_RECOVERY_MAX_AGE_MS = 2 * 60 * 60 * 1000;
export const SOLO_GAME_RECOVERY_MAX_BYTES = 256 * 1024;

export type SoloGameMode = "normal" | "daily" | "quick" | "chaos" | "random";
export type SoloGamePendingReward = "extraTime" | "hint" | null;

export type SoloGameRecoveryPayload = {
  phase: "PLAYING";
  currentLetter: string;
  timeLeft: number;
  round: number;
  categories: string[];
  responses: Record<string, string>;
  totalScore: number;
  aiTotalScore: number;
  gameSubmissionId: string;
  scoreTokens: string[];
  rankingScoreTokens: string[];
  rewardedUsed: boolean;
  hintUsed: boolean;
  doubleUsed: boolean;
  pendingReward: SoloGamePendingReward;
  pendingHint: { category: string; word: string } | null;
  appliedRewardKeys: string[];
};

export type SoloGameRecoveryEnvelope = {
  version: typeof SOLO_GAME_RECOVERY_VERSION;
  gameId: string;
  playerId: string;
  mode: SoloGameMode;
  savedAt: number;
  payload: SoloGameRecoveryPayload;
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

function isStringArray(value: unknown, maxItems: number, maxLength: number): value is string[] {
  return Array.isArray(value) &&
    value.length <= maxItems &&
    value.every(item => typeof item === "string" && item.length > 0 && item.length <= maxLength);
}

export function isValidSoloGameRecoveryPayload(value: unknown): value is SoloGameRecoveryPayload {
  if (!isRecord(value) || value.phase !== "PLAYING") return false;
  if (typeof value.currentLetter !== "string" || !/^[A-ZÑ]{1,2}$/.test(value.currentLetter)) return false;
  if (typeof value.timeLeft !== "number" || !Number.isFinite(value.timeLeft) || value.timeLeft < 0 || value.timeLeft > 120) return false;
  if (!Number.isInteger(value.round) || (value.round as number) < 1 || (value.round as number) > 3) return false;
  if (!isStringArray(value.categories, 20, 80) || value.categories.length === 0) return false;
  if (!isRecord(value.responses)) return false;
  const responseEntries = Object.entries(value.responses);
  if (responseEntries.length > 20 || responseEntries.some(([key, answer]) =>
    key.length === 0 || key.length > 80 || typeof answer !== "string" || answer.length > 120
  )) return false;
  if (typeof value.totalScore !== "number" || !Number.isFinite(value.totalScore) || value.totalScore < 0 || value.totalScore > 1_000_000) return false;
  if (typeof value.aiTotalScore !== "number" || !Number.isFinite(value.aiTotalScore) || value.aiTotalScore < 0 || value.aiTotalScore > 1_000_000) return false;
  if (typeof value.gameSubmissionId !== "string" || value.gameSubmissionId.length < 8 || value.gameSubmissionId.length > 128) return false;
  if (!isStringArray(value.scoreTokens, 20, 4096) || !isStringArray(value.rankingScoreTokens, 20, 4096)) return false;
  if (typeof value.rewardedUsed !== "boolean" || typeof value.hintUsed !== "boolean" || typeof value.doubleUsed !== "boolean") return false;
  if (value.pendingReward !== null && value.pendingReward !== "extraTime" && value.pendingReward !== "hint") return false;
  if (value.pendingHint !== null) {
    if (!isRecord(value.pendingHint) ||
      typeof value.pendingHint.category !== "string" ||
      value.pendingHint.category.length === 0 ||
      value.pendingHint.category.length > 80 ||
      typeof value.pendingHint.word !== "string" ||
      value.pendingHint.word.length === 0 ||
      value.pendingHint.word.length > 120) return false;
  }
  if (value.pendingReward === "hint" && value.pendingHint === null) return false;
  if (value.pendingReward !== "hint" && value.pendingHint !== null) return false;
  if (!isStringArray(value.appliedRewardKeys, 20, 180)) return false;
  return true;
}

function isValidEnvelope(value: unknown, now: number): value is SoloGameRecoveryEnvelope {
  if (!isRecord(value) || value.version !== SOLO_GAME_RECOVERY_VERSION) return false;
  if (typeof value.gameId !== "string" || value.gameId.length < 8 || value.gameId.length > 128) return false;
  if (typeof value.playerId !== "string" || value.playerId.length < 1 || value.playerId.length > 128) return false;
  if (!["normal", "daily", "quick", "chaos", "random"].includes(String(value.mode))) return false;
  if (typeof value.savedAt !== "number" || !Number.isFinite(value.savedAt)) return false;
  if (value.savedAt > now + 60_000 || now - value.savedAt > SOLO_GAME_RECOVERY_MAX_AGE_MS) return false;
  return isValidSoloGameRecoveryPayload(value.payload) && value.payload.gameSubmissionId === value.gameId;
}

function storageKey(playerId: string): string {
  return STORAGE_PREFIX + encodeURIComponent(playerId);
}

/** Saves a validated, account-scoped snapshot. Returns false if storage is unavailable. */
export function saveSoloGameRecovery(
  storage: RecoveryStorage,
  envelope: SoloGameRecoveryEnvelope,
): boolean {
  if (!isValidEnvelope(envelope, Date.now())) return false;
  try {
    const serialized = JSON.stringify(envelope);
    if (new TextEncoder().encode(serialized).byteLength > SOLO_GAME_RECOVERY_MAX_BYTES) return false;
    storage.setItem(storageKey(envelope.playerId), serialized);
    return true;
  } catch {
    return false;
  }
}

/** Reads only the current player's fresh, fully validated checkpoint. */
export function readSoloGameRecovery(
  storage: RecoveryStorage,
  playerId: string,
  now = Date.now(),
): SoloGameRecoveryEnvelope | null {
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
    if (!isValidEnvelope(parsed, now) || parsed.playerId !== playerId) {
      storage.removeItem(key);
      return null;
    }
    return parsed;
  } catch {
    try { storage.removeItem(key); } catch { /* best effort */ }
    return null;
  }
}

export function clearSoloGameRecovery(storage: RecoveryStorage, playerId: string): void {
  if (!playerId || playerId.length > 128) return;
  try { storage.removeItem(storageKey(playerId)); } catch { /* best effort */ }
}

/** Stable key for applying one confirmed reward only once per game/round. */
export function createSoloGameRewardKey(
  gameId: string,
  round: number,
  reward: Exclude<SoloGamePendingReward, null>,
): string {
  return `${gameId}:${round}:${reward}`;
}
