import { describe, expect, it } from "vitest";
import {
  clearSoloGameRecovery,
  readSoloGameRecovery,
  saveSoloGameRecovery,
  SOLO_GAME_RECOVERY_MAX_AGE_MS,
} from "../../../stop-game/src/lib/soloGameRecovery";

class MemoryStorage {
  values = new Map<string, string>();
  getItem(key: string) { return this.values.get(key) ?? null; }
  setItem(key: string, value: string) { this.values.set(key, value); }
  removeItem(key: string) { this.values.delete(key); }
}

const checkpoint = (playerId = "player-123", savedAt = Date.now()) => ({
  version: 1 as const,
  gameId: "game-12345678",
  playerId,
  mode: "normal",
  savedAt,
  payload: { round: 2, responses: { Animal: "Gato" } },
});

describe("solo game recovery storage", () => {
  it("round-trips a fresh checkpoint for the same player", () => {
    const storage = new MemoryStorage();
    const snapshot = checkpoint();
    expect(saveSoloGameRecovery(storage, snapshot)).toBe(true);
    expect(readSoloGameRecovery(storage, "player-123")).toEqual(snapshot);
  });

  it("never returns another player's checkpoint", () => {
    const storage = new MemoryStorage();
    saveSoloGameRecovery(storage, checkpoint("player-A"));
    expect(readSoloGameRecovery(storage, "player-B")).toBeNull();
  });

  it("discards expired checkpoints", () => {
    const storage = new MemoryStorage();
    const now = Date.now();
    saveSoloGameRecovery(storage, checkpoint("player-123", now));
    expect(readSoloGameRecovery(storage, "player-123", now + SOLO_GAME_RECOVERY_MAX_AGE_MS + 1)).toBeNull();
  });

  it("rejects timestamps too far in the future", () => {
    const storage = new MemoryStorage();
    expect(saveSoloGameRecovery(storage, checkpoint("player-123", Date.now() + 120_000))).toBe(false);
  });

  it("rejects null, array and primitive payloads", () => {
    const storage = new MemoryStorage();
    expect(saveSoloGameRecovery(storage, { ...checkpoint(), payload: null } as never)).toBe(false);
    expect(saveSoloGameRecovery(storage, { ...checkpoint(), payload: ["not", "a", "snapshot"] } as never)).toBe(false);
    expect(saveSoloGameRecovery(storage, { ...checkpoint(), payload: "invalid" } as never)).toBe(false);
  });

  it("removes a stored checkpoint with a non-object payload", () => {
    const storage = new MemoryStorage();
    storage.setItem("stop_solo_game_recovery_v1:player-123", JSON.stringify({ ...checkpoint(), payload: null }));
    expect(readSoloGameRecovery(storage, "player-123")).toBeNull();
    expect(storage.getItem("stop_solo_game_recovery_v1:player-123")).toBeNull();
  });

  it("clears only the selected player's checkpoint", () => {
    const storage = new MemoryStorage();
    saveSoloGameRecovery(storage, checkpoint("player-A"));
    saveSoloGameRecovery(storage, checkpoint("player-B"));
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
});
