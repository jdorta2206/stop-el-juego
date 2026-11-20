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

  it("fails closed when the request cannot be persisted before opening the native ad", () => {
    const requestCallback = bridgeSource.indexOf("onRequestCreated?.(requestId)");
    const deepLink = bridgeSource.indexOf("window.location.href = deepLink");
    expect(requestCallback).toBeGreaterThan(-1);
    expect(deepLink).toBeGreaterThan(requestCallback);
    expect(rewardedSource).toContain("const saved = saveStoredPendingReward({");
    expect(rewardedSource).toContain("if (!saved) {");
    expect(rewardedSource).toContain("no se abrirá el anuncio");
    const callbackStart = rewardedSource.indexOf("requestRewardedAd(placement, (requestId) => {");
    const callbackEnd = rewardedSource.indexOf("\n        });", callbackStart);
    const callbackBody = rewardedSource.slice(callbackStart, callbackEnd);
    expect(callbackStart).toBeGreaterThan(-1);
    expect(callbackEnd).toBeGreaterThan(callbackStart);
    // The persistence error must escape the callback; swallowing it would
    // allow requestRewardedAd to continue and launch the native ad.
    expect(callbackBody).not.toContain("catch");
  });

  it("does not report completion or consume when the applied marker cannot be persisted", () => {
    const apply = rewardedSource.indexOf("await onCompleteRef.current(amount)");
    const persist = rewardedSource.indexOf("const persisted = markStoredRewardApplied(requestId, playerId)", apply);
    const failure = rewardedSource.indexOf("if (!persisted)", persist);
    const consume = rewardedSource.indexOf("await acknowledgeRewardResult(requestId)", persist);
    const analytics = rewardedSource.indexOf('trackAnalyticsEvent("rewarded_ad_completed"');
    expect(apply).toBeGreaterThan(-1);
    expect(persist).toBeGreaterThan(apply);
    expect(failure).toBeGreaterThan(persist);
    expect(consume).toBeGreaterThan(failure);
    expect(rewardedSource).toContain("if (!rewardAppliedLocally) completedRewardRequestsRef.current.delete(requestId)");
    expect(rewardedSource).toContain("No se volverá a aplicar automáticamente en esta sesión.");
    expect(analytics).toBeGreaterThan(persist);
  });

  it("persists an applied marker before consume and retries consume without reapplying", () => {
    const markApplied = rewardedSource.indexOf("const persisted = markStoredRewardApplied(requestId, playerId)");
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
    expect(rewardedSource).toContain("if (acknowledged) clearStoredPendingReward(playerId)");
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
    expect(rewardedSource).toContain("function pendingRewardStorageKey(playerId: string): string");
    expect(rewardedSource).toContain("if (!playerId?.trim()) return null;");
    expect(rewardedSource).toContain("if (!value.playerId?.trim()) return false;");
    expect(rewardedSource).toContain("pendingRewardStorageKey(ownerId)");
    expect(rewardedSource).toContain("function saveStoredPendingReward(value: StoredPendingReward): boolean");
    const ownerCheck = rewardedSource.indexOf('if (!playerId || !stored || stored.playerId !== playerId) return;');
    const appliedRecovery = rewardedSource.indexOf('if (stored.status === "applied")');
    expect(ownerCheck).toBeGreaterThan(-1);
    expect(appliedRecovery).toBeGreaterThan(ownerCheck);
    expect(rewardedSource).toContain('if (legacy.playerId !== ownerId) return null;');
    expect(rewardedSource).toContain('if (legacy.playerId === ownerId) window.localStorage.removeItem(PENDING_REWARD_STORAGE_KEY)');
    expect(rewardedSource).toContain("readStoredPendingReward(playerId)");
    expect(rewardedSource).toContain("clearStoredPendingReward(playerId)");
  });

  it("refuses rewarded requests without a unique player identity", () => {
    expect(bridgeSource).toContain('let pendingPlayerId = "";');
    expect(bridgeSource).toContain("if (!pendingPlayerId)");
    expect(rewardedSource).toContain("if (!playerId?.trim()) {");
  });

  it("persists the complete active round before applying a rewarded effect and records request ids", () => {
    expect(soloGameSource).toContain("saveSoloGameRecovery(player.id, gameMode, packId, next)");
    expect(soloGameSource).toContain("appliedRewardRequestIds: nextAppliedIds");
    expect(soloGameSource).toContain("readSoloGameRecovery(player.id)");
    expect(soloGameSource).toContain('setGameState("PLAYING")');
    expect(soloGameSource).toContain("pendingDoubleBonusRef.current");
    expect(rewardedSource).toContain("onCompleteRef.current(amount, requestId)");
  });

  it("restores a player-owned active round and resumes its timer after a WebView restart", () => {
    expect(soloGameSource).toContain("recoveryInitializedForPlayerRef.current = player.id");
    expect(soloGameSource).toContain("scoreTokensRef.current = Array.isArray(saved.scoreTokens)");
    expect(soloGameSource).toContain("void handleStop()");
    expect(soloGameSource).toContain("clearSoloGameRecovery(player.id)");
  });

  it("counts actual ad_impression events separately from rewarded completions", () => {
    expect(adminAnalyticsSource).toContain("COUNT(*) FILTER (WHERE event_name = 'ad_impression')::int AS ad_impressions");
    expect(adminAnalyticsSource).not.toContain("event_name IN ('ad_impression','rewarded_ad_completed')");
  });
});
