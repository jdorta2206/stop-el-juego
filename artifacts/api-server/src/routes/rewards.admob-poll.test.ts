import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
import { buildAdmobPendingResponse } from "../lib/admobRewardPoll";

const currentDir = dirname(fileURLToPath(import.meta.url));
const rewardsRouteSource = readFileSync(
  resolve(currentDir, "rewards.ts"),
  "utf8",
);

describe("AdMob rewarded SSV polling response", () => {
  it("returns a non-ready response when the request does not exist", () => {
    expect(buildAdmobPendingResponse(undefined)).toEqual({ ready: false });
  });

  it("preserves the client state for a pending request without claiming a reward", () => {
    expect(buildAdmobPendingResponse({ client_state: "earned" })).toEqual({
      ready: false,
      clientState: "earned",
    });
  });

  it("keeps an earned client callback pending until signed SSV confirms it", () => {
    const response = buildAdmobPendingResponse({ client_state: "earned" });

    expect(response.ready).toBe(false);
    expect(response.clientState).toBe("earned");
    expect(response).not.toHaveProperty("rewarded", true);
  });

  it("preserves dismissed state without marking the reward as ready", () => {
    expect(buildAdmobPendingResponse({ client_state: "dismissed" })).toEqual({
      ready: false,
      clientState: "dismissed",
    });
  });

  it("reopens a consumed, unearned request when a late signed SSV callback confirms it", () => {
    const conflictStart = rewardsRouteSource.indexOf(
      "ON CONFLICT (request_id) DO UPDATE SET",
    );
    const conflictEnd = rewardsRouteSource.indexOf("\n    `);", conflictStart);
    const conflictUpdate = rewardsRouteSource.slice(conflictStart, conflictEnd);

    expect(conflictStart).toBeGreaterThanOrEqual(0);
    expect(conflictEnd).toBeGreaterThan(conflictStart);
    expect(conflictUpdate).toContain("consumed_at = CASE");
    expect(conflictUpdate).toContain("WHEN admob_reward_requests.rewarded = false THEN NULL");
    expect(conflictUpdate).toContain("ELSE admob_reward_requests.consumed_at");
  });
});
