import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import confetti from "canvas-confetti";
import { Layout } from "@/components/Layout";
import { Button, Card, Input, Progress } from "@/components/ui";
import { Roulette } from "@/components/Roulette";
import { getCategories, getAlphabet, getCurrentLang, getApiUrl } from "@/lib/utils";
import { useValidateRound, useSubmitScore } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { motion, AnimatePresence } from "framer-motion";
import { RewardedAd, BannerAd } from "@/components/AdSystem";
import { PremiumModal } from "@/components/PremiumModal";
import { ShareResultsModal } from "@/components/ShareResultsModal";
import { usePremium } from "@/lib/usePremium";
import { Tv2, Crown, Volume2, VolumeX, Zap, Star, Flame, Trophy } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useTicker } from "@/hooks/useTicker";
import { useStreak } from "@/hooks/useStreak";
import { useProgression, calcXpFromResults } from "@/hooks/useProgression";
import { useSound } from "@/hooks/useSound";
import { pickRandomPersonality, getAIComment, type AIPersonality } from "@/data/aiPersonalities";
import { useAchievements } from "@/hooks/useAchievements";
import { AchievementToast } from "@/components/AchievementToast";
import { drawPowerCard, POWER_CARDS, type PowerCardId } from "@/data/powerCards";
import { usePersonalBest } from "@/hooks/usePersonalBest";

function vibrate(pattern: number | number[]) {
  try { if (navigator.vibrate) navigator.vibrate(pattern); } catch {}
}

type GameState = "LOBBY" | "SPINNING" | "CARD_REVEAL" | "PLAYING" | "EVALUATING" | "JUDGING" | "RESULTS";

type SpecialReveal = { type: "oracle" | "steal" | "sabotage"; category: string; word: string; pts?: number } | null;

type BluffResult = { category: string; caught: boolean; scoreChange: number };
type AiBluffSetup = { category: string; wasActuallyBluffing: boolean };
type AiBluffReveal = { category: string; answer: string; wasActuallyBluffing: boolean; scoreChange: number };
type RandomEvent = "double_xp" | "easy_letter" | "speed" | "hidden_category" | "time_bomb" | null;

const ROUND_TIME = 60;
const QUICK_ROUND_TIME = 30;
const SPEED_ROUND_TIME = 20;
const CHAOS_ROUND_TIME = 45;
const MAX_ROUNDS = 3;
const EASY_LETTERS = ["A", "C", "E", "I", "L", "M", "P", "R", "S", "T"];

function getCrazyCategory(t: any): string | null {
  if (!t.crazyCategories || t.crazyCategories.length === 0) return null;
  if (Math.random() > 0.3) return null; // 30% chance
  return t.crazyCategories[Math.floor(Math.random() * t.crazyCategories.length)];
}

