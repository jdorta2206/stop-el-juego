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

type GameState = "LOBBY" | "SPINNING" | "PLAYING" | "EVALUATING" | "RESULTS";
type RandomEvent = "double_xp" | "easy_letter" | "speed" | null;

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
  const { player } = usePlayer();
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

  const baseRoundTime = isQuickMode ? QUICK_ROUND_TIME : isChaosMode ? CHAOS_ROUND_TIME : ROUND_TIME;
  const effectiveRoundTime = (!isQuickMode && !isDailyMode && !isChaosMode && randomEvent === "speed")
    ? SPEED_ROUND_TIME : baseRoundTime;
  const roundTime = effectiveRoundTime;
  const maxRounds = isDailyMode ? 1 : isQuickMode ? 1 : MAX_ROUNDS;

  // AI personality (picked once per session)
  const [aiPersonality] = useState<AIPersonality>(() => pickRandomPersonality());
  const [aiComment, setAiComment] = useState<string | null>(null);

  // Achievements system
  const { newlyUnlocked, afterRound, clearNewlyUnlocked } = useAchievements();

  // Sound hook
  const sound = useSound(muted);

  // Re-read categories when language changes (only if not daily mode)
  useEffect(() => {
    if (!isDailyMode) setCategories(getCategories());
  }, [lang, isDailyMode]);

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

  const startGame = () => {
    setAiComment(null);
    // Pick random event (only in normal solo mode)
    let event: RandomEvent = null;
    if (!isDailyMode && !isQuickMode && !isChaosMode) {
      const roll = Math.random();
      if (roll < 0.25) event = "double_xp";
      else if (roll < 0.45) event = "easy_letter";
      else if (roll < 0.60) event = "speed";
    }
    if (isChaosMode) event = "double_xp"; // chaos always = double XP
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
    setGameState("SPINNING");
  };

  const startRound = () => {
    setGameState("PLAYING");
    setTimeLeft(roundTime);
    setRewardedUsed(false);
    sound.playRoundStart();

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          handleStop();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleStop = async () => {
    if (timerRef.current) clearInterval(timerRef.current);
    sound.playStop();
    setGameState("EVALUATING");

    const formattedResponses = categories.map(cat => ({
      category: cat,
      word: responses[cat] || ""
    }));

    try {
      await validateMutation.mutateAsync({
        data: {
          letter: currentLetter,
          language: getCurrentLang(),
          playerName: player?.name,
          playerResponses: formattedResponses,
        }
      });
    } catch {
      // Fallback: proceed to results without API
    }
    setGameState("RESULTS");
  };

  const results = validateMutation.data;

  useEffect(() => {
    if (gameState === "RESULTS" && results) {
      const ps = results.playerTotalScore || 0;
      const as_ = results.aiTotalScore || 0;
      const won = ps > as_;

      setTotalScore(prev => prev + ps);
      setAiTotalScore(prev => prev + as_);
      setRoundWon(won);

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
          if (newCombo >= 2) {
            sound.playCombo(newCombo);
          } else {
            sound.playWin();
          }
          return newCombo;
        });
      } else {
        sound.playLose();
        setCombo(0);
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
      setRandomEvent(null);
      setRoundWon(null);
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
        />

        {/* Achievement toast notification */}
        <AchievementToast
          achievement={newlyUnlocked}
          onDone={clearNewlyUnlocked}
          tAchievements={t.achievements as Record<string, string>}
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
                    "linear-gradient(135deg, rgba(139,92,246,0.9), rgba(109,40,217,0.9))",
                  color: "white",
                }}
              >
                {randomEvent === "double_xp" && <><Star size={11} fill="white" /> {t.game.doubleXp}</>}
                {randomEvent === "easy_letter" && <>🍀 {t.game.easyLetter}</>}
                {randomEvent === "speed" && <><Zap size={11} fill="white" /> {t.game.speedBonus}</>}
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

        {/* Header Stats */}
        <div className="flex justify-between items-center bg-black/20 rounded-2xl p-4 mb-5 backdrop-blur-md">
          <div className="text-center">
            <p className="text-xs text-white/60 font-bold uppercase">{t.game.round}</p>
            <p className="text-2xl font-display font-bold">{round}/{maxRounds}</p>
          </div>
          <div className="text-center border-l border-r border-white/20 px-6">
            <p className="text-xs text-white/60 font-bold uppercase">{t.game.you}</p>
            <p className="text-2xl font-display font-black text-secondary">{totalScore}</p>
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
                        "linear-gradient(135deg, rgba(139,92,246,0.2), rgba(109,40,217,0.15))",
                      border:
                        randomEvent === "double_xp" ? "2px solid rgba(249,168,37,0.5)" :
                        randomEvent === "easy_letter" ? "2px solid rgba(34,197,94,0.5)" :
                        "2px solid rgba(139,92,246,0.5)",
                    }}
                  >
                    <p className="text-white/50 text-xs font-bold uppercase mb-1">{t.game.eventBanner}</p>
                    <p className="text-white font-black text-xl mb-0.5">
                      {randomEvent === "double_xp" && `⭐ ${t.game.doubleXp}`}
                      {randomEvent === "easy_letter" && `🍀 ${t.game.easyLetter}`}
                      {randomEvent === "speed" && `⚡ ${t.game.speedBonus}`}
                    </p>
                    <p className="text-white/60 text-xs">
                      {randomEvent === "double_xp" && t.game.doubleXpSubtitle}
                      {randomEvent === "easy_letter" && t.game.easyLetterSubtitle}
                      {randomEvent === "speed" && t.game.speedBonusSubtitle}
                    </p>
                  </motion.div>
                )}
              </AnimatePresence>

              <h3 className="text-2xl font-display font-bold animate-pulse">{t.game.spinningLetter}</h3>
              <Roulette isSpinning={true} targetLetter={currentLetter} onSpinComplete={startRound} />
            </motion.div>
          )}

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
                        key={timeLeft}
                        initial={{ scale: timeLeft <= 10 ? 1.4 : 1 }}
                        animate={{ scale: 1 }}
                        className={timeLeft <= 10 ? "text-red-300 font-black text-lg" : timeLeft <= 25 ? "text-yellow-300 font-black" : "font-bold"}
                      >
                        {timeLeft}s
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

              {!rewardedUsed && (
                <button
                  onClick={() => setShowRewardedAd(true)}
                  className="mb-3 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm font-bold hover:bg-yellow-500/20 transition-all"
                >
                  <Tv2 className="w-4 h-4" /> {t.game.watchAdForPoints}
                </button>
              )}

              <div className="space-y-2 flex-1 overflow-y-auto pb-28">
                {categories.map(category => (
                  <div key={category} className="bg-card p-3 rounded-xl border border-white/5">
                    <label className="block text-xs font-black text-secondary mb-1 uppercase tracking-wider">{category}</label>
                    <Input
                      value={responses[category] || ""}
                      onChange={e => setResponses({ ...responses, [category]: e.target.value.toUpperCase() })}
                      placeholder={`${category}...`}
                      autoComplete="off"
                      autoCorrect="off"
                    />
                  </div>
                ))}
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
                    <p className={`font-black text-lg ${roundWon ? "text-green-300" : "text-red-300"}`}>
                      {roundWon ? t.game.roundWon : t.game.roundLost}
                    </p>
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

              <div className="space-y-3 mb-6 flex-1 overflow-y-auto">
                {categories.map((category, idx) => {
                  const res = results?.results?.[category];
                  const playerRes = res?.player;
                  const aiRes = res?.ai;
                  const playerWon = (playerRes?.score ?? 0) > (aiRes?.score ?? 0);
                  const tied = (playerRes?.score ?? 0) === (aiRes?.score ?? 0) && (playerRes?.score ?? 0) > 0;

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
                          {playerWon && <span className="text-green-400 text-xs font-black">+{playerRes?.score}pts ✓</span>}
                          {tied && <span className="text-yellow-400 text-xs font-black">={playerRes?.score}pts</span>}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div className="bg-card p-3 rounded-lg border border-white/10 relative overflow-hidden">
                            <p className="text-xs text-white/50 font-bold mb-1">{t.game.you}</p>
                            <p className="font-semibold text-lg break-words">{playerRes?.response || t.game.empty}</p>
                            <div className={`absolute top-0 right-0 h-full w-1.5 ${(playerRes?.score ?? 0) >= 10 ? "bg-green-500" : (playerRes?.score ?? 0) >= 5 ? "bg-yellow-400" : "bg-red-500/60"}`} />
                            <span className="absolute bottom-2 right-3 text-xs font-bold opacity-50">{playerRes?.score ?? 0}{t.game.points}</span>
                          </div>
                          <div className="bg-primary/40 p-3 rounded-lg border border-white/10 relative overflow-hidden">
                            <p className="text-xs text-white/50 font-bold mb-1">{t.game.ai}</p>
                            <p className="font-semibold text-lg break-words">{aiRes?.response || t.game.empty}</p>
                            <div className={`absolute top-0 right-0 h-full w-1.5 ${(aiRes?.score ?? 0) >= 10 ? "bg-green-500" : (aiRes?.score ?? 0) >= 5 ? "bg-yellow-400" : "bg-red-500/60"}`} />
                            <span className="absolute bottom-2 right-3 text-xs font-bold opacity-50">{aiRes?.score ?? 0}{t.game.points}</span>
                          </div>
                        </div>
                      </Card>
                    </motion.div>
                  );
                })}
              </div>

              {!isPremium && <BannerAd className="mb-4" />}

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
