import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const adminRouteSource = readFileSync(
  resolve(currentDir, "admin.ts"),
  "utf8",
);

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
});
