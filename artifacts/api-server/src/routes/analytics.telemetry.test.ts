import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const currentDir = dirname(fileURLToPath(import.meta.url));
const analyticsRouteSource = readFileSync(
  resolve(currentDir, "analytics.ts"),
  "utf8",
);
const allowlistMatch = analyticsRouteSource.match(
  /const TRUSTED_CLIENT_TELEMETRY_EVENTS = new Set\(([\s\S]*?)\);/,
);
if (!allowlistMatch) {
  throw new Error("Could not locate the production client telemetry allowlist");
}

describe("STOP gameplay telemetry allowlist", () => {
  it("includes completion and rewarded-ad events consumed by STOP Control", () => {
    const allowlist = allowlistMatch[1];
    for (const eventName of [
      "game_complete",
      "rewarded_ad_requested",
      "rewarded_ad_completed",
      "rewarded_ad_failed",
      "powerup_used",
    ]) {
      expect(allowlist).toContain(`"${eventName}"`);
    }
  });

  it("keeps telemetry trust classification separate from the reward-granting SSV flow", () => {
    expect(analyticsRouteSource).toContain("const trusted = TRUSTED_CLIENT_TELEMETRY_EVENTS.has(eventName)");
    expect(analyticsRouteSource).toContain('router.post("/event"');
    expect(analyticsRouteSource).toContain('router.post("/game-start"');
  });
});
