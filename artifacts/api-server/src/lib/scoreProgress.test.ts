import { describe, expect, it } from "vitest";
import { calcLevel, calcLevelAfterXp } from "./scoreProgress";

describe("score XP level calculation", () => {
  it("uses the cumulative XP balance, not only the latest award", () => {
    expect(calcLevelAfterXp(90, 20)).toBe(2);
    expect(calcLevelAfterXp(240, 20)).toBe(3);
  });

  it("does not lower a level when XP is zero or negative", () => {
    expect(calcLevelAfterXp(450, 0)).toBe(4);
    expect(calcLevelAfterXp(450, -10)).toBe(4);
  });

  it("keeps the first level for a new player below the first threshold", () => {
    expect(calcLevel(99)).toBe(1);
    expect(calcLevelAfterXp(0, 100)).toBe(2);
  });
});
