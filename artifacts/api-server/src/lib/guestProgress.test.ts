import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPendingGuestGames,
  removePendingGuestGame,
  saveGuestProgress,
} from "../../../stop-game/src/lib/guestProgress";

const STORAGE_KEY = "stop_guest_progress_v1";

function makeStorage() {
  const values = new Map<string, string>();
  return {
    getItem: (key: string) => values.get(key) ?? null,
    setItem: (key: string, value: string) => { values.set(key, value); },
    removeItem: (key: string) => { values.delete(key); },
    clear: () => values.clear(),
  };
}

function readStoredProgress() {
  return JSON.parse(globalThis.localStorage.getItem(STORAGE_KEY) ?? "{}");
}

function saveGame(submissionId: string, score: number, scoreTokens = ["signed-voucher"]) {
  saveGuestProgress({
    submissionId,
    score,
    letter: "A",
    mode: "solo",
    won: true,
    scoreTokens,
  });
}

describe("guest progress migration queue", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-10-14T12:00:00.000Z"));
    vi.stubGlobal("localStorage", makeStorage());
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it("saves local best and total once per submission while queuing only vouched games", () => {
    saveGame("game-1", 40);
    saveGame("game-1", 40);
    saveGame("game-2", 75, []);

    const progress = readStoredProgress();
    expect(progress.bestScore).toBe(75);
    expect(progress.totalPoints).toBe(115);
    expect(progress.recordedSubmissionIds).toEqual(["game-1", "game-2"]);
    expect(getPendingGuestGames().map((game) => game.submissionId)).toEqual(["game-1"]);
  });

  it("retires an old voucher from migration queue but preserves local progress", () => {
    saveGame("fresh-game", 60);
    saveGame("old-game", 90);

    // Simulate the first game being older than the safe 25-minute window.
    const progress = readStoredProgress();
    progress.pendingGames[0].createdAt -= 26 * 60 * 1000;
    globalThis.localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));

    expect(getPendingGuestGames().map((game) => game.submissionId)).toEqual(["old-game"]);
    const after = readStoredProgress();
    expect(after.bestScore).toBe(90);
    expect(after.totalPoints).toBe(150);
    expect(after.recordedSubmissionIds).toEqual(["fresh-game", "old-game"]);
    expect(after.pendingGames.map((game: { submissionId: string }) => game.submissionId)).toEqual(["old-game"]);
  });

  it("removes only the acknowledged submission from the queue", () => {
    saveGame("game-1", 20);
    saveGame("game-2", 30);

    removePendingGuestGame("game-1");

    expect(getPendingGuestGames().map((game) => game.submissionId)).toEqual(["game-2"]);
    const progress = readStoredProgress();
    expect(progress.bestScore).toBe(30);
    expect(progress.totalPoints).toBe(50);
    expect(progress.recordedSubmissionIds).toEqual(["game-1", "game-2"]);
  });
});
