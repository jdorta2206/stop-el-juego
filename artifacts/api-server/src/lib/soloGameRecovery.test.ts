import { describe, expect, it } from "vitest";
import {
  clearSoloGameRecovery,
  createSoloGameRewardKey,
  readSoloGameRecovery,
  saveSoloGameRecovery,
  SOLO_GAME_RECOVERY_MAX_AGE_MS,
  type SoloGameRecoveryEnvelope,
} from "../../../stop-game/src/lib/soloGameRecovery";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const makeCheckpoint = (
  playerId = "player-123",
  savedAt = Date.now(),
): SoloGameRecoveryEnvelope => ({
  version: 1,
  gameId: "game-12345678",
  playerId,
  mode: "normal",
  savedAt,
  payload: {
    phase: "PLAYING",
    currentLetter: "A",
    timeLeft: 37,
    round: 2,
    categories: ["Animal", "Color"],
    responses: { Animal: "Gato", Color: "" },
    totalScore: 45,
    aiTotalScore: 30,
    gameSubmissionId: "game-12345678",
    scoreTokens: ["signed-round-token"],
    rankingScoreTokens: [],
    rewardedUsed: false,
    hintUsed: false,
    doubleUsed: false,
    pendingReward: "hint",
    pendingHint: { category: "Color", word: "Azul" },
    appliedRewardKeys: [],
    randomEvent: "easy_letter",
    activeCard: "shield",
    cardUsed: false,
    sabotageCategory: null,
    hiddenCategoryIdx: null,
    bluffedCategories: [],
    aiBluffSetup: { category: "Animal", wasActuallyBluffing: false },
    spyUsesLeft: 1,
    spyUsesThisRound: 0,
    spyReveal: { category: "Animal", word: "Ardilla" },
    combo: 2,
    insaneMode: false,
    tutorialActive: false,
    isFirstEverGame: false,
    randomRoundTime: 35,
    bestRoundScore: 25,
  },
});

describe("solo game recovery storage", () => {
  it("round-trips a valid active-round checkpoint including gameplay modifiers", () => {
    const storage = new MemoryStorage();
    const snapshot = makeCheckpoint();
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(true);
    expect(readSoloGameRecovery(storage, "player-123")).toEqual(snapshot);
  });


  it("restores a guest checkpoint using the persisted guest identity", () => {
    const storage = new MemoryStorage();
    const guestId = "guest_12345678-1234-4234-8234-123456789abc";
    const snapshot = makeCheckpoint(guestId);
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(true);
    expect(readSoloGameRecovery(storage, guestId)).toEqual(snapshot);
    expect(readSoloGameRecovery(storage, "guest_different-device-id")).toBeNull();
  });

  it("never returns another player's checkpoint", () => {
    const storage = new MemoryStorage();
    expect(saveSoloGameRecovery(storage, makeCheckpoint("player-A"))).toBe(true);
    expect(readSoloGameRecovery(storage, "player-B")).toBeNull();
  });

  it("discards expired checkpoints", () => {
    const storage = new MemoryStorage();
    const now = Date.now();
    expect(saveSoloGameRecovery(storage, makeCheckpoint("player-123", now))).toBe(true);
    expect(readSoloGameRecovery(storage, "player-123", now + SOLO_GAME_RECOVERY_MAX_AGE_MS + 1)).toBeNull();
  });

  it("rejects timestamps too far in the future", () => {
    const storage = new MemoryStorage();
    expect(saveSoloGameRecovery(storage, makeCheckpoint("player-123", Date.now() + 120_000))).toBe(false);
  });

  it("rejects non-object payloads", () => {
    const storage = new MemoryStorage();
    const base = makeCheckpoint();
    expect(saveSoloGameRecovery(storage, { ...base, payload: null } as never)).toBe(false);
    expect(saveSoloGameRecovery(storage, { ...base, payload: ["not", "a", "snapshot"] } as never)).toBe(false);
    expect(saveSoloGameRecovery(storage, { ...base, payload: "invalid" } as never)).toBe(false);
  });

  it("rejects a hint reward without its exact pending category and word", () => {
    const storage = new MemoryStorage();
    const snapshot = makeCheckpoint();
    snapshot.payload.pendingHint = null;
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
  });

  it("rejects a pending hint when the reward is not a hint", () => {
    const storage = new MemoryStorage();
    const snapshot = makeCheckpoint();
    snapshot.payload.pendingReward = "extraTime";
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
  });

  it("rejects checkpoints whose submission id differs from the envelope game id", () => {
    const storage = new MemoryStorage();
    const snapshot = makeCheckpoint();
    snapshot.payload.gameSubmissionId = "different-game-id";
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
  });

  it("rejects invalid round numbers, timers and random-event names", () => {
    const storage = new MemoryStorage();
    const snapshot = makeCheckpoint();
    snapshot.payload.round = 4;
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
    snapshot.payload.round = 2;
    snapshot.payload.timeLeft = 999;
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
    snapshot.payload.timeLeft = 37;
    snapshot.payload.randomEvent = "not-an-event" as never;
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
  });

  it("rejects invalid anti-cheat and bluff state", () => {
    const storage = new MemoryStorage();
    const snapshot = makeCheckpoint();
    snapshot.payload.scoreTokens = [""];
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
    snapshot.payload.scoreTokens = ["valid-token"];
    snapshot.payload.aiBluffSetup = { category: "Animal", wasActuallyBluffing: "yes" } as never;
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(false);
  });

  it("removes a stored checkpoint with malformed payload data", () => {
    const storage = new MemoryStorage();
    storage.setItem(
      "stop_solo_game_recovery_v1:player-123",
      JSON.stringify({ ...makeCheckpoint(), payload: null }),
    );
    expect(readSoloGameRecovery(storage, "player-123")).toBeNull();
    expect(storage.getItem("stop_solo_game_recovery_v1:player-123")).toBeNull();
  });

  it("clears only the selected player's checkpoint", () => {
    const storage = new MemoryStorage();
    expect(saveSoloGameRecovery(storage, makeCheckpoint("player-A"))).toBe(true);
    expect(saveSoloGameRecovery(storage, makeCheckpoint("player-B"))).toBe(true);
    clearSoloGameRecovery(storage, "player-A");
    expect(readSoloGameRecovery(storage, "player-A")).toBeNull();
    expect(readSoloGameRecovery(storage, "player-B")).not.toBeNull();
  });

  it("removes malformed JSON rather than restoring it", () => {
    const storage = new MemoryStorage();
    storage.setItem("stop_solo_game_recovery_v1:player-123", "{");
    expect(readSoloGameRecovery(storage, "player-123")).toBeNull();
    expect(storage.getItem("stop_solo_game_recovery_v1:player-123")).toBeNull();
  });

  it("creates stable per-round reward application keys", () => {
    expect(createSoloGameRewardKey("game-12345678", 2, "hint")).toBe("game-12345678:2:hint");
    expect(createSoloGameRewardKey("game-12345678", 3, "extraTime")).not.toBe("game-12345678:2:extraTime");
  });
});
