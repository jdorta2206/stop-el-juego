import { afterEach, describe, expect, it, vi } from "vitest";
import { readResult } from "../../../stop-game/src/lib/twaAdBridge.ts";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readClientSource = (path: string) => readFileSync(resolve(currentDir, path), "utf8");
const bridgeSource = readClientSource("../../../stop-game/src/lib/twaAdBridge.ts");
const rewardedSource = readClientSource("../../../stop-game/src/components/AdSystemFixed.tsx");
const soloGameSource = readClientSource("../../../stop-game/src/pages/SoloGame.tsx");
const adminAnalyticsSource = readFileSync(resolve(currentDir, "./adminAnalytics.ts"), "utf8");


afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("rewarded AdMob client safety regressions", () => {
  it("aborts a genuinely stalled result request after ten seconds", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("window", globalThis);

    let requestSignal: AbortSignal | undefined;
    const stalledFetch = vi.fn((_input: RequestInfo | URL, init?: RequestInit) => {
      requestSignal = init?.signal as AbortSignal;
      return new Promise<Response>((_resolve, reject) => {
        requestSignal?.addEventListener("abort", () => {
          reject(new DOMException("The operation was aborted", "AbortError"));
        }, { once: true });
      });
    });
    vi.stubGlobal("fetch", stalledFetch);

    const resultPromise = readResult("timeout-regression");
    expect(stalledFetch).toHaveBeenCalledTimes(1);
    expect(requestSignal?.aborted).toBe(false);

    await vi.advanceTimersByTimeAsync(10_000);

    await expect(resultPromise).resolves.toBeNull();
    expect(requestSignal?.aborted).toBe(true);
  });

  it("bounds result polling and acknowledgement fetches with AbortController", () => {
    expect(bridgeSource).toContain("const RESULT_REQUEST_TIMEOUT_MS = 10_000");
    expect(bridgeSource.match(/controller\.abort\(\)/g)).toHaveLength(2);
    expect(bridgeSource.match(/signal: controller\.signal/g)).toHaveLength(2);
    expect(bridgeSource).toContain("window.clearTimeout(timeout)");
  });

  it("records completion only after the confirmed reward has been applied", () => {
    const apply = rewardedSource.indexOf("const applied = await applyConfirmedRewardOnce");
    const completed = rewardedSource.indexOf('trackAnalyticsEvent("rewarded_ad_completed"');
    expect(apply).toBeGreaterThan(-1);
    expect(completed).toBeGreaterThan(apply);
    expect(rewardedSource).toContain('trackAnalyticsEvent("rewarded_ad_ssv_confirmed"');
  });

  it("does not silently accept a confirmed hint when its pending hint disappeared", () => {
    const hintBranch = soloGameSource.indexOf('} else if (rewardedAdType === "hint")');
    const missingHint = soloGameSource.indexOf("throw new Error", hintBranch);
    const clearPending = soloGameSource.indexOf("pendingHintRef.current = null", hintBranch);
    expect(hintBranch).toBeGreaterThan(-1);
    expect(missingHint).toBeGreaterThan(hintBranch);
    expect(clearPending).toBeGreaterThan(missingHint);
  });

  it("counts actual ad_impression events separately from rewarded completions", () => {
    expect(adminAnalyticsSource).toContain("COUNT(*) FILTER (WHERE event_name = 'ad_impression')::int AS ad_impressions");
    expect(adminAnalyticsSource).not.toContain("event_name IN ('ad_impression','rewarded_ad_completed')");
  });
});
