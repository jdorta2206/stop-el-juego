const STORAGE_KEY = "stop_guest_progress_v1";
const MAX_PENDING_GAMES = 20;
// Server-issued score vouchers expire after 30 minutes. Retire migration
// attempts a little earlier to allow for clock/network delay; local best and
// accumulated points are deliberately preserved.
const GUEST_VOUCHER_MIGRATION_MAX_AGE_MS = 25 * 60 * 1000;

export type PendingGuestGame = {
  submissionId: string;
  score: number;
  letter: string;
  mode: "solo" | "daily";
  won: boolean;
  scoreTokens: string[];
  createdAt: number;
};

type GuestProgress = {
  version: 1;
  bestScore: number;
  totalPoints: number;
  pendingGames: PendingGuestGame[];
  recordedSubmissionIds: string[];
};

function emptyProgress(): GuestProgress {
  return { version: 1, bestScore: 0, totalPoints: 0, pendingGames: [], recordedSubmissionIds: [] };
}

function readProgress(): GuestProgress {
  try {
    if (typeof localStorage === "undefined") return emptyProgress();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyProgress();
    const parsed = JSON.parse(raw) as Partial<GuestProgress>;
    if (parsed.version !== 1) return emptyProgress();
    return {
      version: 1,
      bestScore: Number.isFinite(parsed.bestScore) ? Math.max(0, Number(parsed.bestScore)) : 0,
      totalPoints: Number.isFinite(parsed.totalPoints) ? Math.max(0, Number(parsed.totalPoints)) : 0,
      pendingGames: Array.isArray(parsed.pendingGames) ? parsed.pendingGames.filter((game): game is PendingGuestGame =>
        !!game && typeof game.submissionId === "string" &&
        Number.isFinite(game.score) && game.score >= 0 &&
        (game.mode === "solo" || game.mode === "daily") &&
        Array.isArray(game.scoreTokens) && game.scoreTokens.every((token) => typeof token === "string") &&
        Number.isFinite(game.createdAt) && game.createdAt > 0
      ).slice(-MAX_PENDING_GAMES) : [],
      recordedSubmissionIds: Array.isArray(parsed.recordedSubmissionIds)
        ? parsed.recordedSubmissionIds.filter((id): id is string => typeof id === "string").slice(-100)
        : [],
    };
  } catch {
    return emptyProgress();
  }
}

function writeProgress(progress: GuestProgress): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch {
    // Storage may be unavailable or full; guest gameplay must continue normally.
  }
}

/** Save local guest progress and retain only scores that carry server-issued vouchers for later migration. */
export function saveGuestProgress(input: Omit<PendingGuestGame, "createdAt">): void {
  try {
    const progress = readProgress();
    const alreadyRecorded = progress.recordedSubmissionIds.includes(input.submissionId);
    const alreadyPending = progress.pendingGames.some((game) => game.submissionId === input.submissionId);
    progress.bestScore = Math.max(progress.bestScore, Math.max(0, Math.floor(input.score)));
    if (!alreadyRecorded) {
      progress.totalPoints += Math.max(0, Math.floor(input.score));
      progress.recordedSubmissionIds.push(input.submissionId);
      progress.recordedSubmissionIds = progress.recordedSubmissionIds.slice(-100);
    }
    if (!alreadyPending && input.scoreTokens.length > 0 && input.scoreTokens.length <= 64) {
      progress.pendingGames.push({
        ...input,
        score: Math.max(0, Math.floor(input.score)),
        scoreTokens: [...input.scoreTokens],
        createdAt: Date.now(),
      });
      progress.pendingGames = progress.pendingGames.slice(-MAX_PENDING_GAMES);
    }
    writeProgress(progress);
  } catch {
    // Never interrupt the game for local progress bookkeeping.
  }
}

/**
 * Return only migration candidates whose vouchers should still be within the
 * server's 30-minute validity window. Expired candidates are removed from the
 * retry queue, but local best/total/recorded IDs are preserved. The server
 * remains authoritative and validates every voucher regardless of this filter.
 */
export function getPendingGuestGames(): PendingGuestGame[] {
  const progress = readProgress();
  const now = Date.now();
  const eligible = progress.pendingGames.filter((game) =>
    now - game.createdAt < GUEST_VOUCHER_MIGRATION_MAX_AGE_MS
  );
  if (eligible.length !== progress.pendingGames.length) {
    progress.pendingGames = eligible;
    writeProgress(progress);
  }
  return eligible;
}

/** Remove only the acknowledged submission; keep the local best and accumulated total. */
export function removePendingGuestGame(submissionId: string): void {
  try {
    const progress = readProgress();
    progress.pendingGames = progress.pendingGames.filter((game) => game.submissionId !== submissionId);
    writeProgress(progress);
  } catch {
    // Keep the item if storage cannot be updated; server idempotency protects retries.
  }
}