function mixCrazyCategory(cats: string[], t: any): string[] {
  const crazy = getCrazyCategory(t);
  if (!crazy) return cats;
  const result = [...cats];
  const idx = Math.floor(Math.random() * result.length);
  result[idx] = crazy;
  return result;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

export default function SoloGame() {
  const { player, showAuth } = usePlayer();
  const { isPremium } = usePremium(player?.id);
  const { t, lang } = useT();
  const { recordPlay } = useStreak();
  const { addXp, levelUpInfo, clearLevelUp } = useProgression();
  const [, setLocation] = useLocation();
  const [gameState, setGameState] = useState<GameState>("LOBBY");
  const [currentLetter, setCurrentLetter] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [aiTotalScore, setAiTotalScore] = useState(0);
  const [showRewardedAd, setShowRewardedAd] = useState(false);
  const [rewardedUsed, setRewardedUsed] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [lastXpGain, setLastXpGain] = useState(0);
  const [categories, setCategories] = useState<string[]>(getCategories());
  const [muted, setMuted] = useState(false);

  // Combo system
  const [combo, setCombo] = useState(0);
  // Insane mode — activates after 3 consecutive wins
  const [insaneMode, setInsaneMode] = useState(false);
  const [showInsaneBanner, setShowInsaneBanner] = useState(false);
  // Random event for current round
  const [randomEvent, setRandomEvent] = useState<RandomEvent>(null);
  // Round result announcement
  const [roundWon, setRoundWon] = useState<boolean | null>(null);

  // Daily / Quick / Chaos mode — read URL params once
  const urlParams = new URLSearchParams(window.location.search);
  const isDailyMode = urlParams.get("daily") === "true";
  const isQuickMode = urlParams.get("mode") === "quick";
  const isChaosMode = urlParams.get("mode") === "chaos";
  const dailyLetter = urlParams.get("letter") || "";
  const dailyCategories = urlParams.get("cats")?.split(",").filter(Boolean) || [];

  const gameMode = isDailyMode ? "daily" : isQuickMode ? "quick" : isChaosMode ? "chaos" : "normal";
  const { best: personalBest, updateBest } = usePersonalBest(gameMode);
  const [bestResult, setBestResult] = useState<{ isNew: boolean; diff: number } | null>(null);

  const baseRoundTime = isQuickMode ? QUICK_ROUND_TIME : isChaosMode ? CHAOS_ROUND_TIME : insaneMode ? QUICK_ROUND_TIME : ROUND_TIME;
  const effectiveRoundTime = (!isQuickMode && !isDailyMode && !isChaosMode && !insaneMode && randomEvent === "speed")
    ? SPEED_ROUND_TIME : baseRoundTime;
  const roundTime = effectiveRoundTime;
  const maxRounds = isDailyMode ? 1 : isQuickMode ? 1 : MAX_ROUNDS;

  // AI personality (picked once per session)
  const [aiPersonality] = useState<AIPersonality>(() => pickRandomPersonality());
  const [aiComment, setAiComment] = useState<string | null>(null);

  // Achievements system
  const { newlyUnlocked, afterRound, clearNewlyUnlocked } = useAchievements();

  // Hidden category index (for hidden_category event)
  const [hiddenCategoryIdx, setHiddenCategoryIdx] = useState<number | null>(null);

  // Bluff / Social Deception state
  const [bluffedCategories, setBluffedCategories] = useState<Set<string>>(new Set());
  const [aiBluffSetup, setAiBluffSetup] = useState<AiBluffSetup | null>(null);
  const [bluffResults, setBluffResults] = useState<BluffResult[]>([]);
  const [aiBluffReveal, setAiBluffReveal] = useState<AiBluffReveal | null>(null);
  const [playerJudgedAi, setPlayerJudgedAi] = useState<boolean | null>(null);
  const [judgingPhase, setJudgingPhase] = useState<"player_bluffs" | "ai_bluff">("player_bluffs");
  const [bluffBonusScore, setBluffBonusScore] = useState(0);

  // Power Cards state
  const [activeCard, setActiveCard] = useState<PowerCardId | null>(null);
  const [cardUsed, setCardUsed] = useState(false);
  const [sabotageCategory, setSabotageCategory] = useState<string | null>(null);
  const [selectingSabotage, setSelectingSabotage] = useState(false);
  const [specialReveal, setSpecialReveal] = useState<SpecialReveal>(null);
  const cardRevealTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sound hook
  const sound = useSound(muted);

  // Keep refs in sync with state so handleStop never reads stale closure values
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { bluffedCategoriesRef.current = bluffedCategories; }, [bluffedCategories]);
  useEffect(() => { currentLetterRef.current = currentLetter; }, [currentLetter]);

  // Re-read categories when language changes (only if not daily mode)
  useEffect(() => {
    if (!isDailyMode) setCategories(getCategories());
  }, [lang, isDailyMode]);

  // Pause Google Auto Ads for premium users
  useEffect(() => {
    try {
      const win = window as any;
      win.adsbygoogle = win.adsbygoogle || [];
      if (isPremium) {
        win.adsbygoogle.pauseAdRequests = 1;
        // Hide any auto-injected ad iframes
        document.querySelectorAll("ins.adsbygoogle, iframe[id^='google_ads']").forEach((el) => {
          (el as HTMLElement).style.display = "none";
        });
      } else {
        win.adsbygoogle.pauseAdRequests = 0;
      }
    } catch (_) {}
  }, [isPremium]);

  // Ticking sound — active only during PLAYING
  const { toggleMute } = useTicker(timeLeft, ROUND_TIME, gameState === "PLAYING" && !muted);

  const handleToggleMute = () => {
    const nowMuted = toggleMute();
    setMuted(nowMuted);
  };

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get("premium") === "success") {
      window.history.replaceState({}, "", window.location.pathname);
      setShowPremiumModal(true);
    }
  }, []);

  const validateMutation = useValidateRound();
  const submitScoreMutation = useSubmitScore();
  const queryClient = useQueryClient();
  const timerRef = useRef<NodeJS.Timeout>(null);
  // Guards to prevent handleStop / results-accumulation from firing more than once per round
  const stoppedRef = useRef(false);
  const resultsAppliedRef = useRef(false);

  // Always-current refs so handleStop never reads stale closure values
  const responsesRef = useRef<Record<string, string>>({});
  const categoriesRef = useRef<string[]>([]);
  const bluffedCategoriesRef = useRef<Set<string>>(new Set());
  const currentLetterRef = useRef<string>("");

  const startGame = () => {
    setAiComment(null);
    // Pick random event (only in normal solo mode)
    let event: RandomEvent = null;
    if (!isDailyMode && !isQuickMode && !isChaosMode) {
      const roll = Math.random();
      if (roll < 0.22) event = "double_xp";
      else if (roll < 0.40) event = "easy_letter";
      else if (roll < 0.53) event = "speed";
      else if (roll < 0.66) event = "hidden_category";
      else if (roll < 0.76) event = "time_bomb";
    }
    if (isChaosMode) event = "double_xp";
    setRandomEvent(event);
    setRoundWon(null);

    if (isDailyMode) {
      setCurrentLetter(dailyLetter);
      const cats = dailyCategories.length > 0 ? dailyCategories : getCategories();
      setCategories(cats);
    } else {
      const alphabet = event === "easy_letter" ? EASY_LETTERS : getAlphabet();
      const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
      setCurrentLetter(randomLetter);
      if (isChaosMode) {
        // All categories are crazy in chaos mode
        const crazyCats = t.crazyCategories && t.crazyCategories.length >= 6
          ? [...t.crazyCategories].sort(() => Math.random() - 0.5).slice(0, 6)
          : getCategories().map(() => {
              const pool = t.crazyCategories || [];
              return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : getCategories()[0];
            });
        setCategories(crazyCats);
      } else {
        setCategories(mixCrazyCategory(getCategories(), t));
      }
    }
    setResponses({});

    // Draw a power card for this round
    const card = drawPowerCard(isQuickMode, isChaosMode);
    setActiveCard(card);
    setCardUsed(false);
    setSabotageCategory(null);
    setSelectingSabotage(false);
    setSpecialReveal(null);

    // Reset hidden category
    setHiddenCategoryIdx(event === "hidden_category" ? Math.floor(Math.random() * 7) : null);

    // Reset bluff system
    setBluffedCategories(new Set());
    setBluffResults([]);
    setAiBluffReveal(null);
    setPlayerJudgedAi(null);
    setJudgingPhase("player_bluffs");
    setBluffBonusScore(0);

    setGameState("SPINNING");
  };

  const startRound = () => {
    // Reset per-round guards
    stoppedRef.current = false;
    resultsAppliedRef.current = false;

    // Set up AI bluff for this round (random category, 50% chance it's actually bluffing)
    const aiBluffCat = categories[Math.floor(Math.random() * categories.length)];
    setAiBluffSetup({ category: aiBluffCat, wasActuallyBluffing: Math.random() < 0.5 });

    setGameState("PLAYING");
    setTimeLeft(roundTime);
    setRewardedUsed(false);
    sound.playRoundStart();
    if (randomEvent === "hidden_category") setTimeout(() => sound.playHiddenReveal(), 400);

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          // Clear the interval immediately (synchronously) so this branch never fires twice
          if (timerRef.current) {
            clearInterval(timerRef.current);
            timerRef.current = null;
          }
          // Schedule handleStop outside the state-setter (safe async trigger)
          setTimeout(handleStop, 0);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const toggleBluff = (category: string) => {
    setBluffedCategories(prev => {
      const next = new Set(prev);
      if (next.has(category)) {
        next.delete(category);
      } else if (next.size < 2) {
        next.add(category);
      }
      return next;
    });
  };

  const handleJudgeAi = (playerSaysItsMentira: boolean) => {
    setPlayerJudgedAi(playerSaysItsMentira);
    if (aiBluffReveal) {
      const correct = aiBluffReveal.wasActuallyBluffing === playerSaysItsMentira;
      const change = correct ? 15 : 0;
      setBluffBonusScore(prev => prev + change);
      setAiBluffReveal(prev => prev ? { ...prev, scoreChange: change } : null);
    }
  };

  const proceedFromCardReveal = () => {
    if (cardRevealTimer.current) clearTimeout(cardRevealTimer.current);
    startRound();
  };

  const handleSpinComplete = () => {
    if (activeCard) {
      setGameState("CARD_REVEAL");
      cardRevealTimer.current = setTimeout(startRound, 4000);
    } else {
      startRound();
    }
  };

  // Cleanup card reveal timer on unmount
  useEffect(() => {
    return () => {
      if (cardRevealTimer.current) clearTimeout(cardRevealTimer.current);
    };
  }, []);

  const handleStop = async () => {
    // Guard: never run more than once per round
    if (stoppedRef.current) return;
    stoppedRef.current = true;

    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    sound.playStop();
    vibrate([80, 30, 80]);
    setGameState("EVALUATING");

    // Use refs to always get the latest state values (avoids stale closure bug)
    const currentResponses = responsesRef.current;
    const currentCategories = categoriesRef.current;
    const currentBluffed = bluffedCategoriesRef.current;
    const letter = currentLetterRef.current;

    const formattedResponses = currentCategories.map(cat => ({
      category: cat,
      word: currentResponses[cat] || ""
    }));

    let apiData = null;
    try {
      apiData = await validateMutation.mutateAsync({
        data: {
          letter,
          language: getCurrentLang() as import("@workspace/api-client-react").ValidateRoundRequestLanguage,
          playerName: player?.name,
          playerResponses: formattedResponses,
        }
      });
    } catch {
      // Fallback: proceed to results without API
    }

    // Process player bluffs
    const hasPlayerBluffs = currentBluffed.size > 0;
    if (hasPlayerBluffs) {
      const detectionRate = isChaosMode ? 0.7 : 0.5;
      const results: BluffResult[] = [];
      let bonusDelta = 0;
      currentBluffed.forEach(cat => {
        const caught = Math.random() < detectionRate;
        const scoreChange = caught ? -10 : 20;
        results.push({ category: cat, caught, scoreChange });
        bonusDelta += scoreChange;
      });
      setBluffResults(results);
      setBluffBonusScore(bonusDelta);
    }

    // Set up AI bluff reveal data (using API response)
    if (aiBluffSetup && apiData) {
      const catResult = (apiData as { results?: Record<string, { ai?: { response?: string; score?: number } }> }).results?.[aiBluffSetup.category];
      const aiAnswer = catResult?.ai?.response ?? "";
      const aiGotPoints = (catResult?.ai?.score ?? 0) > 0;

      // The AI can only TRULY bluff (show a fake answer) when it had NO valid word.
      // If the AI has a real valid answer (score > 0), it is NEVER bluffing — it's honest.
      // This prevents situations like "YouTube" being incorrectly labeled as a lie.
      const wasActuallyBluffing = !aiGotPoints && aiBluffSetup.wasActuallyBluffing;

      setAiBluffReveal({
        category: aiBluffSetup.category,
        answer: aiAnswer,
        wasActuallyBluffing,
        scoreChange: 0,
      });
    }

    // Go to JUDGING if there's anything to judge, otherwise go straight to results
    if (hasPlayerBluffs || aiBluffSetup) {
      setJudgingPhase("player_bluffs");
      setGameState("JUDGING");
    } else {
      setGameState("RESULTS");
    }
  };

  const results = validateMutation.data;

  useEffect(() => {
    if (gameState === "RESULTS" && results) {
      // Guard: only apply round scores once per round, never on re-renders
      if (resultsAppliedRef.current) return;
      resultsAppliedRef.current = true;

      // Void word scores for categories where the player was caught bluffing
      const caughtBluffCategories = new Set(
        bluffResults.filter(br => br.caught).map(br => br.category)
      );
      const voidedScore = Array.from(caughtBluffCategories).reduce((sum, cat) => {
        return sum + (results.results?.[cat]?.player?.score ?? 0);
      }, 0);
      const ps = (results.playerTotalScore || 0) - voidedScore;
      const rawAs = results.aiTotalScore || 0;

      // SABOTAGE: reduce AI score AND transfer those points to player
      const sabotageStolen = sabotageCategory
        ? (results.results?.[sabotageCategory]?.ai?.score ?? 0)
        : 0;
      const as_ = rawAs - sabotageStolen;
      if (sabotageStolen > 0 && sabotageCategory) {
        setSpecialReveal({
          type: "sabotage",
          category: sabotageCategory,
          word: results.results?.[sabotageCategory]?.ai?.response ?? "",
          pts: sabotageStolen,
        });
      }

      // STEAL: find highest-value category where player scored 0 and AI scored
      let stolenScore = 0;
      if (activeCard === "steal") {
        const entry = Object.entries(results.results || {})
          .filter(([, r]) => (r.player?.score ?? 0) === 0 && (r.ai?.score ?? 0) > 0)
          .sort(([, a], [, b]) => (b.ai?.score ?? 0) - (a.ai?.score ?? 0))[0];
        if (entry) {
          stolenScore = entry[1].ai?.score ?? 0;
          setSpecialReveal({ type: "steal", category: entry[0], word: entry[1].ai?.response ?? "" });
        }
      }

      // ORACLE: reveal one AI answer the player missed
      if (activeCard === "oracle") {
        const entry = Object.entries(results.results || {})
          .find(([, r]) => (r.player?.score ?? 0) === 0 && (r.ai?.score ?? 0) > 0);
        if (entry) {
          setSpecialReveal({ type: "oracle", category: entry[0], word: entry[1].ai?.response ?? "" });
        }
      }

      const won = (ps + stolenScore + sabotageStolen) > as_;

      const finalPlayerScore = totalScore + ps + stolenScore + sabotageStolen + bluffBonusScore;
      setTotalScore(finalPlayerScore);
      setAiTotalScore(prev => prev + as_);
      setRoundWon(won);
      vibrate(won ? [40, 20, 80] : [120]);

      if (round >= maxRounds) {
        const br = updateBest(finalPlayerScore);
        setBestResult(br);
        if (br.isNew) setTimeout(() => { vibrate([60, 40, 60, 40, 120]); sound.playLevelUp(); }, 600);
        if (!isDailyMode) setTimeout(() => setShowShareModal(true), 3500);
      }

      // AI personality comment
      const comment = getAIComment(aiPersonality, won, ps, as_);
      setTimeout(() => setAiComment(comment), 1200);

      // Count valid words for achievements
      const validWordCount = Object.values(results.results || {}).filter(
        r => (r.player?.score ?? 0) > 0
      ).length;

      // Track achievement progress
      afterRound({
        won,
        validWords: validWordCount,
        combo: combo + (won ? 1 : 0),
        wasSpeedRound: randomEvent === "speed",
        wasChaosRound: isChaosMode,
        xpGained: 0, // will be counted in nextRound
      });

      if (won) {
        confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
        setCombo(prev => {
          const newCombo = prev + 1;
          if (newCombo >= 3 && !insaneMode && !isDailyMode) {
            setInsaneMode(true);
            setShowInsaneBanner(true);
            setTimeout(() => setShowInsaneBanner(false), 2800);
            vibrate([60, 30, 60, 30, 180]);
          }
          if (newCombo >= 2) {
            sound.playCombo(newCombo);
          } else {
            sound.playWin();
          }
          return newCombo;
        });
      } else {
        sound.playLose();
        // SHIELD: don't reset combo on loss
        if (activeCard !== "shield") {
          setCombo(0);
          setInsaneMode(false);
        }
        confetti({ particleCount: 20, spread: 40, origin: { y: 0.6 }, colors: ["#666", "#999"] });
      }
    }
  }, [gameState, results]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitToLeaderboard = (finalScore: number, finalAiScore: number) => {
    if (!player || player.loginMethod === "guest") return;
    submitScoreMutation.mutate({
      data: {
        playerId: player.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        score: finalScore,
        letter: currentLetter,
        mode: isDailyMode ? "daily" : "solo",
        won: finalScore > finalAiScore,
      }
    }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["/api/ranking/scores"] });
      }
    });
  };

  const submitDailyResult = (finalScore: number) => {
    // Always save daily score locally (works for guests too)
    localStorage.setItem(`stop_daily_${getTodayStr()}`, String(finalScore));

    // Save to server if logged in
    if (!player || player.loginMethod === "guest") return;
    fetch(`${getApiUrl()}/api/daily/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: player.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        score: finalScore,
        letter: dailyLetter || currentLetter,
        language: getCurrentLang(),
      }),
    }).catch(() => {});
  };

  const nextRound = () => {
    if (round >= maxRounds) {
      recordPlay();
      // Calculate XP with multipliers
      const validCount = results
        ? Object.values(results.results || {}).filter(r => (r.player?.score ?? 0) > 0).length
        : 0;
      const baseXp = calcXpFromResults(validCount, totalScore, aiTotalScore);
      const multiplier =
        activeCard === "double_or_nothing" ? (roundWon ? 3 : 0) :
        randomEvent === "double_xp" ? 2 :
        randomEvent === "speed" && roundWon ? 3 :
        combo >= 4 ? 2 :
        combo >= 2 ? 1.5 :
        1;
      const xpGained = Math.round(baseXp * multiplier);
      addXp(xpGained);
      setLastXpGain(xpGained);
      if (levelUpInfo) sound.playLevelUp();
      submitToLeaderboard(totalScore, aiTotalScore);
      if (isDailyMode) {
        submitDailyResult(totalScore);
        setLocation("/reto");
        return;
      }
      setGameState("LOBBY");
      setRound(1);
      setTotalScore(0);
      setAiTotalScore(0);
      setCombo(0);
      setInsaneMode(false);
      setRandomEvent(null);
      setRoundWon(null);
      setBestResult(null);
    } else {
      setRound(r => r + 1);
      startGame();
    }
  };

  const handleRewardedComplete = (reward: number) => {
    setTimeLeft(prev => prev + reward);
    setRewardedUsed(true);
    setShowRewardedAd(false);
  };

  // Bluff reveal sounds — play as each result animates in (1.4s per card)
  const bluffSoundFiredRef = useRef(false);
  useEffect(() => {
    if (gameState !== "JUDGING" || judgingPhase !== "player_bluffs" || bluffResults.length === 0) {
      bluffSoundFiredRef.current = false;
      return;
    }
    if (bluffSoundFiredRef.current) return;
    bluffSoundFiredRef.current = true;
    const timeouts: ReturnType<typeof setTimeout>[] = [];
    bluffResults.forEach((result, i) => {
      timeouts.push(setTimeout(() => {
        if (result.caught) sound.playBluffCaught();
        else sound.playBluffPerfect();
      }, (i * 1.4 + 0.45) * 1000));
    });
    return () => timeouts.forEach(clearTimeout);
  }, [gameState, judgingPhase, bluffResults]);

  // Suspense chord when AI bluff phase begins
  const aiJudgeSoundFiredRef = useRef(false);
  useEffect(() => {
    if (gameState === "JUDGING" && judgingPhase === "ai_bluff" && !aiJudgeSoundFiredRef.current) {
      aiJudgeSoundFiredRef.current = true;
      sound.playJudge();
    }
    if (gameState !== "JUDGING") aiJudgeSoundFiredRef.current = false;
  }, [gameState, judgingPhase]);

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">

        {showRewardedAd && (
          <RewardedAd
            rewardType="extraTime"
            rewardAmount={30}
            onComplete={handleRewardedComplete}
            onSkip={() => setShowRewardedAd(false)}
          />
        )}

        {showPremiumModal && (
          <PremiumModal
            open={showPremiumModal}
            onClose={() => setShowPremiumModal(false)}
            playerId={player?.id || "guest"}
            playerName={player?.name || ""}
            isPremium={isPremium}
          />
        )}

        <ShareResultsModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          letter={currentLetter}
          playerScore={totalScore}
          aiScore={aiTotalScore}
          categories={categories}
          results={results?.results || {}}
          t={t.game}
          bluffResults={bluffResults.length > 0 ? bluffResults : undefined}
          aiJudged={
            playerJudgedAi !== null && aiBluffReveal
              ? { wasCorrect: playerJudgedAi === aiBluffReveal.wasActuallyBluffing, category: aiBluffReveal.category }
              : null
          }
        />

        {/* Achievement toast notification */}
        <AchievementToast
          achievement={newlyUnlocked}
          onDone={clearNewlyUnlocked}
          tAchievements={t.achievements as unknown as { [key: string]: string; new: string; xpBonus: string }}
        />

        {/* Mode badges row */}
        <div className="flex items-center justify-center gap-2 mb-3 flex-wrap">
          {isQuickMode && (
            <div
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
              style={{ background: "linear-gradient(135deg, hsl(48 96% 57%), hsl(6 90% 55%))", color: "#0d1757" }}
            >
              <Zap size={12} /> {t.game.quickMode}
            </div>
          )}
          {isChaosMode && (
            <motion.div
              animate={{ scale: [1, 1.05, 1] }}
              transition={{ repeat: Infinity, duration: 2 }}
              className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
              style={{ background: "linear-gradient(135deg, #7c3aed, #4c1d95)", color: "white" }}
            >
              🌀 {(t.game as Record<string,string>).chaosMode ?? "MODO CAOS"}
            </motion.div>
          )}
          {/* Random event badge */}
          <AnimatePresence>
            {randomEvent && (
              <motion.div
                key={randomEvent}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0, opacity: 0 }}
                transition={{ type: "spring", bounce: 0.5 }}
                className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-black"
                style={{
                  background:
                    randomEvent === "double_xp" ? "linear-gradient(135deg, rgba(249,168,37,0.9), rgba(234,88,12,0.9))" :
                    randomEvent === "easy_letter" ? "linear-gradient(135deg, rgba(34,197,94,0.9), rgba(21,128,61,0.9))" :
                    randomEvent === "hidden_category" ? "linear-gradient(135deg, rgba(59,130,246,0.9), rgba(37,99,235,0.9))" :
                    randomEvent === "time_bomb" ? "linear-gradient(135deg, rgba(239,68,68,0.9), rgba(185,28,28,0.9))" :
                    "linear-gradient(135deg, rgba(139,92,246,0.9), rgba(109,40,217,0.9))",
                  color: "white",
                }}
              >
                {randomEvent === "double_xp" && <><Star size={11} fill="white" /> {t.game.doubleXp}</>}
                {randomEvent === "easy_letter" && <>🍀 {t.game.easyLetter}</>}
                {randomEvent === "speed" && <><Zap size={11} fill="white" /> {t.game.speedBonus}</>}
                {randomEvent === "hidden_category" && <>🔍 {t.game.hiddenCategory}</>}
                {randomEvent === "time_bomb" && <>💣 {t.game.timeBomb}</>}
              </motion.div>
            )}
          </AnimatePresence>
          {/* Combo badge */}
          <AnimatePresence>
            {combo >= 2 && (
              <motion.div
                key={`combo-${combo}`}
                initial={{ scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0 }}
                transition={{ type: "spring", bounce: 0.7 }}
                className="flex items-center gap-1 px-3 py-1 rounded-full text-xs font-black"
                style={{ background: "linear-gradient(135deg, rgba(239,68,68,0.9), rgba(220,38,38,0.9))", color: "white" }}
              >
                <Flame size={11} fill="white" /> {t.game.combo} x{combo}!
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Insane Mode activation banner — full-screen flash */}
        <AnimatePresence>
          {showInsaneBanner && (
            <motion.div
              key="insane-banner"
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 1.1 }}
              transition={{ type: "spring", bounce: 0.4 }}
              className="fixed inset-0 z-50 flex flex-col items-center justify-center pointer-events-none"
              style={{ background: "rgba(185,28,28,0.82)", backdropFilter: "blur(4px)" }}
            >
              <motion.div
                animate={{ scale: [1, 1.08, 1], rotate: [-1, 1, -1, 1, 0] }}
                transition={{ repeat: 2, duration: 0.4 }}
                className="text-center px-8"
              >
                <p className="text-7xl mb-3">🔥</p>
                <p className="text-white font-black text-3xl tracking-wide uppercase" style={{ fontFamily: "'Baloo 2', sans-serif" }}>
                  {lang === "en" ? "INSANE MODE!" : lang === "pt" ? "MODO INSANO!" : lang === "fr" ? "MODE INSANE !" : "¡MODO INSANO!"}
                </p>
                <p className="text-red-200 font-bold text-sm mt-2 opacity-80">
                  {lang === "en" ? "30s rounds — no mercy" : lang === "pt" ? "Rondas de 30s — sem piedade" : lang === "fr" ? "Rondes de 30s — sans pitié" : "Rondas de 30s — sin piedad"}
                </p>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Header Stats */}
        <div
          className="flex justify-between items-center rounded-2xl p-4 mb-5 backdrop-blur-md"
          style={{
            background: insaneMode ? "rgba(185,28,28,0.3)" : "rgba(0,0,0,0.2)",
            border: insaneMode ? "1.5px solid rgba(239,68,68,0.5)" : undefined,
            transition: "background 0.5s, border 0.5s",
          }}
        >
          <div className="text-center">
            {insaneMode ? (
              <motion.p
                animate={{ opacity: [1, 0.5, 1] }}
                transition={{ repeat: Infinity, duration: 0.8 }}
                className="text-xs font-black uppercase"
                style={{ color: "#f87171" }}
              >
                🔥 INSANO
              </motion.p>
            ) : (
              <p className="text-xs text-white/60 font-bold uppercase">{t.game.round}</p>
            )}
            <p className="text-2xl font-display font-bold">{round}/{maxRounds}</p>
          </div>
          <div className="text-center border-l border-r border-white/20 px-6">
            <p className="text-xs text-white/60 font-bold uppercase">{t.game.you}</p>
            <p className="text-2xl font-display font-black text-secondary">{totalScore}</p>
            {personalBest > 0 && (
              <p className="text-[10px] text-white/35 font-bold mt-0.5">
                🏆 {personalBest}
              </p>
            )}
          </div>
          <div className="text-center">
            <p className="text-xs text-white/60 font-bold uppercase">
              {aiPersonality.emoji} {aiPersonality.name}
            </p>
            <p className="text-2xl font-display font-bold">{aiTotalScore}</p>
          </div>
        </div>

        <AnimatePresence mode="wait">

          {/* LOBBY */}
          {gameState === "LOBBY" && (
            <motion.div
              key="lobby"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
              className="flex-1 flex flex-col items-center justify-center text-center space-y-8"
            >
              <div>
                <h2 className="text-4xl font-display font-bold mb-2">{t.home.soloVsAI}</h2>
              </div>
              <Button size="xl" onClick={startGame}>{t.game.round} {round}</Button>

              {isPremium ? (
                <button
                  onClick={() => setShowPremiumModal(true)}
                  className="flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-bold transition-all"
                  style={{ background: "rgba(249,168,37,0.15)", border: "1px solid rgba(249,168,37,0.4)", color: "#f9a825" }}
                >
                  <Crown size={16} /> {t.premium.active}
                </button>
              ) : (
                <>
                  <BannerAd className="w-full max-w-md" />
                </>
              )}
            </motion.div>
          )}

          {/* SPINNING */}
          {gameState === "SPINNING" && (
            <motion.div
              key="spinning"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center gap-6"
            >
              {/* Event announcement card */}
              <AnimatePresence>
                {randomEvent && (
                  <motion.div
                    initial={{ y: -30, opacity: 0, scale: 0.85 }}
                    animate={{ y: 0, opacity: 1, scale: 1 }}
                    transition={{ type: "spring", bounce: 0.55, delay: 0.15 }}
                    className="w-full max-w-xs rounded-2xl p-4 text-center"
                    style={{
                      background:
                        randomEvent === "double_xp" ? "linear-gradient(135deg, rgba(249,168,37,0.2), rgba(234,88,12,0.15))" :
                        randomEvent === "easy_letter" ? "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(21,128,61,0.15))" :
                        randomEvent === "hidden_category" ? "linear-gradient(135deg, rgba(59,130,246,0.2), rgba(37,99,235,0.15))" :
                        randomEvent === "time_bomb" ? "linear-gradient(135deg, rgba(239,68,68,0.2), rgba(185,28,28,0.15))" :
                        "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.15))",
                      border:
                        randomEvent === "double_xp" ? "2px solid rgba(249,168,37,0.5)" :
                        randomEvent === "easy_letter" ? "2px solid rgba(34,197,94,0.5)" :
                        randomEvent === "hidden_category" ? "2px solid rgba(59,130,246,0.5)" :
                        randomEvent === "time_bomb" ? "2px solid rgba(239,68,68,0.5)" :
                        "2px solid rgba(139,92,246,0.5)",
                    }}
                  >
                    <p className="text-white/50 text-xs font-bold uppercase mb-1">{t.game.eventBanner}</p>
                    <p className="text-white font-black text-xl mb-0.5">
                      {randomEvent === "double_xp" && `⭐ ${t.game.doubleXp}`}
                      {randomEvent === "easy_letter" && `🍀 ${t.game.easyLetter}`}
                      {randomEvent === "speed" && `⚡ ${t.game.speedBonus}`}
                      {randomEvent === "hidden_category" && `🔍 ${t.game.hiddenCategory}`}
                      {randomEvent === "time_bomb" && `💣 ${t.game.timeBomb}`}
                    </p>
                    <p className="text-white/60 text-xs">
                      {randomEvent === "double_xp" && t.game.doubleXpSubtitle}
                      {randomEvent === "easy_letter" && t.game.easyLetterSubtitle}
                      {randomEvent === "speed" && t.game.speedBonusSubtitle}
                      {randomEvent === "hidden_category" && t.game.hiddenCategorySubtitle}
                      {randomEvent === "time_bomb" && t.game.timeBombSubtitle}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <h3 className="text-2xl font-display font-bold animate-pulse">{t.game.spinningLetter}</h3>
              <Roulette isSpinning={true} targetLetter={currentLetter} onSpinComplete={handleSpinComplete} />
            </motion.div>
          )}

          {/* CARD REVEAL */}
          {gameState === "CARD_REVEAL" && activeCard && (() => {
            const card = POWER_CARDS[activeCard];
            const nameKey = `${activeCard}_name` as keyof typeof t.powerCards;
            const descKey = `${activeCard}_desc` as keyof typeof t.powerCards;
            const isAuto = card.timing === "auto" || card.timing === "auto_results";
            return (
              <motion.div
                key="card-reveal"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex-1 flex flex-col items-center justify-center gap-6 px-4"
              >
                <motion.p
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="text-lg font-bold uppercase tracking-widest text-yellow-400"
                >
                  {t.powerCards.title}
                </motion.p>

                {/* Card flip */}
                <motion.div
                  initial={{ rotateY: 180, scale: 0.7 }}
                  animate={{ rotateY: 0, scale: 1 }}
                  transition={{ type: "spring", stiffness: 150, damping: 18, delay: 0.15 }}
                  className="relative w-56 h-80 rounded-3xl flex flex-col items-center justify-center gap-4 shadow-2xl border-4"
                  style={{
                    background: `linear-gradient(145deg, ${card.color}33, ${card.color}11)`,
                    borderColor: card.color,
                    boxShadow: `0 0 40px ${card.color}55`,
                  }}
                >
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ delay: 0.4, type: "spring", stiffness: 200 }}
                    className="text-8xl"
                  >
                    {card.emoji}
                  </motion.div>
                  <div className="text-center px-4">
                    <p className="font-display font-black text-xl text-white">
                      {t.powerCards[nameKey] as string}
                    </p>
                    <p className="text-sm mt-1 opacity-80 text-white/80">
                      {t.powerCards[descKey] as string}
                    </p>
                  </div>
                  {isAuto && (
                    <span
                      className="text-xs font-bold px-3 py-1 rounded-full"
                      style={{ background: `${card.color}44`, color: card.color }}
                    >
                      {t.powerCards.autoApply}
                    </span>
                  )}
                </motion.div>

                <motion.button
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.6 }}
                  onClick={proceedFromCardReveal}
                  className="px-10 py-3 rounded-2xl font-black text-lg text-white shadow-xl"
                  style={{ background: card.color }}
                >
                  {t.powerCards.proceed}
                </motion.button>

                {/* Letter reminder */}
                <p className="text-3xl font-black opacity-60">
                  {t.game.letter}: <span className="text-yellow-400">{currentLetter}</span>
                </p>
              </motion.div>
            );
          })()}

          {/* PLAYING */}
          {gameState === "PLAYING" && (
            <motion.div
              key="playing"
              initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
              className="flex-1 flex flex-col"
            >
              {/* Panic overlay — red pulse when < 10s */}
              <AnimatePresence>
                {timeLeft <= 10 && timeLeft > 0 && (
                  <motion.div
                    key="panic-overlay"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: [0, 0.18, 0] }}
                    transition={{ duration: 0.4, repeat: Infinity, repeatType: "loop" }}
                    className="fixed inset-0 z-10 pointer-events-none"
                    style={{ background: "radial-gradient(ellipse at center, rgba(220,38,38,0.5) 0%, transparent 70%)" }}
                  />
                )}
              </AnimatePresence>

              <div
                className="flex items-center gap-4 mb-5 p-4 rounded-2xl shadow-lg border-2 transition-colors duration-500"
                style={{
                  background: timeLeft <= 10 ? "rgba(185,28,28,0.5)" : "hsl(222 47% 20%)",
                  borderColor: timeLeft <= 10 ? "rgba(239,68,68,0.6)" : "rgba(255,255,255,0.1)",
                }}
              >
                {/* Letter */}
                <motion.div
                  animate={timeLeft <= 10 ? { scale: [1, 1.1, 1] } : {}}
                  transition={{ duration: 0.4, repeat: Infinity }}
                  className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-primary font-display font-black text-4xl shadow-inner flex-shrink-0"
                >
                  {currentLetter}
                </motion.div>

                {/* Timer bar */}
                <div className="flex-1">
                  <div className="flex justify-between items-center mb-1">
                    <span className="font-bold text-sm text-white/70">{t.game.round}</span>
                    <div className="flex items-center gap-2">
                      <motion.span
                        key={randomEvent === "time_bomb" ? "bomb" : timeLeft}
                        initial={{ scale: timeLeft <= 10 && randomEvent !== "time_bomb" ? 1.4 : 1 }}
                        animate={{ scale: 1 }}
                        className={
                          randomEvent === "time_bomb"
                            ? "text-red-400 font-black text-lg animate-pulse"
                            : timeLeft <= 10 ? "text-red-300 font-black text-lg" : timeLeft <= 25 ? "text-yellow-300 font-black" : "font-bold"
                        }
                      >
                        {randomEvent === "time_bomb" ? "💣?" : `${timeLeft}s`}
                      </motion.span>
                      {/* Mute toggle */}
                      <button
                        onClick={handleToggleMute}
                        className="ml-1 text-white/40 hover:text-white/80 transition-colors"
                        title={muted ? "Activar sonido" : "Silenciar"}
                      >
                        {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                  <Progress
                    value={(timeLeft / roundTime) * 100}
                    indicatorClass={timeLeft <= 10 ? "bg-red-500" : timeLeft <= 25 ? "bg-yellow-400" : "bg-green-400"}
                  />
                </div>
              </div>

              {/* Power Card active badge */}
              {activeCard && (() => {
                const card = POWER_CARDS[activeCard];
                const nameKey = `${activeCard}_name` as keyof typeof t.powerCards;
                const isPlayingCard = card.timing === "playing";
                const isUsed = cardUsed;
                return (
                  <motion.div
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-3 flex items-center gap-3 px-3 py-2 rounded-2xl border"
                    style={{
                      background: `${card.color}18`,
                      borderColor: `${card.color}55`,
                    }}
                  >
                    <span className="text-2xl">{card.emoji}</span>
                    <div className="flex-1">
                      <p className="text-xs font-black" style={{ color: card.color }}>
                        {t.powerCards[nameKey] as string}
                      </p>
                      {selectingSabotage && (
                        <p className="text-xs text-white/60">{t.powerCards.sabotage_pick}</p>
                      )}
                      {sabotageCategory && (
                        <p className="text-xs text-white/60">{t.powerCards.sabotage_active} — {sabotageCategory}</p>
                      )}
                    </div>
                    {isPlayingCard && !isUsed && !selectingSabotage && !sabotageCategory && (
                      <button
                        onClick={() => {
                          if (activeCard === "lightning") {
                            setCardUsed(true);
                            handleStop();
                          } else if (activeCard === "sabotage") {
                            setSelectingSabotage(true);
                          }
                        }}
                        className="px-3 py-1 rounded-xl text-xs font-black text-white"
                        style={{ background: card.color }}
                      >
                        {t.powerCards.use}
                      </button>
                    )}
                    {isUsed && (
                      <span className="text-xs font-bold opacity-40">{t.powerCards.passive}</span>
                    )}
                  </motion.div>
                );
              })()}

              {!rewardedUsed && (
                isPremium ? (
                  <button
                    onClick={() => { setTimeLeft(prev => prev + 20); setRewardedUsed(true); }}
                    className="mb-3 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-yellow-400/50 bg-yellow-400/15 text-yellow-300 text-sm font-bold hover:bg-yellow-400/25 transition-all"
                  >
                    {t.game.premiumBonus}
                  </button>
                ) : (
                  <button
                    onClick={() => setShowRewardedAd(true)}
                    className="mb-3 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm font-bold hover:bg-yellow-500/20 transition-all"
                  >
                    <Tv2 className="w-4 h-4" /> {t.game.watchAdForPoints}
                  </button>
                )
              )}

              {/* Bluff hint bar */}
              <div className="flex items-center justify-between mb-2 px-1">
                <p className="text-xs text-white/40">{t.bluff.bluffHint}</p>
                <p className="text-xs font-bold" style={{ color: bluffedCategories.size > 0 ? "#a855f7" : "rgba(255,255,255,0.3)" }}>
                  🎭 {bluffedCategories.size}/2
                </p>
              </div>

              <div className="space-y-2 flex-1 overflow-y-auto pb-28">
                {categories.map((category, catIdx) => {
                  const isSabotaged = sabotageCategory === category;
                  const canSabotage = selectingSabotage && !sabotageCategory;
                  const isBluffed = bluffedCategories.has(category);
                  const canBluff = !isBluffed && bluffedCategories.size >= 2;
                  const isHidden = randomEvent === "hidden_category" && catIdx === hiddenCategoryIdx;
                  return (
                    <div
                      key={category}
                      className="relative bg-card p-3 rounded-xl border transition-all"
                      style={{
                        borderColor: isBluffed ? "#a855f7" : isHidden ? "rgba(59,130,246,0.5)" : isSabotaged ? "#ef4444" : canSabotage ? "#ef444466" : "rgba(255,255,255,0.05)",
                        background: isBluffed ? "rgba(168,85,247,0.08)" : isHidden ? "rgba(59,130,246,0.06)" : undefined,
                      }}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <label className="text-xs font-black uppercase tracking-wider" style={{ color: isHidden ? "#60a5fa" : undefined }}>
                          {isHidden ? "??? 🔍" : category}
                        </label>
                        {!isSabotaged && (
                          <button
                            onClick={() => toggleBluff(category)}
                            disabled={canBluff}
                            className={`text-xs px-2 py-0.5 rounded-lg font-bold transition-all ${
                              isBluffed
                                ? "bg-purple-500 text-white"
                                : canBluff
                                ? "bg-white/5 text-white/20 cursor-not-allowed"
                                : "bg-white/10 text-white/50 hover:bg-purple-500/30 hover:text-purple-300"
                            }`}
                          >
                            {isBluffed ? t.bluff.toggleOn : "🎭"}
                          </button>
                        )}
                      </div>
                      {isSabotaged ? (
                        <div className="flex items-center gap-2 py-2 text-red-400 font-bold">
                          <span>❌</span> <span className="text-sm opacity-70">Categoría anulada para la IA</span>
                        </div>
                      ) : (
                        <Input
                          value={responses[category] || ""}
                          onChange={e => setResponses(prev => ({ ...prev, [category]: e.target.value.toUpperCase() }))}
                          placeholder={isBluffed ? `${category}... 🎭` : `${category}...`}
                          autoComplete="off"
                          autoCorrect="off"
                          className={isBluffed ? "border-purple-500/50 bg-purple-900/20" : ""}
                        />
                      )}
                      {canSabotage && (
                        <button
                          onClick={() => {
                            setSabotageCategory(category);
                            setSelectingSabotage(false);
                            setCardUsed(true);
                          }}
                          className="absolute inset-0 rounded-xl bg-red-500/20 flex items-center justify-center font-black text-red-300 text-sm border-2 border-red-500/50"
                        >
                          ❌ SABOTEAR
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>

              <div className="fixed bottom-4 left-0 w-full px-4 z-20">
                <div className="max-w-2xl mx-auto">
                  <Button
                    variant="destructive"
                    size="xl"
                    className="w-full py-6 rounded-full text-3xl shadow-2xl shadow-red-900/50 border-4 border-white/20"
                    onClick={handleStop}
                  >
                    {t.game.stop}
                  </Button>
                </div>
              </div>
            </motion.div>
          )}

          {/* EVALUATING */}
          {gameState === "EVALUATING" && (
            <motion.div
              key="evaluating"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <div className="w-16 h-16 border-4 border-white border-t-secondary rounded-full animate-spin mb-6" />
              <h2 className="text-3xl font-display font-bold">{t.game.evaluating}</h2>
            </motion.div>
          )}

          {/* JUDGING — Social deception reveal */}
          {gameState === "JUDGING" && (
            <motion.div
              key="judging"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="flex-1 flex flex-col items-center px-4 py-6 gap-5"
            >
              {/* Dramatic header */}
              <motion.div
                initial={{ scale: 0.7, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 180, damping: 14 }}
                className="text-center"
              >
                <h2 className="text-4xl font-display font-black text-yellow-400 drop-shadow-lg">
                  {t.bluff.judging_title}
                </h2>
                <p className="text-sm text-white/50 mt-1">{t.bluff.judging_sub}</p>
              </motion.div>

              {/* PHASE 1: Player bluff results */}
              {judgingPhase === "player_bluffs" && (
                <div className="w-full space-y-3">
                  {bluffResults.length === 0 ? (
                    <motion.p
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}
                      className="text-center text-white/40 text-sm py-4"
                    >
                      {t.bluff.noBluffs}
                    </motion.p>
                  ) : (
                    bluffResults.map((result, i) => (
                      <motion.div
                        key={result.category}
                        initial={{ opacity: 0, x: -40 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 1.4, type: "spring", stiffness: 150, damping: 18 }}
                        className="p-4 rounded-2xl border-2 flex items-center gap-4"
                        style={{
                          borderColor: result.caught ? "#ef4444" : "#22c55e",
                          background: result.caught ? "rgba(239,68,68,0.1)" : "rgba(34,197,94,0.1)",
                        }}
                      >
                        <motion.span
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ delay: i * 1.4 + 0.4, type: "spring" }}
                          className="text-3xl"
                        >
                          {result.caught ? "🕵️" : "🎉"}
                        </motion.span>
                        <div className="flex-1">
                          <p className="text-xs uppercase tracking-wider opacity-50">{result.category}</p>
                          <p className="font-black text-lg" style={{ color: result.caught ? "#f87171" : "#4ade80" }}>
                            {result.caught ? t.bluff.caught : t.bluff.perfect}
                          </p>
                        </div>
                        <motion.span
                          initial={{ scale: 0 }} animate={{ scale: 1 }}
                          transition={{ delay: i * 1.4 + 0.7 }}
                          className="text-xl font-black"
                          style={{ color: result.caught ? "#f87171" : "#4ade80" }}
                        >
                          {result.scoreChange > 0 ? "+" : ""}{result.scoreChange}{t.bluff.pts}
                        </motion.span>
                      </motion.div>
                    ))
                  )}

                  {/* Proceed to AI bluff phase */}
                  <motion.button
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.max(bluffResults.length * 1.4 + 0.6, 0.8) }}
                    onClick={() => setJudgingPhase("ai_bluff")}
                    className="w-full py-4 rounded-2xl font-black text-white text-lg shadow-lg"
                    style={{ background: "hsl(222 47% 25%)", border: "2px solid rgba(255,255,255,0.12)" }}
                  >
                    {t.bluff.aiPhaseTitle} →
                  </motion.button>
                </div>
              )}

              {/* PHASE 2: AI bluff accusation */}
              {judgingPhase === "ai_bluff" && aiBluffReveal && playerJudgedAi === null && (
                <motion.div
                  initial={{ opacity: 0, y: 24 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ type: "spring" }}
                  className="w-full space-y-5"
                >
                  <p className="text-center text-white/60 text-sm">{t.bluff.aiSuspicious}</p>

                  {/* AI's suspicious answer card */}
                  <div
                    className="p-6 rounded-3xl border-2 text-center shadow-2xl"
                    style={{ background: "hsl(222 47% 20%)", borderColor: "rgba(255,255,255,0.12)" }}
                  >
                    <p className="text-xs uppercase tracking-widest opacity-50 mb-2">{aiBluffReveal.category}</p>
                    <p className="text-4xl font-black mb-1">{aiBluffReveal.answer || "—"}</p>
                    <div className="flex items-center justify-center gap-2 mt-2">
                      <span className="text-2xl">{aiPersonality.emoji}</span>
                      <p className="text-sm font-bold opacity-60">{aiPersonality.name}</p>
                    </div>
                  </div>

                  <p className="text-center font-bold text-white">{t.bluff.aiQuestion}</p>

                  <div className="grid grid-cols-2 gap-3">
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleJudgeAi(false)}
                      className="py-5 rounded-2xl font-black text-green-300 text-lg border-2"
                      style={{ background: "rgba(34,197,94,0.12)", borderColor: "rgba(34,197,94,0.4)" }}
                    >
                      {t.bluff.btnReal}
                    </motion.button>
                    <motion.button
                      whileTap={{ scale: 0.95 }}
                      onClick={() => handleJudgeAi(true)}
                      className="py-5 rounded-2xl font-black text-purple-300 text-lg border-2"
                      style={{ background: "rgba(168,85,247,0.12)", borderColor: "rgba(168,85,247,0.4)" }}
                    >
                      {t.bluff.btnLie}
                    </motion.button>
                  </div>
                </motion.div>
              )}

              {/* PHASE 2 reveal: after player judges AI */}
              {judgingPhase === "ai_bluff" && playerJudgedAi !== null && aiBluffReveal && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.88 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ type: "spring", stiffness: 180, damping: 16 }}
                  className="w-full space-y-4 text-center"
                >
                  {aiBluffReveal.wasActuallyBluffing === playerJudgedAi ? (
                    <>
                      <motion.p
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-6xl"
                      >🕵️</motion.p>
                      <p className="text-3xl font-black text-green-400">{t.bluff.detectPerfect}</p>
                      <p className="text-green-300 font-bold text-xl">+15{t.bluff.pts}</p>
                      <p className="text-sm text-white/50">
                        {playerJudgedAi ? t.bluff.aiActuallyLied : t.bluff.aiWasReal}
                      </p>
                    </>
                  ) : (
                    <>
                      <motion.p
                        initial={{ scale: 0 }} animate={{ scale: 1 }}
                        transition={{ type: "spring", stiffness: 200 }}
                        className="text-6xl"
                      >{aiPersonality.emoji}</motion.p>
                      <p className="text-3xl font-black text-red-400">{t.bluff.aiWon} 😈</p>
                      <p className="text-sm text-white/50">
                        {aiBluffReveal.wasActuallyBluffing ? t.bluff.aiActuallyLied : t.bluff.aiWasReal}
                      </p>
                    </>
                  )}

                  <motion.button
                    initial={{ opacity: 0, y: 12 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5 }}
                    onClick={() => setGameState("RESULTS")}
                    className="w-full py-4 rounded-2xl font-black text-white text-lg"
                    style={{ background: "hsl(6 90% 55%)" }}
                  >
                    {t.bluff.seeResults}
                  </motion.button>
                </motion.div>
              )}
            </motion.div>
          )}

          {/* RESULTS */}
          {gameState === "RESULTS" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col pb-8"
            >
              {/* Round won/lost announcement */}
              <AnimatePresence>
                {roundWon !== null && (
                  <motion.div
                    key={roundWon ? "won" : "lost"}
                    initial={{ scale: 0.7, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: "spring", bounce: 0.55 }}
                    className="flex items-center justify-center gap-3 mb-4 py-3 px-4 rounded-2xl"
                    style={{
                      background: roundWon
                        ? "linear-gradient(135deg, rgba(34,197,94,0.2), rgba(21,128,61,0.15))"
                        : "linear-gradient(135deg, rgba(239,68,68,0.15), rgba(185,28,28,0.1))",
                      border: roundWon
                        ? "2px solid rgba(34,197,94,0.4)"
                        : "2px solid rgba(239,68,68,0.3)",
                    }}
                  >
                    {roundWon
                      ? <Trophy className="w-6 h-6 text-green-400" fill="rgba(34,197,94,0.5)" />
                      : <span className="text-2xl">💻</span>
                    }
                    <div>
                      <p className={`font-black text-lg ${roundWon ? "text-green-300" : "text-red-300"}`}>
                        {roundWon ? t.game.roundWon : t.game.roundLost}
                      </p>
                      {/* Close-loss frustration message */}
                      {roundWon === false && results && (() => {
                        const roundPs = results.playerTotalScore || 0;
                        const roundAs = results.aiTotalScore || 0;
                        const margin = roundAs - roundPs;
                        if (margin > 0 && margin <= 15) {
                          return (
                            <p className="text-red-200/80 text-xs font-bold mt-0.5">
                              {lang === "en" ? `Only ${margin} pts behind 😤` : lang === "pt" ? `Só ${margin} pts atrás 😤` : lang === "fr" ? `Juste ${margin} pts de retard 😤` : `Perdiste por solo ${margin} pts 😤`}
                            </p>
                          );
                        }
                        return null;
                      })()}
                    </div>
                    {combo >= 2 && roundWon && (
                      <div
                        className="flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-black"
                        style={{ background: "rgba(239,68,68,0.3)", color: "#fca5a5" }}
                      >
                        <Flame size={10} /> x{combo}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              <h2 className="text-xl font-display font-bold mb-3 text-center opacity-70">{t.game.results}</h2>

              <div className="bg-primary/50 rounded-2xl p-4 flex justify-around mb-3 border border-white/10">
                <div className="text-center">
                  <p className="text-sm font-bold text-white/60">{t.game.you}</p>
                  <motion.p
                    key={results?.playerTotalScore}
                    initial={{ scale: 1.4, color: "#fbbf24" }}
                    animate={{ scale: 1, color: "hsl(48 96% 57%)" }}
                    transition={{ duration: 0.4 }}
                    className="text-4xl font-display font-black"
                    style={{ color: "hsl(48 96% 57%)" }}
                  >
                    +{results?.playerTotalScore || 0}
                  </motion.p>
                </div>
                <div className="text-center border-l border-white/20 pl-8">
                  <p className="text-sm font-bold text-white/60">
                    {aiPersonality.emoji} {aiPersonality.name}
                  </p>
                  <p className="text-4xl font-display font-black">+{results?.aiTotalScore || 0}</p>
                </div>
              </div>

              {/* AI personality comment bubble */}
              <AnimatePresence>
                {aiComment && (
                  <motion.div
                    initial={{ opacity: 0, y: 10, scale: 0.92 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ type: "spring", bounce: 0.4 }}
                    className="flex items-start gap-2 px-4 py-2.5 rounded-2xl mb-4"
                    style={{
                      background: `${aiPersonality.color}18`,
                      border: `1.5px solid ${aiPersonality.color}44`,
                    }}
                  >
                    <span className="text-2xl flex-shrink-0 mt-0.5">{aiPersonality.emoji}</span>
                    <div>
                      <p className="text-xs font-black mb-0.5" style={{ color: aiPersonality.color }}>
                        {aiPersonality.name}
                      </p>
                      <p className="text-white/85 text-sm font-semibold italic">"{aiComment}"</p>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Special card reveal (Oracle / Steal / Sabotage) */}
              <AnimatePresence>
                {specialReveal && (() => {
                  const isSabotageReveal = specialReveal.type === "sabotage";
                  const isOracle = specialReveal.type === "oracle";
                  const color = isSabotageReveal ? "#ef4444" : isOracle ? "#a855f7" : "#22d3ee";
                  const emoji = isSabotageReveal ? "💣" : isOracle ? "🔮" : "🔄";
                  const label = isSabotageReveal
                    ? t.powerCards.sabotage_steal
                    : isOracle ? t.powerCards.oracle_reveal : t.powerCards.steal_reveal;
                  return (
                    <motion.div
                      key="special-reveal"
                      initial={{ opacity: 0, scale: 0.88, y: 10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0 }}
                      transition={{ type: "spring", stiffness: 200, damping: 20 }}
                      className="mb-4 px-4 py-3 rounded-2xl border-2 flex items-center gap-3"
                      style={{ background: `${color}18`, borderColor: `${color}55` }}
                    >
                      <span className="text-3xl">{emoji}</span>
                      <div>
                        <p className="text-xs font-black uppercase" style={{ color }}>{label}</p>
                        <p className="text-sm font-bold text-white">
                          {specialReveal.category}: <span style={{ color }} className="font-black">{specialReveal.word || "—"}</span>
                          {isSabotageReveal && specialReveal.pts
                            ? <span className="ml-2 text-green-400 font-black">+{specialReveal.pts}pts</span>
                            : null}
                        </p>
                      </div>
                    </motion.div>
                  );
                })()}
              </AnimatePresence>

              <div className="space-y-3 mb-6 flex-1 overflow-y-auto">
                {categories.map((category, idx) => {
                  const res = results?.results?.[category];
                  const playerRes = res?.player;
                  const aiRes = res?.ai;
                  const isSabotaged = sabotageCategory === category;
                  const isDuplicate = (playerRes as (typeof playerRes & { isDuplicate?: boolean }) | undefined)?.isDuplicate === true;
                  const isCaughtBluff = bluffResults.some(br => br.category === category && br.caught);
                  const playerWon = !isDuplicate && !isCaughtBluff && (playerRes?.score ?? 0) > ((isSabotaged ? 0 : aiRes?.score) ?? 0);
                  const tied = !isSabotaged && !isDuplicate && !isCaughtBluff && (playerRes?.score ?? 0) === (aiRes?.score ?? 0) && (playerRes?.score ?? 0) > 0;

                  return (
                    <motion.div
                      key={category}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.07 }}
                    >
                      <Card className="p-4 bg-black/20 border-white/5">
                        <div className="flex items-center gap-2 mb-2">
                          <h4 className="font-bold text-secondary text-xs uppercase tracking-wider flex-1">{category}</h4>
                          {isDuplicate && <span className="text-red-400 text-xs font-black">REPETIDA ❌</span>}
                          {isCaughtBluff && <span className="text-red-400 text-xs font-black">PILLADO 🕵️ −10pts</span>}
                          {!isDuplicate && !isCaughtBluff && playerWon && <span className="text-green-400 text-xs font-black">+{playerRes?.score}pts ✓</span>}
                          {!isDuplicate && !isCaughtBluff && tied && <span className="text-yellow-400 text-xs font-black">={playerRes?.score}pts</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className={`bg-card p-3 rounded-lg border relative overflow-hidden ${isDuplicate || isCaughtBluff ? "border-red-500/40" : "border-white/10"}`}>
                            <p className="text-xs text-white/50 font-bold mb-1">{t.game.you}</p>
                            <p className={`font-semibold text-lg break-words ${isDuplicate || isCaughtBluff ? "line-through opacity-50" : ""}`}>{playerRes?.response || t.game.empty}</p>
                            {isDuplicate && <p className="text-red-400 text-xs font-bold mt-1">0pts — respuesta repetida</p>}
                            {isCaughtBluff && <p className="text-red-400 text-xs font-bold mt-1">0pts — pillado mintiendo</p>}
                            <div className={`absolute top-0 right-0 h-full w-1.5 ${isDuplicate || isCaughtBluff ? "bg-red-500/60" : (playerRes?.score ?? 0) >= 10 ? "bg-green-500" : (playerRes?.score ?? 0) >= 5 ? "bg-yellow-400" : "bg-red-500/60"}`} />
                            {!isDuplicate && !isCaughtBluff && <span className="absolute bottom-2 right-3 text-xs font-bold opacity-50">{playerRes?.score ?? 0}{t.game.points}</span>}
                          </div>
                          <div
                            className="p-3 rounded-lg border relative overflow-hidden"
                            style={{
                              background: isSabotaged ? "rgba(239,68,68,0.12)" : "hsl(222 47% 25%)",
                              borderColor: isSabotaged ? "#ef444455" : "rgba(255,255,255,0.1)",
                            }}
                          >
                            <p className="text-xs text-white/50 font-bold mb-1">{t.game.ai}</p>
                            {isSabotaged ? (
                              <p className="font-bold text-red-400 text-sm">❌ SABOTAJE</p>
                            ) : (
                              <p className="font-semibold text-lg break-words">{aiRes?.response || t.game.empty}</p>
                            )}
                            <div className={`absolute top-0 right-0 h-full w-1.5 ${isSabotaged ? "bg-red-500" : (aiRes?.score ?? 0) >= 10 ? "bg-green-500" : (aiRes?.score ?? 0) >= 5 ? "bg-yellow-400" : "bg-red-500/60"}`} />
                            <span className="absolute bottom-2 right-3 text-xs font-bold opacity-50">
                              {isSabotaged ? "0" : (aiRes?.score ?? 0)}{t.game.points}
                            </span>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {!isPremium && <BannerAd className="mb-4" />}

              {/* Double or Nothing result badge */}
              {activeCard === "double_or_nothing" && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.85 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center gap-3 justify-center mb-3 py-2 px-4 rounded-xl font-black"
                  style={{
                    background: roundWon ? "rgba(249,115,22,0.15)" : "rgba(100,100,100,0.12)",
                    border: roundWon ? "1px solid rgba(249,115,22,0.4)" : "1px solid rgba(150,150,150,0.2)",
                  }}
                >
                  <span className="text-xl">🎯</span>
                  <span style={{ color: roundWon ? "#f97316" : "#888" }}>
                    {roundWon ? "DOBLE O NADA: ×3 XP 🔥" : "DOBLE O NADA: ×0 XP 💀"}
                  </span>
                </motion.div>
              )}

              {/* Shield used badge */}
              {activeCard === "shield" && roundWon === false && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 justify-center mb-3 py-2 px-4 rounded-xl text-sm font-bold"
                  style={{ background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }}
                >
                  🛡️ {t.powerCards.shield_desc}
                </motion.div>
              )}

              {/* XP multiplier hint (mid-game) */}
              {round < maxRounds && randomEvent && (
                <div
                  className="flex items-center gap-2 justify-center mb-3 py-1.5 px-3 rounded-xl text-xs font-bold"
                  style={{ background: "rgba(249,168,37,0.1)", border: "1px solid rgba(249,168,37,0.2)" }}
                >
                  <Star size={12} className="text-[#f9a825]" />
                  <span className="text-[#f9a825]">
                    {randomEvent === "double_xp" && t.game.doubleXp}
                    {randomEvent === "easy_letter" && t.game.easyLetter}
                    {randomEvent === "speed" && t.game.speedBonus}
                    {randomEvent === "hidden_category" && t.game.hiddenCategory}
                    {randomEvent === "time_bomb" && t.game.timeBomb}
                  </span>
                </div>
              )}

              {/* XP earned notification (final) */}
              {round >= maxRounds && lastXpGain > 0 && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.8 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="flex items-center justify-center gap-2 mb-3 py-2 px-4 rounded-xl"
                  style={{ background: "rgba(249,168,37,0.15)", border: "1px solid rgba(249,168,37,0.3)" }}
                >
                  <Star className="w-4 h-4 text-[#f9a825]" fill="rgba(249,168,37,0.5)" />
                  <span className="text-[#f9a825] font-black text-sm">+{lastXpGain} {t.game.xpEarned}</span>
                  {(randomEvent === "double_xp" || (randomEvent === "speed" && roundWon) || combo >= 2) && (
                    <span className="text-[#f9a825]/60 text-xs font-bold">
                      {randomEvent === "double_xp" ? "×2" : randomEvent === "speed" && roundWon ? "×3" : combo >= 4 ? "×2" : "×1.5"}
                    </span>
                  )}
                </motion.div>
              )}

              {/* Personal best result — shown on final round */}
              {round >= maxRounds && bestResult && (
                <motion.div
                  key="personal-best"
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ type: "spring", bounce: 0.55, delay: 0.3 }}
                  className="flex flex-col items-center justify-center mb-3 py-3 px-4 rounded-2xl gap-1"
                  style={
                    bestResult.isNew
                      ? { background: "linear-gradient(135deg,rgba(249,168,37,0.25),rgba(229,62,18,0.2))", border: "2px solid rgba(249,168,37,0.6)" }
                      : { background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)" }
                  }
                >
                  {bestResult.isNew ? (
                    <>
                      <span className="text-2xl">🏆</span>
                      <p className="text-yellow-300 font-black text-base text-center">
                        {lang === "en" ? "NEW PERSONAL RECORD!" : lang === "pt" ? "NOVO RECORDE PESSOAL!" : lang === "fr" ? "NOUVEAU RECORD PERSO !" : "¡NUEVO RÉCORD PERSONAL!"}
                      </p>
                      <p className="text-yellow-200/70 text-xs font-bold text-center">
                        {totalScore} {lang === "en" ? "pts — your best ever" : lang === "pt" ? "pts — o teu melhor" : lang === "fr" ? "pts — ton meilleur" : "pts — ¡tu mejor marca!"}
                      </p>
                    </>
                  ) : personalBest > 0 ? (
                    <>
                      <p className="text-white/50 text-xs font-bold text-center">
                        🏆 {lang === "en" ? "Record" : lang === "pt" ? "Recorde" : lang === "fr" ? "Record" : "Récord"}: {personalBest} pts
                      </p>
                      {bestResult.diff > -20 ? (
                        <p className="text-white/80 font-black text-sm text-center">
                          {lang === "en" ? `So close! ${Math.abs(bestResult.diff)} pts away 😤` : lang === "pt" ? `Tão perto! Faltaram ${Math.abs(bestResult.diff)} pts 😤` : lang === "fr" ? `Si proche ! ${Math.abs(bestResult.diff)} pts de plus 😤` : `¡Tan cerca! Te faltaron ${Math.abs(bestResult.diff)} pts 😤`}
                        </p>
                      ) : (
                        <p className="text-white/60 text-xs text-center">
                          {lang === "en" ? "Can you beat your record? 🎯" : lang === "pt" ? "Consegues bater o teu recorde? 🎯" : lang === "fr" ? "Peux-tu battre ton record ? 🎯" : "¿Puedes superar tu récord? 🎯"}
                        </p>
                      )}
                    </>
                  ) : null}
                </motion.div>
              )}

              {/* Level up notification */}
              <AnimatePresence>
                {levelUpInfo && (
                  <motion.div
                    initial={{ opacity: 0, y: -10, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                    className="flex items-center justify-center gap-2 mb-3 py-2 px-4 rounded-xl cursor-pointer"
                    style={{ background: "linear-gradient(135deg, rgba(249,168,37,0.3), rgba(229,62,18,0.2))", border: "2px solid rgba(249,168,37,0.5)" }}
                    onClick={clearLevelUp}
                  >
                    <span className="text-2xl">🎉</span>
                    <span className="text-white font-black text-sm">{t.game.newLevel} {levelUpInfo.from} → {levelUpInfo.to}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Guest warning: score not saved */}
              {round >= maxRounds && (!player || player.loginMethod === "guest") && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mb-3 rounded-xl px-4 py-3 flex items-start gap-3 cursor-pointer"
                  style={{ background: "rgba(249,168,37,0.15)", border: "1.5px solid rgba(249,168,37,0.45)" }}
                  onClick={showAuth}
                >
                  <span className="text-xl mt-0.5">⚠️</span>
                  <div>
                    <p className="text-yellow-300 font-black text-sm leading-tight">
                      {lang === "pt" ? "Pontuação não salva" : lang === "en" ? "Score not saved" : lang === "fr" ? "Score non enregistré" : "Puntuación no guardada"}
                    </p>
                    <p className="text-yellow-200/70 text-xs mt-0.5">
                      {lang === "pt" ? "Inicia sessão para aparecer no ranking" : lang === "en" ? "Sign in to appear on the leaderboard" : lang === "fr" ? "Connecte-toi pour apparaître au classement" : "Inicia sesión para aparecer en el ranking"}
                    </p>
                  </div>
                </motion.div>
              )}

              <div className="grid grid-cols-2 gap-3">
                {round >= maxRounds ? (
                  isDailyMode ? (
                    <Button size="lg" className="col-span-2" onClick={nextRound}>
                      {t.daily.seeRanking ?? "Ver ranking del día"}
                    </Button>
                  ) : (
                    <>
                      <Button size="lg" onClick={nextRound}>
                        {t.game.playAgain}
                      </Button>
                      <Button
                        variant="secondary"
                        size="lg"
                        onClick={() => setShowShareModal(true)}
                        className="flex items-center justify-center gap-2"
                      >
                        <Star size={16} /> {t.game.shareResults}
                      </Button>
                    </>
                  )
                ) : (
                  <Button size="lg" className="col-span-2" onClick={nextRound}>
                    {t.game.nextRound} ({round + 1}/{maxRounds})
                  </Button>
                )}
              </div>
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </Layout>
  );
}
