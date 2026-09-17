import fs from "fs";

// One-time CI migration: applies the direct game-level rewarded-ad pause.

const soloPath = "artifacts/stop-game/src/pages/SoloGame.tsx";
let s = fs.readFileSync(soloPath, "utf8");

const oldRefs = `  const timerRef = useRef<NodeJS.Timeout>(null);\n  // Guards to prevent handleStop / results-accumulation from firing more than once per round\n  const stoppedRef = useRef(false);`;
const newRefs = `  const timerRef = useRef<NodeJS.Timeout>(null);\n  // Rewarded-ad pause is controlled by the game itself. The timer is stopped\n  // before the native ad opens and resumed only after the ad result is known.\n  const rewardedAdPausedRef = useRef(false);\n  const rewardedAdRemainingRef = useRef<number | null>(null);\n  const timeLeftRef = useRef(timeLeft);\n  // Guards to prevent handleStop / results-accumulation from firing more than once per round\n  const stoppedRef = useRef(false);`;
if (!s.includes(oldRefs)) throw new Error("SoloGame refs anchor not found");
s = s.replace(oldRefs, newRefs);

const oldSync = `  // Always-current refs so handleStop never reads stale closure values\n  const responsesRef = useRef<Record<string, string>>({});`;
const newSync = `  // Always-current refs so handleStop never reads stale closure values\n  useEffect(() => { timeLeftRef.current = timeLeft; }, [timeLeft]);\n\n  const pauseForRewardedAd = () => {\n    if (rewardedAdPausedRef.current) return;\n    if (gameState !== "PLAYING") return;\n    rewardedAdPausedRef.current = true;\n    rewardedAdRemainingRef.current = timeLeftRef.current;\n    if (timerRef.current) {\n      clearInterval(timerRef.current);\n      timerRef.current = null;\n    }\n  };\n\n  const resumeAfterRewardedAd = (rewardSeconds = 0) => {\n    if (!rewardedAdPausedRef.current) return;\n    const saved = rewardedAdRemainingRef.current;\n    rewardedAdPausedRef.current = false;\n    rewardedAdRemainingRef.current = null;\n    if (saved == null || saved <= 0 || stoppedRef.current) return;\n\n    const restored = saved + Math.max(0, rewardSeconds);\n    timeLeftRef.current = restored;\n    setTimeLeft(restored);\n    if (gameState !== "PLAYING") return;\n\n    timerRef.current = setInterval(() => {\n      setTimeLeft(prev => {\n        if (prev <= 1) {\n          if (timerRef.current) {\n            clearInterval(timerRef.current);\n            timerRef.current = null;\n          }\n          timeLeftRef.current = 0;\n          setTimeout(handleStop, 0);\n          return 0;\n        }\n        const next = prev - 1;\n        timeLeftRef.current = next;\n        return next;\n      });\n    }, 1000);\n  };\n\n  useEffect(() => {\n    const onRewardedAdStart = () => pauseForRewardedAd();\n    window.addEventListener("stop:rewarded-ad-start", onRewardedAdStart);\n    return () => window.removeEventListener("stop:rewarded-ad-start", onRewardedAdStart);\n  }, [gameState]);\n\n  const responsesRef = useRef<Record<string, string>>({});`;
if (!s.includes(oldSync)) throw new Error("SoloGame sync anchor not found");
s = s.replace(oldSync, newSync);

const oldTimer = `    timerRef.current = setInterval(() => {\n      setTimeLeft(prev => {\n        if (prev <= 1) {\n          // Clear the interval immediately (synchronously) so this branch never fires twice\n          if (timerRef.current) {\n            clearInterval(timerRef.current);\n            timerRef.current = null;\n          }\n          // Schedule handleStop outside the state-setter (safe async trigger)\n          setTimeout(handleStop, 0);\n          return 0;\n        }\n        return prev - 1;\n      });\n    }, 1000);`;
const newTimer = `    timeLeftRef.current = roundTime;\n    timerRef.current = setInterval(() => {\n      // Never consume game time while a rewarded ad is pending.\n      if (rewardedAdPausedRef.current) return;\n      setTimeLeft(prev => {\n        if (prev <= 1) {\n          if (timerRef.current) {\n            clearInterval(timerRef.current);\n            timerRef.current = null;\n          }\n          timeLeftRef.current = 0;\n          setTimeout(handleStop, 0);\n          return 0;\n        }\n        const next = prev - 1;\n        timeLeftRef.current = next;\n        return next;\n      });\n    }, 1000);`;
if (!s.includes(oldTimer)) throw new Error("SoloGame timer anchor not found");
s = s.replace(oldTimer, newTimer);

const oldStop = `  const handleStop = async () => {\n    // Guard: never run more than once per round\n    if (stoppedRef.current) return;`;
const newStop = `  const handleStop = async () => {\n    // A rewarded ad owns the round while it is open. Never end the round\n    // underneath the ad, even if a stale timer callback is queued.\n    if (rewardedAdPausedRef.current) return;\n    // Guard: never run more than once per round\n    if (stoppedRef.current) return;`;
if (!s.includes(oldStop)) throw new Error("SoloGame stop anchor not found");
s = s.replace(oldStop, newStop);

const oldReward = `  const handleRewardedComplete = (reward: number) => {\n    if (rewardedAdType === "extraTime") {\n      setTimeLeft(prev => prev + reward);\n      setRewardedUsed(true);`;
const newReward = `  const handleRewardedComplete = (reward: number) => {\n    if (rewardedAdType === "extraTime") {\n      // The timer was frozen before the native ad opened. Restore the exact\n      // saved value and only then add the rewarded seconds.\n      resumeAfterRewardedAd(reward);\n      setRewardedUsed(true);`;
if (!s.includes(oldReward)) throw new Error("SoloGame reward anchor not found");
s = s.replace(oldReward, newReward);

const oldAd = `            onComplete={handleRewardedComplete}\n            onSkip={() => setRewardedAdType(null)}\n          />`;
const newAd = `            onComplete={handleRewardedComplete}\n            onSkip={() => {\n              // Ad failed, was closed, or was unavailable: restore the exact\n              // pre-ad time with no reward and continue the same round.\n              resumeAfterRewardedAd(0);\n              setRewardedAdType(null);\n            }}\n          />`;
if (!s.includes(oldAd)) throw new Error("SoloGame RewardedAd JSX anchor not found");
s = s.replace(oldAd, newAd);
fs.writeFileSync(soloPath, s);

const adPath = "artifacts/stop-game/src/components/AdSystemFixed.tsx";
let a = fs.readFileSync(adPath, "utf8");
const guardStart = a.indexOf('const REWARDED_PAUSE_KEY = "__stopGameRewardedAdActive";');
const guardEnd = a.indexOf("function inStandaloneOrTwaSync()", guardStart);
if (guardStart < 0 || guardEnd < 0) throw new Error("AdSystem global timer guard not found");
a = a.slice(0, guardStart) + a.slice(guardEnd);
a = a.replace(`    setRewardedPause(true);\n    setPhase("loading");`, `    window.dispatchEvent(new Event("stop:rewarded-ad-start"));\n    setPhase("loading");`);
a = a.replace('    return () => setRewardedPause(false);', '    return () => {};');
fs.writeFileSync(adPath, a);

console.log("Applied direct game-level rewarded-ad timer pause fix.");
