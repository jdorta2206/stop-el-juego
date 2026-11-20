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


export type PendingDoubleBonus = {
  playerId: string;
  submissionId: string;
  bonus: number;
  aiTotalScore: number;
  letter: string;
  scoreTokens: string[];
  createdAt: number;
};

const BONUS_OUTBOX_PREFIX = "stop_double_bonus_outbox_v1";
const BONUS_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

function bonusOutboxKey(playerId: string): string {
  return `${BONUS_OUTBOX_PREFIX}:${encodeURIComponent(playerId)}`;
}

export function savePendingDoubleBonus(
  value: Omit<PendingDoubleBonus, "createdAt">,
): boolean {
  if (!value.playerId.trim() || !value.submissionId.trim() || !Number.isFinite(value.bonus) || value.bonus <= 0) return false;
  try {
    const key = bonusOutboxKey(value.playerId);
    const now = Date.now();
    const raw = window.localStorage.getItem(key);
    const existing = raw ? JSON.parse(raw) as PendingDoubleBonus[] : [];
    const valid = Array.isArray(existing)
      ? existing.filter(item => item && item.playerId === value.playerId
        && typeof item.submissionId === "string"
        && Number.isFinite(item.createdAt)
        && now - item.createdAt <= BONUS_MAX_AGE_MS)
      : [];
    const next: PendingDoubleBonus = { ...value, createdAt: now };
    const withoutDuplicate = valid.filter(item => item.submissionId !== value.submissionId);
    withoutDuplicate.push(next);
    window.localStorage.setItem(key, JSON.stringify(withoutDuplicate));
    return true;
  } catch {
    return false;
  }
}

export function readPendingDoubleBonuses(playerId: string): PendingDoubleBonus[] {
  if (!playerId.trim()) return [];
  try {
    const key = bonusOutboxKey(playerId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return [];
    const value = JSON.parse(raw) as PendingDoubleBonus[];
    if (!Array.isArray(value)) {
      window.localStorage.removeItem(key);
      return [];
    }
    const now = Date.now();
    const valid = value.filter(item => item && item.playerId === playerId
      && typeof item.submissionId === "string" && item.submissionId.trim()
      && Number.isFinite(item.bonus) && item.bonus > 0
      && Number.isFinite(item.aiTotalScore)
      && typeof item.letter === "string"
      && Array.isArray(item.scoreTokens)
      && item.scoreTokens.every(token => typeof token === "string")
      && Number.isFinite(item.createdAt)
      && now - item.createdAt <= BONUS_MAX_AGE_MS
      && item.createdAt <= now + 60_000);
    if (valid.length !== value.length) window.localStorage.setItem(key, JSON.stringify(valid));
    return valid;
  } catch {
    return [];
  }
}

export function clearPendingDoubleBonus(playerId: string, submissionId: string): boolean {
  if (!playerId.trim() || !submissionId.trim()) return false;
  try {
    const key = bonusOutboxKey(playerId);
    const raw = window.localStorage.getItem(key);
    if (!raw) return true;
    const value = JSON.parse(raw) as PendingDoubleBonus[];
    if (!Array.isArray(value)) return false;
    window.localStorage.setItem(key, JSON.stringify(value.filter(item =>
      item?.playerId !== playerId || item?.submissionId !== submissionId
    )));
    return true;
  } catch {
    return false;
  }
}
