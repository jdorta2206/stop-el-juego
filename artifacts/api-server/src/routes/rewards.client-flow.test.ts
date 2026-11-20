import { afterEach, describe, expect, it, vi } from "vitest";
import { readResult } from "../../../stop-game/src/lib/twaAdBridge.ts";
import { clearPendingDoubleBonus, clearSoloGameRecovery, readPendingDoubleBonuses, readSoloGameRecovery, savePendingDoubleBonus, saveSoloGameRecovery, isRestorableSoloGameRecovery } from "../../../stop-game/src/lib/soloGameRecovery.ts";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const currentDir = dirname(fileURLToPath(import.meta.url));
const readClientSource = (path: string) => readFileSync(resolve(currentDir, path), "utf8");
const bridgeSource = readClientSource("../../../stop-game/src/lib/twaAdBridge.ts");
const rewardedSource = readClientSource("../../../stop-game/src/components/AdSystemFixed.tsx");
const soloGameSource = readClientSource("../../../stop-game/src/pages/SoloGame.tsx");
const roomSource = readClientSource("../../../stop-game/src/pages/Room.tsx");
const achievementsSource = readClientSource("../../../stop-game/src/hooks/useAchievements.ts");
const reviewPromptSource = readClientSource("../../../stop-game/src/hooks/useReviewPrompt.ts");
const interstitialSource = readClientSource("../../../stop-game/src/lib/interstitialAd.ts");
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
    const hintBranch = soloGameSource.indexOf('} else if (rewardType === "hint")');
    const missingHint = soloGameSource.indexOf("throw new Error", hintBranch);
    const clearPending = soloGameSource.indexOf("next.pendingHint = null", hintBranch);
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
    const apply = rewardedSource.indexOf("await onCompleteRef.current(amount, requestId)");
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
    expect(rewardedSource).toContain("clearStoredPendingReward(playerId)");
    expect(rewardedSource).toContain("if (!gameMarkerCleared)");
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


  it("stores recovery snapshots per player and rejects a different owner", () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    vi.stubGlobal("window", { localStorage });

    expect(saveSoloGameRecovery("player-a", "normal", "classic", { state: "PLAYING", timeLeft: 24 })).toBe(true);
    expect(readSoloGameRecovery("player-a")?.payload.timeLeft).toBe(24);
    expect(readSoloGameRecovery("player-b")).toBeNull();
    clearSoloGameRecovery("player-a");
    expect(readSoloGameRecovery("player-a")).toBeNull();
  });

  it("keeps double-score submissions in a separate player-scoped durable outbox", () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    vi.stubGlobal("window", { localStorage });

    const entry = {
      playerId: "player-a",
      submissionId: "game-123:bonus",
      bonus: 42,
      aiTotalScore: 18,
      letter: "M",
      scoreTokens: ["proof-a"],
    };
    expect(savePendingDoubleBonus(entry)).toBe(true);
    expect(savePendingDoubleBonus({ ...entry, bonus: 42 })).toBe(true);
    expect(readPendingDoubleBonuses("player-a")).toHaveLength(1);
    expect(readPendingDoubleBonuses("player-b")).toHaveLength(0);
    expect(readPendingDoubleBonuses("player-a")[0]).toMatchObject(entry);
    expect(clearPendingDoubleBonus("player-a", entry.submissionId)).toBe(true);
    expect(readPendingDoubleBonuses("player-a")).toHaveLength(0);
  });

  it("expires an interrupted game snapshot after 24 hours", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-11-20T10:00:00.000Z"));
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    vi.stubGlobal("window", { localStorage });

    saveSoloGameRecovery("player-a", "normal", "classic", { state: "PLAYING" });
    vi.advanceTimersByTime(24 * 60 * 60 * 1000 + 1);
    expect(readSoloGameRecovery("player-a")).toBeNull();
  });

  it("persists the complete active round before applying a rewarded effect and records request ids", () => {
    expect(soloGameSource).toContain("saveSoloGameRecovery(player.id, gameMode, packId, next)");
    expect(soloGameSource).toContain("appliedRewardRequestIds: nextAppliedIds");
    expect(soloGameSource).toContain("readSoloGameRecovery(player.id)");
    expect(soloGameSource).toContain('setGameState("PLAYING")');
    expect(soloGameSource).toContain("pendingDoubleBonusRef.current");
    expect(soloGameSource).toContain("letter: saved.currentLetter");
    expect(soloGameSource).toContain('letter: opts?.letter || currentLetter || "?",');
    expect(soloGameSource).toContain("rewardedAdType,");
    expect(soloGameSource).toContain("setRewardedAdType(saved.rewardedAdType");
    expect(rewardedSource).toContain("onCompleteRef.current(amount, requestId)");
    expect(rewardedSource).toContain("if (canStartReward && !canStartReward())");
    expect(soloGameSource).toContain("canStartReward={() => Boolean");
    expect(soloGameSource).toContain("if (previouslyApplied.includes(requestId))");
    expect(soloGameSource).toContain("state: gameState,");
    expect(soloGameSource).toContain("roundResults,");
    expect(soloGameSource).toContain('setGameState(saved.state === "RESULTS" ? "RESULTS" : "PLAYING")');
    expect(soloGameSource).toContain('if (saved.state === "RESULTS" && rewardType !== "double")');
    expect(soloGameSource).toContain("pendingRewardAckRequestIdRef.current");
    expect(soloGameSource).toContain("pendingRewardAckTypeRef.current ?? rewardedAdType");
    expect(rewardedSource).toContain("onRewardAcknowledgedRef.current?.(requestId)");
    expect(rewardedSource).toContain("onRewardAcknowledged?: (requestId: string) => boolean");
    expect(rewardedSource).toContain("const gameMarkerCleared = onRewardAcknowledgedRef.current?.(requestId) !== false");
    expect(rewardedSource).toContain('throw new Error("REWARDED_ACK_PENDING")');
    expect(rewardedSource).toContain("if (consumeAckPending) return;");
    expect(rewardedSource).toContain("{!consumeAckPending && <button onClick={continueWithoutReward}");
    expect(soloGameSource).not.toContain("setRewardedAdType(null);\n      return;");
    expect(soloGameSource).toContain("const handleRewardAcknowledged = (requestId: string): boolean =>");
    expect(soloGameSource).toContain("saveSoloGameRecovery(player.id, snapshot.gameMode, snapshot.packId");
  });

  it("restores a player-owned active round and resumes its timer after a WebView restart", () => {
    expect(soloGameSource).toContain("recoveryInitializedForPlayerRef.current = player.id");
    expect(soloGameSource).toContain("scoreTokensRef.current = Array.isArray(saved.scoreTokens)");
    expect(soloGameSource).toContain("void handleStop()");
    expect(soloGameSource).toContain("clearSoloGameRecovery(player.id)");
    expect(soloGameSource).toContain("resultsAppliedRef.current = saved.resultsApplied === true;");
    expect(soloGameSource).not.toContain("saved.resultsApplied === true || saved.state === \"RESULTS\"");
    const handleStopStart = soloGameSource.indexOf("const handleStop = async () => {");
    const zeroTimeSnapshot = soloGameSource.indexOf('buildSoloGameRecoveryPayload({ state: "PLAYING", timeLeft: 0, responses: currentResponses })', handleStopStart);
    const validationStart = soloGameSource.indexOf("validateMutation.mutateAsync({", handleStopStart);
    expect(zeroTimeSnapshot).toBeGreaterThan(handleStopStart);
    expect(validationStart).toBeGreaterThan(zeroTimeSnapshot);
    const handleStopResolution = soloGameSource.slice(handleStopStart, validationStart);
    expect(handleStopResolution).not.toContain("clearSoloGameRecovery(");
  });

  it("persists and retries double-score submissions independently of the game snapshot", () => {
    const persist = soloGameSource.indexOf("const persisted = savePendingDoubleBonus(");
    const mutate = soloGameSource.indexOf("submitScoreMutation.mutate({", persist);
    const clearSuccess = soloGameSource.indexOf("clearBonusRecovery()", mutate);
    const retryEffect = soloGameSource.indexOf("readPendingDoubleBonuses(player.id)");
    expect(persist).toBeGreaterThan(-1);
    expect(mutate).toBeGreaterThan(persist);
    expect(clearSuccess).toBeGreaterThan(mutate);
    expect(retryEffect).toBeGreaterThan(-1);
    expect(soloGameSource).toContain("pendingBonusRetriesRef.current.has(entry.submissionId)");
    expect(soloGameSource).toContain("submissionId: entry.submissionId");
    expect(soloGameSource).toContain("clearPendingDoubleBonus(player.id, submissionId)");
    expect(soloGameSource).toContain("pendingBonusRetriesRef.current.add(submissionId)");
    expect(soloGameSource).toContain("pendingDoubleBonus: null");
    expect(soloGameSource).toContain('window.addEventListener("online", retryPendingBonuses)');
    expect(soloGameSource).toContain('window.addEventListener("focus", retryPendingBonuses)');
    expect(soloGameSource).toContain('window.addEventListener("pageshow", retryPendingBonuses)');
    expect(soloGameSource).toContain('document.addEventListener("visibilitychange", retryPendingBonuses)');
    expect(soloGameSource).toContain("pendingBonusRetryTimersRef.current.clear()");
    expect(soloGameSource).toContain("pendingBonusRetryAttemptsRef.current");
    expect(soloGameSource).toContain("pendingBonusRetryTimersRef.current");
    expect(soloGameSource).toContain("const delays = [5_000, 15_000, 30_000, 60_000]");
    expect(soloGameSource).toContain("if (attempts < delays.length)");
    expect(soloGameSource).toContain("The durable\n            // outbox remains available for the next app-resume/online event.");
    expect(soloGameSource).toContain("readPendingDoubleBonuses(player.id).find((entry) => entry.submissionId === submissionId)");
    expect(soloGameSource).toContain("pendingBonusRetriesRef.current.delete(submissionId)");
    expect(soloGameSource).toContain("pendingBonusRetriesRef.current.add(submissionId)");
    expect(soloGameSource).toContain("Never discard the active-game snapshot while its double-score submission");
    expect(soloGameSource).toContain("if (newGame && pendingDoubleBonusRef.current");
    expect(soloGameSource).toContain("const persisted = savePendingDoubleBonus({");
    const offlineBonusTransfer = soloGameSource.slice(
      soloGameSource.indexOf("await enqueueScoreOutbox({", soloGameSource.indexOf("const submitToLeaderboard")),
      soloGameSource.indexOf("const offMsg =", soloGameSource.indexOf("await enqueueScoreOutbox({", soloGameSource.indexOf("const submitToLeaderboard"))),
    );
    expect(offlineBonusTransfer).not.toContain("clearBonusRecovery()");
  });

  it("deduplicates recovered game counters and separates review cadence from interstitial cadence", () => {
    expect(achievementsSource).toContain("interface AchievementStatsRecord");
    expect(achievementsSource).toContain("processedRoundIds");
    expect(achievementsSource).toContain("if (roundId && record.processedRoundIds.includes(roundId)) return;");
    expect(achievementsSource).toContain("saveStatsLocal(playerId, next, processedRoundIds)");
    expect(soloGameSource).toContain("${gameSubmissionIdRef.current}:round:${round}");
    expect(reviewPromptSource).toContain("interface GameCounterRecord");
    expect(reviewPromptSource).toContain("if (gameId && current.processedIds.includes(gameId)) return;");
    expect(reviewPromptSource).toContain("recordScoreAndPercentile(score: number, gameId?: string)");
    expect(soloGameSource).toContain("recordGamePlayed(completedGameId)");
    expect(soloGameSource).toContain("recordScoreAndPercentile(finalPlayerScore, completedGameId)");
    expect(interstitialSource).toContain('const GAMES_KEY = "stop_interstitial_games_completed_v1"');
    expect(interstitialSource).toContain('const CONSUMED_KEY = "stop_interstitial_consumed_games_v2"');
    expect(interstitialSource).toContain("recordInterstitialGameCompleted(gameId?: string)");
    expect(soloGameSource).toContain("recordInterstitialGameCompleted(gameSubmissionIdRef.current ?? undefined)");
    expect(roomSource).toContain('recordInterstitialGameCompleted(roomCode ? `room:${roomCode.toUpperCase()}` : undefined)');
    expect(roomSource).toContain('recordGamePlayed(roomCode ? `room:${roomCode.toUpperCase()}` : undefined)');
  });


  it("accepts only complete snapshots for the selected mode and pack", () => {
    const values = new Map<string, string>();
    const localStorage = {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => { values.set(key, value); },
      removeItem: (key: string) => { values.delete(key); },
    };
    vi.stubGlobal("window", { localStorage });

    expect(saveSoloGameRecovery("player-a", "normal", "classic", {
      state: "PLAYING", currentLetter: "M", timeLeft: 31, categories: ["Nombre", "País"],
    })).toBe(true);
    const active = readSoloGameRecovery("player-a");
    expect(isRestorableSoloGameRecovery(active, "normal", "classic")).toBe(true);
    expect(isRestorableSoloGameRecovery(active, "daily", "classic")).toBe(false);
    expect(isRestorableSoloGameRecovery(active, "normal", "animals")).toBe(false);

    expect(saveSoloGameRecovery("player-a", "normal", "classic", {
      state: "JUDGING", currentLetter: "M", timeLeft: 0, categories: ["Nombre"],
    })).toBe(true);
    expect(isRestorableSoloGameRecovery(readSoloGameRecovery("player-a"), "normal", "classic")).toBe(false);

    expect(saveSoloGameRecovery("player-a", "normal", "classic", {
      state: "RESULTS", currentLetter: "M", timeLeft: 0, categories: ["Nombre"],
    })).toBe(true);
    expect(isRestorableSoloGameRecovery(readSoloGameRecovery("player-a"), "normal", "classic")).toBe(true);

    expect(saveSoloGameRecovery("player-a", "normal", "classic", {
      state: "PLAYING", currentLetter: "M", timeLeft: Number.NaN, categories: ["Nombre"],
    })).toBe(true);
    expect(isRestorableSoloGameRecovery(readSoloGameRecovery("player-a"), "normal", "classic")).toBe(false);
  });

  it("counts actual ad_impression events separately from rewarded completions", () => {
    expect(adminAnalyticsSource).toContain("COUNT(*) FILTER (WHERE event_name = 'ad_impression')::int AS ad_impressions");
    expect(adminAnalyticsSource).not.toContain("event_name IN ('ad_impression','rewarded_ad_completed')");
  });
});
