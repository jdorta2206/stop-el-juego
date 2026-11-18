import { beforeEach, describe, expect, it, vi } from "vitest";

const { transaction } = vi.hoisted(() => ({ transaction: vi.fn() }));

vi.mock("@workspace/db", () => ({
  db: { transaction },
  wordValidationCacheTable: {
    isValid: "is_valid",
    source: "source",
    createdAt: "created_at",
    word: "word",
    category: "category",
    lang: "lang",
  },
}));

import { isExpiredNegativeAiVerdict, reserveDailyQuota } from "./aiWordValidator";

describe("AI word-validation cache expiry", () => {
  const now = Date.UTC(2026, 10, 18);

  it("expires an AI negative verdict only after seven days", () => {
    expect(isExpiredNegativeAiVerdict(false, "ai", new Date(now - 8 * 86400000), now)).toBe(true);
    expect(isExpiredNegativeAiVerdict(false, "ai", new Date(now - 6 * 86400000), now)).toBe(false);
  });

  it("does not expire positive verdicts", () => {
    expect(isExpiredNegativeAiVerdict(true, "ai", new Date(now - 30 * 86400000), now)).toBe(false);
  });

  it.each(["manual", "dict"])("preserves old negative %s verdicts", (source) => {
    expect(isExpiredNegativeAiVerdict(false, source, new Date(now - 30 * 86400000), now)).toBe(false);
  });
});

describe("AI word-validation daily quota reservation", () => {
  beforeEach(() => transaction.mockReset());

  it("reserves the global and player quota together", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ used: 1 }] })
      .mockResolvedValueOnce({ rows: [{ used: 1 }] });
    transaction.mockImplementation(async (callback) => callback({ execute }));

    await expect(reserveDailyQuota("player-1")).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("blocks when the global quota is exhausted", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [] });
    transaction.mockImplementation(async (callback) => callback({ execute }));

    await expect(reserveDailyQuota("player-1")).resolves.toBe(false);
    expect(execute).toHaveBeenCalledTimes(1);
  });

  it("blocks when the player's quota is exhausted", async () => {
    const execute = vi.fn()
      .mockResolvedValueOnce({ rows: [{ used: 500 }] })
      .mockResolvedValueOnce({ rows: [] });
    transaction.mockImplementation(async (callback) => callback({ execute }));

    await expect(reserveDailyQuota("player-1")).resolves.toBe(false);
    expect(execute).toHaveBeenCalledTimes(2);
  });

  it("reserves only the global quota for an anonymous player", async () => {
    const execute = vi.fn().mockResolvedValueOnce({ rows: [{ used: 1 }] });
    transaction.mockImplementation(async (callback) => callback({ execute }));

    await expect(reserveDailyQuota(null)).resolves.toBe(true);
    expect(execute).toHaveBeenCalledTimes(1);
  });
});
