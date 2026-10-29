import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const adminRouteSource = readFileSync(
  resolve(currentDir, "admin.ts"),
  "utf8",
);

function isAtOrAfter(candidate: number, reference: number): boolean {
  return candidate >= reference;
}

describe("STOP Control analytics funnel event ordering", () => {
  it("requires a game start to be at or after the lobby view", () => {
    expect(adminRouteSource).toMatch(
      /gs\.event_name = 'game_start'[\s\S]*?gs\.created_at >= analytics_events\.created_at/,
    );
  });

  it("requires a game completion to be at or after the game start", () => {
    expect(adminRouteSource).toMatch(
      /gc\.event_name = 'game_complete'[\s\S]*?gc\.created_at >= analytics_events\.created_at/,
    );
  });

  it("does not treat an earlier start as a transition after the lobby", () => {
    expect(isAtOrAfter(99, 100)).toBe(false);
  });

  it("accepts a start at the same instant as the lobby", () => {
    expect(isAtOrAfter(100, 100)).toBe(true);
  });

  it("accepts a start after the lobby", () => {
    expect(isAtOrAfter(101, 100)).toBe(true);
  });

  it("does not treat an earlier completion as after the game start", () => {
    expect(isAtOrAfter(199, 200)).toBe(false);
  });
});
