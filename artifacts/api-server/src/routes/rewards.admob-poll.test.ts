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

  it("ignores a replayed Google transaction tied to a different request ID", () => {
    expect(rewardsRouteSource).toContain("ON CONFLICT DO NOTHING");
    expect(rewardsRouteSource).toContain("duplicate_transaction_ignored");
    expect(rewardsRouteSource).toContain("WHERE transaction_id = ${transactionId}");
    expect(rewardsRouteSource).toContain("request_id <> ${requestId}");
  });

  it("reopens a consumed, unearned request when its late signed SSV callback arrives", () => {
    const updateStart = rewardsRouteSource.indexOf("UPDATE admob_reward_requests", rewardsRouteSource.indexOf("duplicate_transaction_ignored"));
    const updateEnd = rewardsRouteSource.indexOf("\n      `);", updateStart);
    const update = rewardsRouteSource.slice(updateStart, updateEnd);

    expect(updateStart).toBeGreaterThanOrEqual(0);
    expect(updateEnd).toBeGreaterThan(updateStart);
    expect(update).toContain("consumed_at = CASE");
    expect(update).toContain("WHEN rewarded = false THEN NULL");
    expect(update).toContain("ELSE consumed_at");
    expect(update).toContain("AND NOT EXISTS");
  });
});

describe("AdMob rewarded result consumption", () => {
  const consumeStart = rewardsRouteSource.indexOf('router.post("/admob-result/:requestId/consume"');
  const consumeEnd = rewardsRouteSource.indexOf('router.get("/admob-ssv"', consumeStart);
  const consumeHandler = rewardsRouteSource.slice(consumeStart, consumeEnd);

  it("only returns success after consuming a verified reward or confirming prior consumption", () => {
    expect(consumeHandler).toContain("AND rewarded = true");
    expect(consumeHandler).toContain("AND consumed_at IS NULL");
    expect(consumeHandler).toContain("RETURNING request_id");
    expect(consumeHandler).toContain("existing.rewarded && existing.consumed_at");
  });

  it("does not acknowledge missing or unverified requests as consumed", () => {
    expect(consumeHandler).toContain('res.status(404).json({ error: "Reward request not found" })');
    expect(consumeHandler).toContain('res.status(409).json({ error: "Reward result is not confirmed or consumed" })');
  });
});
