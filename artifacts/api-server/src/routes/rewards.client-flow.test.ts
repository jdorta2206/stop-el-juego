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
const rewardsRouteSource = readFileSync(resolve(currentDir, "./rewards.ts"), "utf8");


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

  it("persists an applied marker before consume and retries consume without reapplying", () => {
    const markApplied = rewardedSource.indexOf("const persisted = markStoredRewardApplied(requestId)");
    const consume = rewardedSource.indexOf("await acknowledgeRewardResult(requestId)", markApplied);
    const appliedMount = rewardedSource.indexOf('if (stored.status === "applied")');
    const retryConsume = rewardedSource.indexOf("acknowledgeRewardResult(stored.requestId)", appliedMount);
    const normalPending = rewardedSource.indexOf("setRetryRequestId(stored.requestId)", appliedMount);
    expect(markApplied).toBeGreaterThan(-1);
    expect(consume).toBeGreaterThan(markApplied);
    expect(appliedMount).toBeGreaterThan(-1);
    expect(retryConsume).toBeGreaterThan(appliedMount);
    expect(normalPending).toBeGreaterThan(retryConsume);
    expect(rewardedSource).toContain('status?: "pending" | "applied"');
    expect(rewardedSource).toContain("if (acknowledged) clearStoredPendingReward()");
    expect(rewardedSource).toContain("const [consumeAckPending, setConsumeAckPending] = useState(false)");
    expect(rewardedSource).toContain("retryConsumeAcknowledgement");
    expect(rewardedSource).toContain("consumeAckPending ? retryConsumeAcknowledgement : retryConfirmation");
    expect(bridgeSource).toContain("Promise<boolean>");
    expect(bridgeSource).toContain("if (response.ok) return true");
    expect(bridgeSource).toContain("return false");
  });

  it("sends the signed session token and binds result reads/consume to the request owner", () => {
    expect(bridgeSource).toContain('function getRewardAuthHeaders(): Record<string, string>');
    expect(bridgeSource).toContain('window.localStorage.getItem("stop_session_token")');
    expect(bridgeSource.match(/headers: getRewardAuthHeaders\(\)/g)).toHaveLength(2);
    expect(rewardsRouteSource).toContain('import { verifyClaimedIdentity } from "../lib/playerAuth";');
    expect(rewardsRouteSource).toContain("verifyClaimedIdentity(req, row.player_id)");
    expect(rewardsRouteSource).toContain("verifyClaimedIdentity(req, existing.player_id)");
    expect(rewardsRouteSource).toContain("AND player_id = ${existing.player_id}");
  });
  it("scopes pending rewards to the owning player and checks ownership before applied ACK recovery", () => {
    expect(rewardedSource).toContain("function pendingRewardStorageKey(playerId?: string): string");
    expect(rewardedSource).toContain("pendingRewardStorageKey(ownerId)");
    expect(rewardedSource).toContain("function saveStoredPendingReward(value: StoredPendingReward): boolean");
    const ownerCheck = rewardedSource.indexOf('if (!stored || stored.playerId !== (playerId || "guest")) return;');
    const appliedRecovery = rewardedSource.indexOf('if (stored.status === "applied")');
    expect(ownerCheck).toBeGreaterThan(-1);
    expect(appliedRecovery).toBeGreaterThan(ownerCheck);
    expect(rewardedSource).toContain('if (legacy.playerId !== ownerId) return null;');
    expect(rewardedSource).toContain('if (legacy.playerId === ownerId) window.localStorage.removeItem(PENDING_REWARD_STORAGE_KEY)');
    expect(rewardedSource).toContain("readStoredPendingReward(playerId)");
    expect(rewardedSource).toContain("clearStoredPendingReward(playerId)");
  });

  it("counts actual ad_impression events separately from rewarded completions", () => {
    expect(adminAnalyticsSource).toContain("COUNT(*) FILTER (WHERE event_name = 'ad_impression')::int AS ad_impressions");
    expect(adminAnalyticsSource).not.toContain("event_name IN ('ad_impression','rewarded_ad_completed')");
  });
});
