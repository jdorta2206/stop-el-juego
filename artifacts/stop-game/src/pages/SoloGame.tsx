import { trackAnalyticsEvent } from "@/lib/analyticsClient";
import { hasAndroidAppReferrer } from "@/lib/playBilling";
import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import confetti from "canvas-confetti";
import { Layout } from "@/components/Layout";
import { HalloweenAmbience } from "@/components/HalloweenAmbience";
import { Button, Card, Input, Progress } from "@/components/ui";
import { Roulette } from "@/components/Roulette";
import { getCategories, getAlphabet, getCurrentLang, getApiUrl, authHeaders } from "@/lib/utils";
import { ensureOfflineBundle, validateRoundOffline, getAiWordOffline, getCachedOfflineBundle, enqueueScoreOutbox, flushScoreOutbox } from "@/lib/offlineGame";
import { getSelectedPackId, getPackCategories, getSafePackId, getPackById } from "@/data/categoryPacks";
import { useCustomPacks } from "@/lib/useCustomPacks";
import { useValidateRound, useSubmitScore, type CategoryResult, type ValidateRoundResponse } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { motion, AnimatePresence } from "framer-motion";
import { RewardedAd, BannerAd } from "@/components/AdSystem";
import { isGameTimerPaused, resumeGameTimer } from "@/lib/timerPauseGuard";
import { ContextualPremiumPrompt } from "@/components/ContextualPremiumPrompt";
import { PremiumModal } from "@/components/PremiumModal";
import { ShareResultsModal } from "@/components/ShareResultsModal";
import { ClipGenerator } from "@/components/ClipGenerator";
import { recordExternalStat } from "@/hooks/useAchievements";
import { usePremium } from "@/lib/usePremium";
import { Tv2, Crown, Volume2, VolumeX, Zap, Star, Flame, Trophy, EyeOff } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useTicker } from "@/hooks/useTicker";
import { useStreak } from "@/hooks/useStreak";
import { useProgression, calcXpFromResults } from "@/hooks/useProgression";
import { reportSeasonEvent } from "@/hooks/useSeason";
import { reportHalloweenEvent } from "@/hooks/useHalloweenProgress";
import { trackGuestGame, trackGuestConversion } from "@/lib/guestStats";
import { useSound } from "@/hooks/useSound";
import { useToast } from "@/hooks/use-toast";
import { pickRandomPersonality, getAIComment, type AIPersonality } from "@/data/aiPersonalities";
import { useFTUE } from "@/hooks/useFTUE";
import { FirstVictoryCelebration } from "@/components/FirstVictoryCelebration";
import { useAchievements } from "@/hooks/useAchievements";
import { AchievementToast } from "@/components/AchievementToast";
import { useCollection } from "@/hooks/useCollection";
import { CollectionToast } from "@/components/CollectionToast";
import { drawPowerCard, POWER_CARDS, type PowerCardId } from "@/data/powerCards";
import { usePersonalBest } from "@/hooks/usePersonalBest";
import { useReviewPrompt, recordGamePlayed, recordScoreAndPercentile } from "@/hooks/useReviewPrompt";
import { maybeShowInterstitial, recordInterstitialGameCompleted } from "@/lib/interstitialAd";
import { ReviewPromptCard } from "@/components/ReviewPromptCard";
import { applyHalloweenCategory, isHalloweenActive, isHalloweenPreview, getHalloweenScare, isHalloweenModeEnabled } from "@/lib/halloweenEvent";
import { HalloweenBanner } from "@/components/HalloweenBanner";
import { HalloweenGameTheme } from "@/components/HalloweenGameTheme";
import { HalloweenScareOverlay } from "@/components/HalloweenScare";
import type { HalloweenScare } from "@/lib/halloweenEvent";
import { getHalloweenReducedEffects, setHalloweenReducedEffects } from "@/lib/halloweenAccessibility";
import { preloadHalloweenScareAssets } from "@/lib/halloweenScareAssets";
import { preloadHalloweenScareAudio } from "@/lib/halloweenScareAudio";

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
const REWARDED_ADS_DISABLED = (() => {
  // The web preview must expose the same rewarded-power-up UI as the launched
  // game. Native AdMob playback itself remains TWA-only; the preview bridge
  // handles the test flow separately.
  if (import.meta.env.VITE_HALLOWEEN_PREVIEW === "true") return false;
  if (new URLSearchParams(window.location.search).get("rewardedAds") === "1") return false;
  if (import.meta.env.VITE_REWARDED_ADS_DISABLED !== "1") return false;
  // Keep rewarded ads disabled on normal web browsers, but allow the native
  // Google Play TWA to use the real AdMob RewardedAdActivity.
  try {
    const params = new URLSearchParams(window.location.search);
    const twaByReferrer = document.referrer.startsWith("android-app://app.replit.stop_el_juego.twa");
    const twaBySource = params.get("source") === "googleplay-twa" || params.get("source") === "twa";
    const androidStandalone = /Android/i.test(navigator.userAgent || "") &&
      (window.matchMedia?.("(display-mode: standalone)").matches === true ||
       window.matchMedia?.("(display-mode: fullscreen)").matches === true);
    return !(twaByReferrer || twaBySource || androidStandalone || hasAndroidAppReferrer());
  } catch {
    return true;
  }
})();

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
  const { isPremium, loading: premiumLoading } = usePremium(player?.id);
  const { streak: soloStreak, recordPlay } = useStreak();
  const { t, lang } = useT();
  const { addXp, levelUpInfo, clearLevelUp } = useProgression(player?.id);
  const [, setLocation] = useLocation();
  const [gameState, setGameState] = useState<GameState>("LOBBY");
  const [currentLetter, setCurrentLetter] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const gameTimerPausedRef = useRef(false);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [aiTotalScore, setAiTotalScore] = useState(0);
  // null = closed, otherwise the type of reward being shown
  const [rewardedAdType, setRewardedAdType] = useState<null | "extraTime" | "hint" | "double">(null);
  const [rewardedUsed, setRewardedUsed] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [doubleUsed, setDoubleUsed] = useState(false);
  const [hintReveal, setHintReveal] = useState<{ category: string; word: string } | null>(null);
  const [showPremiumModal, setShowPremiumModal] = useState(false);
  const [showShareModal, setShowShareModal] = useState(false);
  const [showClipModal, setShowClipModal] = useState(false);
  const [lastXpGain, setLastXpGain] = useState(0);
  const { packs: customPacks, loading: customPacksLoading } = useCustomPacks(isPremium ? player?.id : null);
  // Set by the URL-param effect below when ?auto=1 is requested AND the
  // selected pack is a custom one — startGame() is deferred until the
  // packs hook finishes loading so the pack actually resolves.
  const pendingAutoStartRef = useRef(false);
  const packId = getSafePackId(getSelectedPackId(), isPremium, customPacks);
  const activePack = getPackById(packId, customPacks);
  const packCats = () => packId === "classic" ? getCategories() : getPackCategories(packId, getCurrentLang(), customPacks);
  const [categories, setCategories] = useState<string[]>(() => applyHalloweenCategory(packCats(), lang, { enabled: !packId.startsWith("custom:") }));
  const [muted, setMuted] = useState(false);
  // Halloween accessibility preference: persists across games and sessions.
  const [reducedHalloweenEffects, setReducedHalloweenEffects] = useState(() => getHalloweenReducedEffects());
  const [halloweenScareAfterglow, setHalloweenScareAfterglow] = useState(false);
  const [stopFlash, setStopFlash] = useState(false);
  // 🕵️ Espía / Robar respuesta — free: 1 uso/partida, premium: 2 usos/partida. -10 pts cada uso.
  // `spyUsesLeft` persists across rounds (per-game allowance).
  // `spyUsesThisRound` resets each round so the -10 cost is only applied in the round it was used.
  const [spyUsesLeft, setSpyUsesLeft] = useState(1);
  const [spyUsesThisRound, setSpyUsesThisRound] = useState(0);
  const [spyReveal, setSpyReveal] = useState<{ category: string; word: string } | null>(null);
  const [spyLoading, setSpyLoading] = useState(false);

  // Combo system
  const [combo, setCombo] = useState(0);
  // Insane mode — activates after 3 consecutive wins
  const [insaneMode, setInsaneMode] = useState(false);
  const [showInsaneBanner, setShowInsaneBanner] = useState(false);
  // Clip moment — fires when player beats their personal best
  const [showImpossibleBanner, setShowImpossibleBanner] = useState(false);
  // Random event for current round
  const [randomEvent, setRandomEvent] = useState<RandomEvent>(null);
  const [halloweenScare, setHalloweenScare] = useState<HalloweenScare | null>(null);
  const halloweenScareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const halloweenScareRoundRef = useRef<number | null>(null);
  const halloweenAnswerScareTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const halloweenAnswerScareRoundRef = useRef<number | null>(null);
  // Round result announcement
  const [roundWon, setRoundWon] = useState<boolean | null>(null);

  // Daily / Quick / Chaos mode — read URL params once
  const urlParams = new URLSearchParams(window.location.search);
  const isDailyMode = urlParams.get("daily") === "true";
  const isQuickMode = urlParams.get("mode") === "quick";
  const isChaosMode = urlParams.get("mode") === "chaos";
  const isRandomMode = urlParams.get("mode") === "random";

  // Preload Halloween scare assets while the player is still in the lobby.
  // The image is bundled locally and the scream is a bundled CC0 MP3, so the
  // actual scare never waits for a network request or first-time media decode.
  useEffect(() => {
    if (!isHalloweenActive() || !isHalloweenModeEnabled() || isDailyMode) return;
    void preloadHalloweenScareAssets();
    preloadHalloweenScareAudio();
  }, [isDailyMode]);

  // First-Time User Experience: handicap the AI for the first 3 games to
  // guarantee an early win and a smoother onboarding. Read once on mount —
  // the values used in the round are captured per-game in `tutorialActive`.
  const ftue = useFTUE();
  const isTutorial = ftue.isInTutorial && !isDailyMode;
  const [showFirstWin, setShowFirstWin] = useState(false);
  const [lastWinXp, setLastWinXp] = useState(0);
  // Snapshot the tutorial flag at game start so a mid-game state change
  // (after recording the game) doesn't change the rules of the round.
  const [tutorialActive, setTutorialActive] = useState(isTutorial);
  const dailyLetter = urlParams.get("letter") || "";
  const dailyCategories = urlParams.get("cats")?.split(",").filter(Boolean) || [];

  const gameMode = isDailyMode ? "daily" : isQuickMode ? "quick" : isChaosMode ? "chaos" : isRandomMode ? "random" : "normal";
  const { best: personalBest, updateBest } = usePersonalBest(gameMode, player?.id);
  const reviewPrompt = useReviewPrompt();
  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current); }, []);
  const [bestResult, setBestResult] = useState<{ isNew: boolean; diff: number } | null>(null);
  // Highest single-round score across the current game (resets on new game).
  // Used to track the `round_score` Season Pass missions accurately, instead
  // of using the cumulative `totalScore` which would over-award them.
  const [bestRoundScore, setBestRoundScore] = useState(0);

  // 🎲 STOP Random — pick a fresh secret end time each round (15–55s). Player never sees the timer.
  const [randomRoundTime, setRandomRoundTime] = useState<number>(() => 15 + Math.floor(Math.random() * 41));
  const baseRoundTime = isRandomMode ? randomRoundTime
    : isQuickMode ? QUICK_ROUND_TIME
    : isChaosMode ? CHAOS_ROUND_TIME
    : insaneMode ? QUICK_ROUND_TIME : ROUND_TIME;
  const effectiveRoundTime = (!isQuickMode && !isDailyMode && !isChaosMode && !isRandomMode && !insaneMode && randomEvent === "speed")
    ? SPEED_ROUND_TIME : baseRoundTime;
  // Tutorial: +50% extra time per round to reduce panic for first-timers.
  const roundTime = tutorialActive ? Math.round(effectiveRoundTime * 1.5) : effectiveRoundTime;
  const maxRounds = isDailyMode ? 1 : isQuickMode ? 1 : MAX_ROUNDS;

  // AI personality. The `isTutorial` flag in the personality picker forces
  // the friendly CHIP during the FTUE; once the tutorial ends, the
  // personality is re-picked at the start of each game so a long session
  // doesn't keep CHIP forever.
  const [aiPersonality, setAiPersonality] = useState<AIPersonality>(() =>
    pickRandomPersonality({ isTutorial }),
  );
  // Track whether THIS game is the player's very first ever game so we can
  // guarantee a win on it (FTUE “victoria garantizada”). Snapshotted at
  // startGame() to avoid recordTutorialGame() flipping it mid-match.
  const [isFirstEverGame, setIsFirstEverGame] = useState(false);
  const [aiComment, setAiComment] = useState<string | null>(null);

  // Achievements system
  const { newlyUnlocked, afterRound, clearNewlyUnlocked } = useAchievements(player?.id);
  const { lastDiscovered, recordRound, clearLastDiscovered } = useCollection(player?.id);

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
  const { toast } = useToast();

  // 📡 Offline awareness — true when the last validation/peek had to fall back
  // to the cached dictionary, OR the browser is reporting it's offline.
  // Drives a small "modo sin conexión" banner.
  const [isOffline, setIsOffline] = useState<boolean>(
    typeof navigator !== "undefined" && navigator.onLine === false,
  );
  useEffect(() => {
    const goOnline = () => setIsOffline(false);
    const goOffline = () => setIsOffline(true);
    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);
    // Best-effort: ensure the offline bundle is cached for this language.
    ensureOfflineBundle();
    return () => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // 📡 Avisa al jugador la primera vez que entra en modo offline en esta
  // sesión. El banner discreto sigue ahí, pero un toast inicial explica qué
  // implica jugar sin conexión (las partidas siguen funcionando, pero la
  // puntuación se sube al ranking cuando vuelve internet). Solo una vez.
  const offlineNoticeShownRef = useRef(false);
  useEffect(() => {
    if (!isOffline) return;
    if (offlineNoticeShownRef.current) return;
    offlineNoticeShownRef.current = true;
    const title =
      lang === "en" ? "📡 You're playing offline" :
      lang === "pt" ? "📡 Estás a jogar sem ligação" :
      lang === "fr" ? "📡 Tu joues hors ligne" :
      "📡 Estás jugando sin conexión";
    const description =
      lang === "en" ? "Your games still work — your score will be uploaded to the ranking when you're back online." :
      lang === "pt" ? "As tuas partidas funcionam — a tua pontuação será enviada ao ranking quando voltares a ter internet." :
      lang === "fr" ? "Tes parties fonctionnent — ton score sera envoyé au classement quand tu auras de nouveau internet." :
      "Tus partidas funcionan, pero tu puntuación se subirá al ranking cuando vuelvas a tener internet.";
    toast({ title, description });
  }, [isOffline, lang, toast]);

  // ✅ Cuando vuelve la conexión tras un episodio offline en esta sesión,
  // mostramos un toast breve para cerrar el bucle. Solo se dispara en la
  // transición true→false, y solo si antes hubo un aviso de offline en la
  // sesión (no en el arranque normal con red, ni al cambiar de idioma).
  const prevIsOfflineRef = useRef(isOffline);
  useEffect(() => {
    const wasOffline = prevIsOfflineRef.current;
    prevIsOfflineRef.current = isOffline;
    if (!(wasOffline && !isOffline)) return;
    if (!offlineNoticeShownRef.current) return;
    const title =
      lang === "en" ? "✅ You're back online!" :
      lang === "pt" ? "✅ Voltaste a estar online!" :
      lang === "fr" ? "✅ Tu es de nouveau en ligne !" :
      "✅ ¡Vuelves a estar online!";
    toast({ title });
  }, [isOffline, lang, toast]);

  // 🛰️ Drena la "outbox" de puntuaciones aparcadas mientras el jugador
  // estaba sin conexión: una vez al montar (cubre el "próximo arranque")
  // y cada vez que el navegador anuncie que vuelve la red.
  useEffect(() => {
    let cancelled = false;
    const tryFlush = () => {
      if (typeof navigator !== "undefined" && navigator.onLine === false) return;
      flushScoreOutbox((payload) => submitScoreMutation.mutateAsync({ data: payload }))
        .then((res) => {
          if (cancelled || res.flushed <= 0) return;
          queryClient.invalidateQueries({ queryKey: ["/api/ranking/scores"] });
        if (!isDailyMode && isHalloweenActive() && isHalloweenModeEnabled()) {
          void reportHalloweenEvent(player.id, "game_completed", `solo-game-${currentLetter}-${Date.now()}`);
        }
          const n = res.flushed;
          const msg =
            lang === "en" ? `${n} pending score${n > 1 ? "s" : ""} synced!` :
            lang === "pt" ? `${n} pontuação${n > 1 ? "ões" : ""} pendente${n > 1 ? "s" : ""} sincronizada${n > 1 ? "s" : ""}!` :
            lang === "fr" ? `${n} score${n > 1 ? "s" : ""} en attente synchronisé${n > 1 ? "s" : ""} !` :
            `¡${n} puntuación${n > 1 ? "es" : ""} pendiente${n > 1 ? "s" : ""} sincronizada${n > 1 ? "s" : ""}!`;
          toast({ title: "🛰️ " + msg });
        })
        .catch(() => { /* swallowed: flush itself never throws on item failure */ });
    };
    tryFlush();
    window.addEventListener("online", tryFlush);
    return () => {
      cancelled = true;
      window.removeEventListener("online", tryFlush);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Keep refs in sync with state so handleStop never reads stale closure values
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { categoriesRef.current = categories; }, [categories]);
  useEffect(() => { bluffedCategoriesRef.current = bluffedCategories; }, [bluffedCategories]);
  useEffect(() => { currentLetterRef.current = currentLetter; }, [currentLetter]);

  // Halloween scares happen only while the player is actually answering.
  // There are two different surprise channels:
  // 1) a rare ambient scare during the round;
  // 2) a "false calm" scare shortly after the player has actually typed a word.
  // The second one is deliberately not tied to a fixed timestamp, so the
  // player cannot learn a pattern from repeated games.
  useEffect(() => {
    if (gameState !== "PLAYING" || !isHalloweenActive() || !isHalloweenModeEnabled()) {
      if (halloweenScareTimerRef.current) {
        clearTimeout(halloweenScareTimerRef.current);
        halloweenScareTimerRef.current = null;
      }
      if (halloweenAnswerScareTimerRef.current) {
        clearTimeout(halloweenAnswerScareTimerRef.current);
        halloweenAnswerScareTimerRef.current = null;
      }
      return;
    }
    if (halloweenScare || halloweenScareRoundRef.current === round) return;

    const preview = isHalloweenPreview();
    const min = preview ? 4000 : 10000;
    const max = preview ? 7500 : 50000;
    const delay = min + Math.floor(Math.random() * (max - min));

    halloweenScareTimerRef.current = setTimeout(() => {
      halloweenScareTimerRef.current = null;
      if (gameState !== "PLAYING" || halloweenScareRoundRef.current === round) return;
      halloweenScareRoundRef.current = round;
      setHalloweenScare(getHalloweenScare(lang));
    }, delay);

    return () => {
      if (halloweenScareTimerRef.current) {
        clearTimeout(halloweenScareTimerRef.current);
        halloweenScareTimerRef.current = null;
      }
    };
  }, [gameState, round, lang, halloweenScare]);

  // 🎃 "You were just typing..." surprise:
  // once per round, after the player has paused typing a real answer,
  // the game may wait a second random interval before the jumpscare.
  // The short debounce is important on mobile: typing more characters must
  // not cancel the scare that was armed for this round.
  useEffect(() => {
    if (
      gameState !== "PLAYING" ||
      !isHalloweenActive() || !isHalloweenModeEnabled() ||
      isDailyMode ||
      halloweenScare ||
      halloweenAnswerScareRoundRef.current === round
    ) return;

    const hasRealWord = Object.values(responses).some(
      value => typeof value === "string" && value.trim().length >= 3
    );
    if (!hasRealWord) return;

    if (halloweenAnswerScareTimerRef.current) {
      clearTimeout(halloweenAnswerScareTimerRef.current);
      halloweenAnswerScareTimerRef.current = null;
    }

    // Wait until the player pauses typing. Preview is intentionally easier
    // to trigger; production stays occasional.
    const pauseMs = isHalloweenPreview() ? 650 : 900;
    halloweenAnswerScareTimerRef.current = setTimeout(() => {
      halloweenAnswerScareTimerRef.current = null;

      if (halloweenScare || gameState !== "PLAYING" || halloweenAnswerScareRoundRef.current === round) {
        return;
      }

      const chance = isHalloweenPreview() ? 0.72 : 0.32;
      if (Math.random() > chance) {
        halloweenAnswerScareRoundRef.current = round;
        return;
      }

      halloweenAnswerScareRoundRef.current = round;
      const minDelay = isHalloweenPreview() ? 900 : 1600;
      const maxDelay = isHalloweenPreview() ? 2600 : 5200;
      const delay = minDelay + Math.floor(Math.random() * (maxDelay - minDelay));

      halloweenAnswerScareTimerRef.current = setTimeout(() => {
        if (gameState === "PLAYING" && halloweenScareRoundRef.current !== round) {
          halloweenScareRoundRef.current = round;
          setHalloweenScare(getHalloweenScare(lang));
        }
        halloweenAnswerScareTimerRef.current = null;
      }, delay);
    }, pauseMs);

    return () => {
      if (halloweenAnswerScareTimerRef.current) {
        clearTimeout(halloweenAnswerScareTimerRef.current);
        halloweenAnswerScareTimerRef.current = null;
      }
    };
  }, [responses, gameState, round, lang, halloweenScare, isDailyMode]);

  // Re-read categories when language changes (only if not daily mode)
  useEffect(() => {
    if (!isDailyMode) {
      setCategories(applyHalloweenCategory(packCats(), lang, { enabled: !packId.startsWith("custom:") }));
    }
  }, [lang, isDailyMode, packId, customPacksLoading]);

  // Countdown tick sound (last 5 seconds — urgency escalates)
  useEffect(() => {
    if (gameState !== "PLAYING" || muted) return;
    if (timeLeft <= 5 && timeLeft > 0) {
      sound.playTick(5 - timeLeft + 1); // urgency 1 → 5
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft, gameState]);

  // Achievement unlock sound
  useEffect(() => {
    if (newlyUnlocked) sound.playAchievement();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newlyUnlocked]);

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
    // Auto-start: open the page already in a match. Used by the home "JUGAR YA" hero.
    // If the user has a custom pack selected, defer the start until the
    // custom packs list has been fetched — otherwise getSafePackId() would
    // see customPacks=[] and silently downgrade them to "classic".
    if (params.get("auto") === "1") {
      window.history.replaceState({}, "", window.location.pathname + (params.get("mode") ? `?mode=${params.get("mode")}` : ""));
      const selectedAtBoot = getSelectedPackId();
      const needsCustomLoad = selectedAtBoot.startsWith("custom:");
      if (!needsCustomLoad) {
        setTimeout(() => startGame(), 60);
      } else {
        // The effect below watching customPacksLoading will fire startGame
        // once the hook finishes its initial fetch.
        pendingAutoStartRef.current = true;
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Companion to the auto-start effect above: when the user picked a custom
  // pack, wait for useCustomPacks to settle before kicking off the round so
  // the categories resolve correctly (otherwise getSafePackId silently
  // downgrades to "classic"). Idempotent thanks to the ref guard.
  useEffect(() => {
    if (!pendingAutoStartRef.current) return;
    if (customPacksLoading) return;
    pendingAutoStartRef.current = false;
    const id = setTimeout(() => startGame(), 60);
    return () => clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customPacksLoading]);

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
  // 🔒 Anti-cheat vouchers: each round's `/validate` call returns a signed
  // token attesting the server-computed base score. We accumulate them across
  // the game and hand them back on submit so the server can clamp a fabricated
  // total. Reset per new game (where totalScore resets to 0), not per round.
  const scoreTokensRef = useRef<string[]>([]);

  const startGame = () => {
    if (halloweenScareTimerRef.current) clearTimeout(halloweenScareTimerRef.current);
    if (halloweenAnswerScareTimerRef.current) clearTimeout(halloweenAnswerScareTimerRef.current);
    halloweenAnswerScareRoundRef.current = null;
    halloweenScareRoundRef.current = null;
    setHalloweenScare(null);
    void trackAnalyticsEvent("game_start", { metadata: { mode: isDailyMode ? "daily" : "solo" } });
    // Snapshot the tutorial state at the moment the player presses Play so
    // the rules of the round are stable until it ends.
    const tutorialNow = ftue.isInTutorial && !isDailyMode;
    setTutorialActive(tutorialNow);
    setIsFirstEverGame(tutorialNow && ftue.gamesPlayed === 0);
    // Re-pick personality each game start so CHIP doesn't stick around
    // forever once the tutorial ends.
    setAiPersonality(pickRandomPersonality({ isTutorial: tutorialNow }));
    setAiComment(null);
    // Reset spy uses each new game (premium gets 2x)
    setSpyUsesLeft(isPremium ? 2 : 1);
    setSpyReveal(null);
    // 🎲 Random mode — reroll the secret round time so each round feels different (15–55s)
    if (isRandomMode) setRandomRoundTime(15 + Math.floor(Math.random() * 41));
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
      const cats = dailyCategories.length > 0 ? dailyCategories : packCats();
      setCategories(cats);
    } else {
      const alphabet = event === "easy_letter" ? EASY_LETTERS : getAlphabet();
      const randomLetter = alphabet[Math.floor(Math.random() * alphabet.length)];
      setCurrentLetter(randomLetter);
      if (isChaosMode) {
        const crazyCats = t.crazyCategories && t.crazyCategories.length >= 6
          ? [...t.crazyCategories].sort(() => Math.random() - 0.5).slice(0, 6)
          : packCats().map(() => {
              const pool = t.crazyCategories || [];
              return pool.length > 0 ? pool[Math.floor(Math.random() * pool.length)] : packCats()[0];
            });
        setCategories(crazyCats);
      } else {
        setCategories(mixCrazyCategory(packCats(), t));
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
    if (halloweenAnswerScareTimerRef.current) {
      clearTimeout(halloweenAnswerScareTimerRef.current);
      halloweenAnswerScareTimerRef.current = null;
    }
    halloweenAnswerScareRoundRef.current = null;
    resultsAppliedRef.current = false;
    // Clear previous round's payload so the RESULTS effect can never
    // accidentally re-apply stale scores from the prior round.
    setRoundResults(null);

    // Set up AI bluff for this round (random category, 50% chance it's actually bluffing)
    const aiBluffCat = categories[Math.floor(Math.random() * categories.length)];
    setAiBluffSetup({ category: aiBluffCat, wasActuallyBluffing: Math.random() < 0.5 });

    setGameState("PLAYING");
    setTimeLeft(roundTime);
    setRewardedUsed(false);
    setHintUsed(false);
    setHintReveal(null);
    setSpyUsesThisRound(0);
    sound.playRoundStart();
    if (randomEvent === "hidden_category") setTimeout(() => sound.playHiddenReveal(), 400);

    timerRef.current = setInterval(() => {
      if (gameTimerPausedRef.current || isGameTimerPaused()) return;
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

  // Rewarded ads can run in a native Android activity while the WebView keeps
  // executing JavaScript. Keep a page-owned pause ref as a second guard so the
  // countdown cannot continue even if the shared module is duplicated by the
  // bundler or the ad component lives in another chunk.
  useEffect(() => {
    const pause = () => { gameTimerPausedRef.current = true; };
    const resume = () => { gameTimerPausedRef.current = false; };
    window.addEventListener("stop:rewarded-ad-pause", pause);
    window.addEventListener("stop:rewarded-ad-resume", resume);
    return () => {
      window.removeEventListener("stop:rewarded-ad-pause", pause);
      window.removeEventListener("stop:rewarded-ad-resume", resume);
    };
  }, []);

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
    // Big juicy haptic: 3 pulses with quick gaps — feels like an alarm
    vibrate([180, 60, 120, 60, 200]);
    setStopFlash(true);
    setTimeout(() => setStopFlash(false), 700);
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

    let apiData: ValidateRoundResponse | null = null;
    try {
      // ⏱️ Timeout duro de 25s: si la IA del backend se cuelga con
      // respuestas inválidas / palabras inventadas, NO dejamos al usuario
      // atascado en "EL JUICIO". Disparamos el fallback offline / RESULTS.
      const TIMEOUT_MS = 25000;
      apiData = await Promise.race([
        validateMutation.mutateAsync({
          data: {
            letter,
            language: getCurrentLang() as import("@workspace/api-client-react").ValidateRoundRequestLanguage,
            playerName: player?.name,
            playerResponses: formattedResponses,
          }
        }),
        new Promise<ValidateRoundResponse>((_, reject) =>
          setTimeout(() => reject(new Error("validate-timeout")), TIMEOUT_MS)
        ),
      ]);
    } catch {
      // 📡 Sin conexión O timeout del servidor: validamos localmente con el
      // diccionario cacheado. Si nunca se descargó el bundle, apiData seguirá
      // null y caemos al fallback de cero puntos más abajo.
      const local = validateRoundOffline({
        letter,
        language: getCurrentLang(),
        playerResponses: formattedResponses,
      });
      if (local) {
        apiData = local;
        setIsOffline(true);
      }
    }

    // 🛟 Último recurso: si TODO falló (sin red + sin diccionario cacheado),
    // construimos una respuesta vacía válida para que la partida pueda
    // avanzar a RESULTS en vez de quedarse colgada en "EL JUICIO".
    if (!apiData) {
      const emptyResults: Record<string, { player: { response: string; score: number; valid: boolean }; ai: { response: string; score: number } }> = {};
      for (const { category, word } of formattedResponses) {
        emptyResults[category] = {
          player: { response: word, score: 0, valid: false },
          ai: { response: "", score: 0 },
        };
      }
      apiData = {
        playerTotalScore: 0,
        aiTotalScore: 0,
        results: emptyResults,
      } as unknown as ValidateRoundResponse;
    }
    // 🔒 Capture this round's anti-cheat voucher (online play only — the
    // offline fallback payload has none). Accumulated for the final submit.
    if (apiData?.scoreToken) scoreTokensRef.current.push(apiData.scoreToken);

    // Persist whichever payload we ended up with so the RESULTS effect
    // and the UI read the *current* round's data, not the prior mutation.
    setRoundResults(apiData);

    // 🎓 Tutorial: make the AI ACTUALLY easier (not just lower-scored).
    // Drop ~50% of the AI's correct answers so the player visibly wins more
    // categories. This mutates the validation payload in place so every
    // downstream calculation (scoring, sabotage, steal, oracle, bluff) uses
    // the same, weakened AI — no risk of UI showing a strong AI while
    // score appears small.
    if (tutorialActive && apiData) {
      const data = apiData as {
        results?: Record<string, { ai?: { response?: string; score?: number } }>;
        aiTotalScore?: number;
      };
      let removed = 0;
      Object.keys(data.results ?? {}).forEach((cat) => {
        const ai = data.results?.[cat]?.ai;
        if (!ai || (ai.score ?? 0) <= 0) return;
        if (Math.random() < 0.5) {
          removed += ai.score ?? 0;
          ai.response = "";
          ai.score = 0;
        }
      });
      if (typeof data.aiTotalScore === "number") {
        data.aiTotalScore = Math.max(0, data.aiTotalScore - removed);
      }
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

    // Set up AI bluff reveal data (using API response).
    //
    // Rules (per product decision):
    //   1. AI answer is valid (score > 0)  → honest. Correct judgement: "real".
    //   2. AI answer exists but invalid     → uses the random
    //      wasActuallyBluffing flag from setup (50/50).
    //   3. AI gave NO answer at all (empty) → mentira automática.
    //      The card shows "—" and "mentira" is always the correct call.
    if (aiBluffSetup && apiData) {
      const catResult = (apiData as { results?: Record<string, { ai?: { response?: string; score?: number } }> }).results?.[aiBluffSetup.category];
      const aiAnswer = (catResult?.ai?.response ?? "").trim();
      const aiGotPoints = (catResult?.ai?.score ?? 0) > 0;

      let wasActuallyBluffing: boolean;
      if (!aiAnswer) {
        // No answer = the AI is hiding the truth → always a lie.
        wasActuallyBluffing = true;
      } else if (aiGotPoints) {
        // Valid word with points → never a bluff.
        wasActuallyBluffing = false;
      } else {
        // Invalid word → honour the 50/50 setup intent.
        wasActuallyBluffing = aiBluffSetup.wasActuallyBluffing;
      }

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

  // Single source of truth for the current round's results. Fed by either the
  // server response OR the offline local validator (handleStop). Decoupling
  // from `validateMutation.data` is critical for the offline flow: when the
  // network call throws, mutation.data stays stale (or undefined) and the
  // RESULTS effect would never fire / would reuse the prior round's payload.
  const [roundResults, setRoundResults] = useState<ValidateRoundResponse | null>(null);
  const results = roundResults;

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
      // AI score now reflects the (already-weakened in tutorial) results
      // payload — see the tutorial handicap block in handleStop().
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
        const entry = Object.entries(results.results ?? {})
          .filter(([, r]) => ((r as CategoryResult).player?.score ?? 0) === 0 && ((r as CategoryResult).ai?.score ?? 0) > 0)
          .sort(([, a], [, b]) => ((b as CategoryResult).ai?.score ?? 0) - ((a as CategoryResult).ai?.score ?? 0))[0];
        if (entry) {
          stolenScore = (entry[1] as CategoryResult).ai?.score ?? 0;
          setSpecialReveal({ type: "steal", category: entry[0], word: (entry[1] as CategoryResult).ai?.response ?? "" });
        }
      }

      // ORACLE: reveal one AI answer the player missed
      if (activeCard === "oracle") {
        const entry = Object.entries(results.results ?? {})
          .find(([, r]) => ((r as CategoryResult).player?.score ?? 0) === 0 && ((r as CategoryResult).ai?.score ?? 0) > 0);
        if (entry) {
          setSpecialReveal({ type: "oracle", category: entry[0], word: (entry[1] as CategoryResult).ai?.response ?? "" });
        }
      }

      const won = (ps + stolenScore + sabotageStolen) > as_;

      // 🕵️ Espía costs -10 puntos per use, ONLY for uses in THIS round
      // (spyUsesThisRound resets in startRound; spyUsesLeft is the per-game pool).
      const spyCost = spyUsesThisRound * 10;
      const roundDelta = ps + stolenScore + sabotageStolen + bluffBonusScore - spyCost;
      let finalPlayerScore = totalScore + roundDelta;

      // 🎓 FTUE “victoria garantizada”: on the player's very first ever
      // game, if after the FINAL round they would still be losing, add
      // exactly enough bonus points so they win by 1. Applied only on the
      // last round so the win condition is decided by the actual final
      // score, not a per-round adjustment.
      let ftueGuaranteedBonus = 0;
      if (isFirstEverGame && round >= maxRounds) {
        const projectedAi = aiTotalScore + as_;
        if (finalPlayerScore <= projectedAi) {
          ftueGuaranteedBonus = projectedAi - finalPlayerScore + 1;
          finalPlayerScore += ftueGuaranteedBonus;
        }
      }

      setTotalScore(finalPlayerScore);
      setAiTotalScore(prev => prev + as_);
      // Recompute roundWon after the FTUE bonus so the per-round won/lost
      // banner agrees with the final game-end result.
      const wonAfterBonus =
        round >= maxRounds && ftueGuaranteedBonus > 0 ? true : won;
      setRoundWon(wonAfterBonus);
      // Track best single-round score for the Season Pass `round_score` missions.
      const roundScoreClamped = Math.max(0, roundDelta);
      const newBestRound = Math.max(bestRoundScore, roundScoreClamped);
      if (roundScoreClamped > bestRoundScore) setBestRoundScore(newBestRound);
      vibrate(won ? [40, 20, 80] : [120]);

      if (round >= maxRounds) {
        const br = updateBest(finalPlayerScore);
        setBestResult(br);
        if (br.isNew) {
          setTimeout(() => {
            vibrate([60, 40, 60, 40, 200]);
            sound.playLevelUp();
            setShowImpossibleBanner(true);
            confetti({ particleCount: 300, spread: 140, origin: { y: 0.5 }, colors: ["#f9a825", "#b5301a", "#ffffff", "#4ade80"] });
            setTimeout(() => setShowImpossibleBanner(false), 3200);
          }, 500);
        }
        // 🎓 FTUE — record tutorial game and trigger first-win celebration.
        // We snapshot the values at game-end so subsequent state changes don't
        // affect the displayed reward.
        const wasTutorialGame = tutorialActive;
        const finalAiForGame = aiTotalScore + as_;
        const wonGame = finalPlayerScore > finalAiForGame;
        // Celebrate the player's first-ever match win regardless of whether
        // it happened during the tutorial — it's the moment that matters.
        const showFirstWinNow = wonGame && !ftue.firstWinCelebrated;
        if (wasTutorialGame) {
          ftue.recordTutorialGame();
        }
        if (showFirstWinNow) {
          // Use the same XP formula nextRound() uses so the number stays
          // consistent with what's awarded a moment later.
          const validCount = Object.values(results.results ?? {}).filter(
            (r) => ((r as CategoryResult).player?.score ?? 0) > 0,
          ).length;
          const xpEstimate = calcXpFromResults(validCount, finalPlayerScore, finalAiForGame);
          setLastWinXp(xpEstimate);
          setTimeout(() => setShowFirstWin(true), 1100);
          ftue.markFirstWinCelebrated();
        }
        if (!isDailyMode) {
          // Push the share modal back further when the first-win celebration
          // is showing so the two don't fight for the player's attention.
          const shareDelay = showFirstWinNow ? 6500 : (br.isNew ? 4200 : 3500);
          setTimeout(() => setShowShareModal(true), shareDelay);
        }

        // Record this finished game for the review-prompt eligibility counter,
        // then try to show the prompt at a happy moment. Delayed so it doesn't
        // collide with first-win, share, or new-record celebrations.
        recordGamePlayed();
        // Compute percentile against the player's last 50 solo scores so
        // the "top 20%" happy-moment trigger is real, not a fixed proxy.
        const percentile = recordScoreAndPercentile(finalPlayerScore);
        const reviewDelay = showFirstWinNow ? 9000 : (br.isNew ? 7500 : 5500);
        if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current);
        reviewTimerRef.current = setTimeout(() => {
          reviewPrompt.maybeShow({
            won: wonGame,
            newPersonalBest: br.isNew,
            streakDays: soloStreak.current,
            scorePercentile: percentile,
          });
        }, reviewDelay);

        // 💾 Submit final score INLINE with the freshly-computed value.
        // We can't rely on the auto-submit useEffect reading `totalScore` from
        // state because `setTotalScore(finalPlayerScore)` above is async and
        // the auto-submit effect would fire in the same render cycle with
        // the OLD totalScore (off by the last round's points → 0pts daily bug).
        if (!submittedRef.current) {
          submittedRef.current = true;
          const finalAi = aiTotalScore + as_;
          submitToLeaderboard(finalPlayerScore, finalAi);
          if (isDailyMode) submitDailyResult(finalPlayerScore);
          // ── Season Pass mission tracking ──────────────────────────────
          // Must fire here (not just in the auto-submit effect below) — the
          // auto-submit effect early-returns once submittedRef is set, which
          // happens RIGHT ABOVE on the same render cycle. So if we relied on
          // the effect, missions would silently never advance from gameplay.
          // The effect path remains as a fallback for any reload/edge case
          // and is itself idempotent via `seasonEventsReportedRef`.
          // We pass `newBestRound` explicitly because `setBestRoundScore`
          // above is async — reading state would yield the previous value
          // and under-report when the best round IS the final round.
          reportGameEndSeasonEvents(finalPlayerScore, finalAi, results, newBestRound);
        }
      }

      // AI personality comment
      const comment = getAIComment(aiPersonality, won, ps, as_);
      setTimeout(() => setAiComment(comment), 1200);

      // Count valid words for achievements
      const validWordCount = Object.values(results.results ?? {}).filter(
        r => ((r as CategoryResult).player?.score ?? 0) > 0
      ).length;

      // 📚 Word Collection: every word that scored points is "valid enough"
      // to enter the player's collection. Rarity is computed locally.
      const collectedThisRound: Array<{ word: string; category: string }> = [];
      for (const [category, r] of Object.entries(results.results ?? {})) {
        const player = (r as CategoryResult).player;
        if (player && (player.score ?? 0) > 0 && player.response) {
          collectedThisRound.push({ word: player.response, category });
        }
      }
      if (collectedThisRound.length) recordRound(collectedThisRound);

      // Track achievement progress
      const isCustomPackActive = packId !== "classic" && customPacks.some(p => String(p.id) === packId);
      afterRound({
        won,
        validWords: validWordCount,
        combo: combo + (won ? 1 : 0),
        wasSpeedRound: randomEvent === "speed",
        wasChaosRound: isChaosMode,
        xpGained: 0, // will be counted in nextRound
        aiZeroWin: won && as_ === 0,
        usedCustomPack: isCustomPackActive,
      });

      if (wonAfterBonus) {
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

  const submitToLeaderboard = (finalScore: number, finalAiScore: number, opts?: { bonus?: boolean }) => {
    if (!player || player.loginMethod === "guest") return;
    if (finalScore <= 0) return;
    const won = finalScore > finalAiScore;
    const isBonus = opts?.bonus === true;
    submitScoreMutation.mutate({
      data: {
        playerId: player.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        score: finalScore,
        letter: currentLetter || "?",
        mode: isDailyMode ? "daily" : "solo",
        won,
        bonus: isBonus,
        scoreTokens: scoreTokensRef.current,
      }
    }, {
      onSuccess: (response: any) => {
        queryClient.invalidateQueries({ queryKey: ["/api/ranking/scores"] });
        // The server updates the streak on score submit; refresh the calendar
        // query so Home / Daily show the new authoritative streak right away.
        queryClient.invalidateQueries({ queryKey: ["/api/ranking/streak/calendar"] });
        const msg = isBonus
          ? (lang === "en" ? `+${finalScore} bonus pts added!` :
             lang === "pt" ? `+${finalScore} pts bónus adicionados!` :
             lang === "fr" ? `+${finalScore} pts bonus ajoutés !` :
             `¡+${finalScore} pts bonus añadidos!`)
          : (lang === "en" ? `+${finalScore} pts saved to ranking!` :
             lang === "pt" ? `+${finalScore} pts guardados no ranking!` :
             lang === "fr" ? `+${finalScore} pts enregistrés au classement !` :
             `¡+${finalScore} pts guardados en el ranking!`);
        toast({ title: "🏆 " + msg });

        // ⚡ Happy Hour bonus toast — server validated the bonus and tells us
        // exactly what was awarded. Show a second prominent toast so the
        // player actually feels the x2 reward (otherwise XP/coin growth is
        // invisible until they look at their profile).
        const rewards = response?.rewards;
        if (rewards?.happyHourActive && (rewards.coinsAwarded > 0 || rewards.xpAwarded > 0)) {
          const hhMsg =
            lang === "en" ? `⚡ HAPPY HOUR x${rewards.multiplier}! +${rewards.coinsAwarded} coins, +${rewards.xpAwarded} XP` :
            lang === "pt" ? `⚡ HAPPY HOUR x${rewards.multiplier}! +${rewards.coinsAwarded} moedas, +${rewards.xpAwarded} XP` :
            lang === "fr" ? `⚡ HAPPY HOUR x${rewards.multiplier} ! +${rewards.coinsAwarded} pièces, +${rewards.xpAwarded} XP` :
            `⚡ ¡HAPPY HOUR x${rewards.multiplier}! +${rewards.coinsAwarded} monedas, +${rewards.xpAwarded} XP`;
          setTimeout(() => toast({ title: hhMsg }), 1200);
        }
      },
      onError: () => {
        // 📡 Sin conexión: aparcamos la puntuación en la outbox para
        // reenviarla cuando vuelva la red (evento `online` o próximo
        // arranque). Sólo lo hacemos cuando el navegador reporta offline,
        // para evitar duplicar puntuaciones cuando es un error de servidor
        // que en realidad sí pudo persistir.
        if (typeof navigator !== "undefined" && navigator.onLine === false) {
          enqueueScoreOutbox({
            playerId: player.id,
            playerName: player.name,
            avatarColor: player.avatarColor,
            score: finalScore,
            letter: currentLetter || "?",
            mode: isDailyMode ? "daily" : "solo",
            won,
            bonus: isBonus,
            scoreTokens: scoreTokensRef.current,
          });
          const offMsg =
            lang === "en" ? "Offline — score will sync when you're back." :
            lang === "pt" ? "Offline — a pontuação irá sincronizar quando voltares." :
            lang === "fr" ? "Hors-ligne — le score sera envoyé au retour." :
            "Sin conexión: tu puntuación se enviará al volver internet.";
          toast({ title: "📡 " + offMsg });
          return;
        }
        const msg =
          lang === "en" ? "Could not save score. Check your connection." :
          lang === "pt" ? "Não foi possível guardar a pontuação." :
          lang === "fr" ? "Impossible d'enregistrer le score." :
          "No se pudo guardar el puntaje. Verifica tu conexión.";
        toast({ title: "⚠️ " + msg, variant: "destructive" });
      }
    });
  };

  // 💾 Auto-submit final score the moment the RESULTS screen first shows the
  // final round. Previously the submit only happened inside `nextRound()` (the
  // "Play again" button), so users who closed the page or went home without
  // clicking "Jugar de nuevo" lost their score entirely. Guarded by a ref so
  // the submission fires exactly once per game.
  const submittedRef = useRef(false);

  // Single-fire guard for Season Pass mission events. Independent of
  // submittedRef because the inline final-round block sets submittedRef
  // before this effect can read it — see the call at line ~580.
  const seasonEventsReportedRef = useRef(false);

  /**
   * Reports all end-of-game Season Pass events exactly once per game.
   * Safe to call from multiple submit paths (inline final-round block AND
   * the fallback auto-submit effect). Guests are silently no-op'd.
   */
  const reportGameEndSeasonEvents = (
    finalScore: number,
    finalAi: number,
    finalResults: typeof results,
    bestRoundOverride?: number,
  ) => {
    if (seasonEventsReportedRef.current) return;
    if (!player || player.loginMethod === "guest") return;
    seasonEventsReportedRef.current = true;
    const won = finalScore > finalAi;
    // Caller may pass a freshly-computed best-round value (the inline
    // final-round path does this) so we don't read stale React state.
    const bestRound = bestRoundOverride !== undefined ? bestRoundOverride : bestRoundScore;
    reportSeasonEvent(player.id, "play_game", 1);
    if (won) reportSeasonEvent(player.id, "win_game", 1);
    if (isDailyMode) reportSeasonEvent(player.id, "daily_done", 1);
    if (bestRound > 0) reportSeasonEvent(player.id, "round_score", bestRound);
    const validCount = finalResults
      ? Object.values(finalResults.results ?? {}).filter(
          (r) => ((r as CategoryResult).player?.score ?? 0) > 0
        ).length
      : 0;
    if (validCount > 0) reportSeasonEvent(player.id, "valid_words", validCount);
    if (soloStreak.current > 0) reportSeasonEvent(player.id, "streak", soloStreak.current);
  };

  useEffect(() => {
    if (gameState !== "RESULTS" || round < maxRounds || submittedRef.current) return;
    submittedRef.current = true;
    if (!player || player.loginMethod === "guest") trackGuestGame();
    submitToLeaderboard(totalScore, aiTotalScore);
    if (isDailyMode) submitDailyResult(totalScore);
    // Fallback path — the inline block already reports events on the normal
    // happy path; this catches any case where the inline path didn't run.
    reportGameEndSeasonEvents(totalScore, aiTotalScore, results);
  }, [gameState, round, maxRounds, totalScore, aiTotalScore, isDailyMode]); // eslint-disable-line react-hooks/exhaustive-deps

  const submitDailyResult = (finalScore: number) => {
    // Always save daily score locally (works for guests too)
    localStorage.setItem(`stop_daily_${getTodayStr()}`, String(finalScore));

    // Save to server if logged in
    if (!player || player.loginMethod === "guest") return;
    fetch(`${getApiUrl()}/api/daily/submit`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      credentials: "include",
      body: JSON.stringify({
        playerId: player.id,
        playerName: player.name,
        avatarColor: player.avatarColor,
        score: finalScore,
        letter: dailyLetter || currentLetter,
        language: getCurrentLang(),
        scoreTokens: scoreTokensRef.current,
      }),
    }).catch(() => {});
  };

  const nextRound = async () => {
    if (round >= maxRounds) {
      void trackAnalyticsEvent("game_complete", { metadata: { mode: isDailyMode ? "daily" : "solo", rounds: maxRounds } });
      recordPlay();
      // Calculate XP with multipliers
      const validCount = results
        ? Object.values(results.results ?? {}).filter(r => ((r as CategoryResult).player?.score ?? 0) > 0).length
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
      // Score submission has already happened automatically when the
      // RESULTS screen first showed the final round (see submittedRef
      // effect above). Don't re-submit here or we'd double-count.
      if (isDailyMode) {
        setLocation("/reto");
        return;
      }
      submittedRef.current = false;
      if (!isDailyMode) recordInterstitialGameCompleted();

      // Never block the replay transition on an ad. The player must always
      // return to the lobby even if the native TWA bridge/ad fails or times out.
      setGameState("LOBBY");
      setRound(1);
      setTotalScore(0);
      scoreTokensRef.current = [];
      setAiTotalScore(0);
      setBestRoundScore(0);
      setDoubleUsed(false);
      setCombo(0);
      setInsaneMode(false);
      setShowImpossibleBanner(false);
      setRandomEvent(null);
      setRoundWon(null);
      setBestResult(null);

      // Launch the interstitial after the game has already transitioned.
      // Fire-and-forget: an ad can never make "Volver a jugar" unresponsive.
      void maybeShowInterstitial(isPremium || premiumLoading);
    } else {
      setRound(r => r + 1);
      startGame();
    }
  };

  // Tiny inline starter pool — gives the player a 3-letter prefix to build on.
  // Not exhaustive: when no match, falls back to "<letter>" alone as a nudge.
  const HINT_STARTERS: Record<string, string[]> = {
    A: ["ALA", "ARE", "ABA", "ACA"], B: ["BAR", "BEL", "BOL"], C: ["CAR", "CAS", "COR"],
    D: ["DAN", "DOR"], E: ["ELE", "EST"], F: ["FIL", "FOR"], G: ["GAL", "GAR"],
    H: ["HAR", "HEL"], I: ["INE", "ITA"], J: ["JAR", "JUL"], L: ["LAR", "LEO"],
    M: ["MAR", "MEL"], N: ["NAR", "NEL"], O: ["OLI", "ORE"], P: ["PAL", "PAR"],
    R: ["RAM", "RIO"], S: ["SAL", "SAN"], T: ["TAR", "TOR"], V: ["VAL", "VER"],
  };

  /** Pick a real valid word from the cached dictionary for the current letter/category. */
  /** Pick a real valid word for the exact round letter/category. */
  const getHintWord = async (letter: string, category: string): Promise<string> => {
    const normalizedLetter = letter.trim().toUpperCase();
    if (!normalizedLetter) return "";
    let bundle = getCachedOfflineBundle();
    if (!bundle) bundle = await ensureOfflineBundle();
    if (!bundle) return "";

    const normalize = (value: string) => value.toLowerCase().trim()
      .replace(/ñ/g, "~")
      .normalize("NFD")
      .replace(/[\\u0300-\\u036f]/g, "")
      .replace(/~/g, "ñ");
    const expectedLetter = normalize(normalizedLetter);
    const langDict = bundle.dictionary[getCurrentLang()] || bundle.dictionary.es || {};
    const requestedCategory = normalize(category);
    const findWords = (dict: Record<string, string[]>, categoryName: string): string[] => {
      const exact = Object.entries(dict).find(([key]) => normalize(key) === categoryName);
      if (exact) return exact[1];
      const fuzzy = Object.entries(dict).filter(([key]) => {
        const k = normalize(key);
        return categoryName.startsWith(k) || k.startsWith(categoryName);
      }).sort((a, b) => normalize(b[0]).length - normalize(a[0]).length)[0];
      return fuzzy?.[1] || [];
    };
    const pick = (dict: Record<string, string[]>) => findWords(dict, requestedCategory)
      .filter(Boolean)
      .map(word => word.trim())
      .filter(word => word.length >= 2)
      // Strict compatibility: the hint MUST start with the round letter.
      .filter(word => normalize(word).startsWith(expectedLetter));

    const valid = pick(langDict);
    if (valid.length > 0) return valid[Math.floor(Math.random() * valid.length)];
    if (bundle.dictionary.es && langDict !== bundle.dictionary.es) {
      const esWords = pick(bundle.dictionary.es);
      if (esWords.length > 0) return esWords[Math.floor(Math.random() * esWords.length)];
    }
    return "";
  };

  const handleRewardedComplete = async (reward: number) => {
    // The rewarded component keeps the game paused while the native ad is
    // actually on screen. Only resume after the reward result is confirmed.
    resumeGameTimer();
    window.dispatchEvent(new Event("stop:rewarded-ad-resume"));
    if (rewardedAdType === "extraTime") {
      setTimeLeft(prev => prev + reward);
      setRewardedUsed(true);
    } else if (rewardedAdType === "hint") {
      const empty = categories.find(c => !(responses[c] && responses[c].trim().length > 0));
      if (empty) {
        // Capture the letter NOW so an async bundle load can never use a stale
        // letter from a later render/round.
        const hintLetter = currentLetter.trim().toUpperCase();
        const word = await getHintWord(hintLetter, empty);
        // Final safety check: never inject a hint whose first letter does not
        // match the letter of the round in which the reward was earned.
        const normalizedWord = word.trim().toLowerCase()
          .replace(/ñ/g, "~")
          .normalize("NFD")
          .replace(/[\\u0300-\\u036f]/g, "")
          .replace(/~/g, "ñ");
        const normalizedHintLetter = hintLetter.toLowerCase()
          .replace(/ñ/g, "~")
          .normalize("NFD")
          .replace(/[\\u0300-\\u036f]/g, "")
          .replace(/~/g, "ñ");
        if (word && normalizedWord.startsWith(normalizedHintLetter)) {
          setResponses(prev => ({ ...prev, [empty]: word }));
          setHintReveal({ category: empty, word });
          setTimeout(() => setHintReveal(null), 3500);
          setHintUsed(true);
        } else {
          toast({ title: lang === "en" ? "No valid hint available for this letter" : lang === "pt" ? "Não há pista válida disponível para esta letra" : lang === "fr" ? "Aucun indice valide disponible pour cette lettre" : "No hay una pista válida disponible para esta letra" });
        }
      }
    } else if (rewardedAdType === "double") {
      // Capture the current score once. The bonus is a second leaderboard write;
      // the server must not consume the round vouchers a second time.
      const bonus = Math.max(0, totalScore);
      if (bonus > 0) {
        submitToLeaderboard(bonus, aiTotalScore, { bonus: true });
        setTotalScore(prev => prev + bonus);
        setDoubleUsed(true);
      }
    }
    setRewardedAdType(null);
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
      <HalloweenAmbience active={isHalloweenActive() && isHalloweenModeEnabled() && !isDailyMode && gameState === "PLAYING"} muted={muted} heavy={halloweenScareAfterglow || !!halloweenScare} />
      {/* 📡 Discreet offline banner — shown while playing without internet using cached dictionary */}
      <AnimatePresence>
        {isOffline && (
          <motion.div
            key="offline-banner"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            className="fixed top-2 left-1/2 -translate-x-1/2 z-50 pointer-events-none"
          >
            <div
              className="flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-bold"
              style={{
                background: "rgba(15,23,42,0.85)",
                color: "rgba(253,224,71,0.95)",
                border: "1px solid rgba(253,224,71,0.4)",
                backdropFilter: "blur(8px)",
              }}
            >
              <span>📡</span>
              <span>Modo sin conexión</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 💥 Fullscreen STOP flash — fires the instant time runs out / STOP is hit */}
      <AnimatePresence>
        {stopFlash && (
          <motion.div
            key="stopflash"
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.2 }}
            transition={{ duration: 0.18 }}
            className="fixed inset-0 z-[9999] flex items-center justify-center pointer-events-none"
            style={{
              background: "radial-gradient(circle, rgba(220,38,38,0.85) 0%, rgba(127,29,29,0.95) 100%)",
            }}
          >
            <motion.div
              initial={{ scale: 0.4, rotate: -8 }}
              animate={{ scale: [0.4, 1.25, 1], rotate: [-8, 4, 0] }}
              transition={{ duration: 0.55, times: [0, 0.55, 1] }}
              className="font-black tracking-wider"
              style={{
                fontFamily: "'Baloo 2', sans-serif",
                fontSize: "clamp(120px, 28vw, 280px)",
                color: "#fff",
                textShadow: "0 8px 30px rgba(0,0,0,0.5), 0 0 80px rgba(255,255,255,0.4)",
                lineHeight: 1,
              }}
            >
              STOP!
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">

        {rewardedAdType && (
          <RewardedAd
            rewardType={rewardedAdType === "double" ? "points" : rewardedAdType}
            rewardAmount={
              rewardedAdType === "extraTime" ? 30 :
              rewardedAdType === "double" ? totalScore : 0
            }
            onComplete={handleRewardedComplete}
            onSkip={() => {
              resumeGameTimer();
              window.dispatchEvent(new Event("stop:rewarded-ad-resume"));
              setRewardedAdType(null);
            }}
            playerId={player?.id}
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