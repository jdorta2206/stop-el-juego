import { describe, expect, it } from "vitest";
import { buildAdmobPendingResponse } from "../lib/admobRewardPoll";

describe("AdMob rewarded SSV polling response", () => {
  it("returns a non-ready response when the request does not exist", () => {
    expect(buildAdmobPendingResponse(undefined)).toEqual({ ready: false });
  });

  it("preserves the client state for a consumed request without claiming a reward", () => {
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
});
