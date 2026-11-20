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
  if (!playerId.trim() || !gameMode.trim() || !packId.trim()
    || !payload || typeof payload !== "object" || Array.isArray(payload)) return false;
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
  const key = storageKey(playerId);
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return null;
    const value = JSON.parse(raw) as Partial<SoloGameRecoverySnapshot>;
    const now = Date.now();
    if (
      value.version !== 1
      || value.playerId !== playerId
      || typeof value.gameMode !== "string"
      || !value.gameMode.trim()
      || typeof value.packId !== "string"
      || !value.packId.trim()
      || typeof value.savedAt !== "number"
      || !Number.isFinite(value.savedAt)
      || !value.payload
      || typeof value.payload !== "object"
      || Array.isArray(value.payload)
      || now - value.savedAt > MAX_AGE_MS
      || value.savedAt > now + 60_000
    ) {
      window.localStorage.removeItem(key);
      return null;
    }
    return value as SoloGameRecoverySnapshot;
  } catch {
    // A corrupt or inaccessible snapshot must never block a fresh game.
    try { window.localStorage.removeItem(key); } catch { /* best effort */ }
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

/**
 * Validate that a persisted snapshot belongs to the currently selected game
 * and contains the minimum state needed to resume it safely.
 */
export function isRestorableSoloGameRecovery(
  snapshot: SoloGameRecoverySnapshot | null,
  gameMode: string,
  packId: string,
): snapshot is SoloGameRecoverySnapshot {
  if (!snapshot || snapshot.gameMode !== gameMode || snapshot.packId !== packId
    || !snapshot.playerId.trim() || !snapshot.gameMode.trim() || !snapshot.packId.trim()
    || !Number.isFinite(snapshot.savedAt)) return false;
  const payload = snapshot.payload;
  const isRecord = (value: unknown): value is Record<string, unknown> =>
    !!value && typeof value === "object" && !Array.isArray(value);
  const optionalFinite = (key: string, min = 0) =>
    payload[key] === undefined || (typeof payload[key] === "number"
      && Number.isFinite(payload[key]) && (payload[key] as number) >= min);
  const optionalStringArray = (key: string) =>
    payload[key] === undefined || (Array.isArray(payload[key])
      && payload[key].every(item => typeof item === "string"));
  const validRandomEvents = ["double_xp", "easy_letter", "speed", "hidden_category", "time_bomb", null];
  const validCards = ["oracle", "sabotage", "double_or_nothing", "steal", "lightning", "shield", null];
  const responsesValid = payload.responses === undefined || (isRecord(payload.responses)
    && Object.values(payload.responses).every(answer => typeof answer === "string"));
  const roundResultsValid = payload.roundResults === undefined || payload.roundResults === null
    || isRecord(payload.roundResults);
  const pendingHintValid = payload.pendingHint === undefined || payload.pendingHint === null
    || (isRecord(payload.pendingHint) && typeof payload.pendingHint.category === "string"
      && typeof payload.pendingHint.word === "string");
  const pendingBonusValid = payload.pendingDoubleBonus === undefined || payload.pendingDoubleBonus === null
    || (isRecord(payload.pendingDoubleBonus)
      && typeof payload.pendingDoubleBonus.playerId === "string"
      && typeof payload.pendingDoubleBonus.submissionId === "string"
      && typeof payload.pendingDoubleBonus.bonus === "number"
      && Number.isFinite(payload.pendingDoubleBonus.bonus)
      && payload.pendingDoubleBonus.bonus > 0);
  return (payload.state === "PLAYING" || payload.state === "RESULTS")
    && typeof payload.currentLetter === "string"
    && payload.currentLetter.trim().length > 0
    && typeof payload.timeLeft === "number"
    && Number.isFinite(payload.timeLeft)
    && payload.timeLeft >= 0
    && Array.isArray(payload.categories)
    && payload.categories.length > 0
    && payload.categories.every(category => typeof category === "string" && category.trim().length > 0)
    && (payload.round === undefined || (Number.isInteger(payload.round)
      && (payload.round as number) >= 1 && (payload.round as number) <= 3))
    && optionalFinite("totalScore")
    && optionalFinite("aiTotalScore")
    && optionalFinite("spyUsesLeft")
    && optionalFinite("spyUsesThisRound")
    && responsesValid
    && roundResultsValid
    && pendingHintValid
    && pendingBonusValid
    && (payload.randomEvent === undefined || validRandomEvents.includes(payload.randomEvent as string | null))
    && (payload.activeCard === undefined || validCards.includes(payload.activeCard as string | null))
    && optionalStringArray("scoreTokens")
    && optionalStringArray("rankingScoreTokens")
    && optionalStringArray("appliedRewardRequestIds");
}
