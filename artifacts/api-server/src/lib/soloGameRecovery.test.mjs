import { describe, expect, it } from "vitest";
import {
  clearSoloGameRecovery,
  readSoloGameRecovery,
  saveSoloGameRecovery,
  SOLO_GAME_RECOVERY_MAX_AGE_MS,
} from "../../../stop-game/src/lib/soloGameRecovery.ts";

class MemoryStorage {
  values = new Map();
  getItem(key) { return this.values.get(key) ?? null; }
  setItem(key, value) { this.values.set(key, value); }
  removeItem(key) { this.values.delete(key); }
}

const NOW = Date.now();
const checkpoint = (playerId = "player-123") => ({
  version: 1,
  gameId: "game-12345678",
  playerId,
  mode: "normal",
  savedAt: NOW,
  payload: { round: 2, responses: { Animal: "Gato" } },
});

describe("solo game recovery storage", () => {
  it("round-trips a fresh checkpoint for the same player", () => {
    const storage = new MemoryStorage();
    expect(saveSoloGameRecovery(storage, checkpoint())).toBe(true);
    expect(readSoloGameRecovery(storage, "player-123", NOW + 1_000)).toEqual(checkpoint());
  });
  it("never returns another player's checkpoint", () => {
    const storage = new MemoryStorage();
    saveSoloGameRecovery(storage, checkpoint("player-A"));
    expect(readSoloGameRecovery(storage, "player-B", NOW + 1_000)).toBeNull();
  });
  it("discards expired checkpoints", () => {
    const storage = new MemoryStorage();
    saveSoloGameRecovery(storage, checkpoint());
    expect(readSoloGameRecovery(storage, "player-123", NOW + SOLO_GAME_RECOVERY_MAX_AGE_MS + 1)).toBeNull();
  });
  it("rejects timestamps too far in the future", () => {
    const storage = new MemoryStorage();
    expect(saveSoloGameRecovery(storage, { ...checkpoint(), savedAt: Date.now() + 120_000 })).toBe(false);
  });
  it("clears only the selected player's checkpoint", () => {
    const storage = new MemoryStorage();
    saveSoloGameRecovery(storage, checkpoint("player-A"));
    saveSoloGameRecovery(storage, checkpoint("player-B"));
    clearSoloGameRecovery(storage, "player-A");
    expect(readSoloGameRecovery(storage, "player-A", NOW + 1_000)).toBeNull();
    expect(readSoloGameRecovery(storage, "player-B", NOW + 1_000)).not.toBeNull();
  });
  it("removes malformed JSON rather than restoring it", () => {
    const storage = new MemoryStorage();
    storage.setItem("stop_solo_game_recovery_v1:player-123", "{");
    expect(readSoloGameRecovery(storage, "player-123", 11_000)).toBeNull();
    expect(storage.getItem("stop_solo_game_recovery_v1:player-123")).toBeNull();
  });
});
