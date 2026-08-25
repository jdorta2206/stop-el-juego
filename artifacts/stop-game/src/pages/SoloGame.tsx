import { useState, useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import confetti from "canvas-confetti";
import { Layout } from "@/components/Layout";
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
import { ContextualPremiumPrompt } from "@/components/ContextualPremiumPrompt";
import { PremiumModal } from "@/components/PremiumModal";
import { ShareResultsModal } from "@/components/ShareResultsModal";
import { ClipGenerator } from "@/components/ClipGenerator";
import { recordExternalStat } from "@/hooks/useAchievements";
import { usePremium } from "@/lib/usePremium";
import { Tv2, Crown, Volume2, VolumeX, Zap, Star, Flame, Trophy } from "lucide-react";
import { useT } from "@/i18n/useT";
import { useTicker } from "@/hooks/useTicker";
import { useStreak } from "@/hooks/useStreak";
import { useProgression, calcXpFromResults } from "@/hooks/useProgression";
import { reportSeasonEvent } from "@/hooks/useSeason";
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
import { ReviewPromptCard } from "@/components/ReviewPromptCard";

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
  if (Math.random() > 0.3) return null;
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
  const { streak: soloStreak, recordPlay } = useStreak();
  const { t, lang } = useT();
  const { addXp, levelUpInfo, clearLevelUp } = useProgression(player?.id);
  const [, setLocation] = useLocation();
  const [gameState, setGameState] = useState<GameState>("LOBBY");
  const [currentLetter, setCurrentLetter] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [aiTotalScore, setAiTotalScore] = useState(0);
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
  const pendingAutoStartRef = useRef(false);
  const packId = getSafePackId(getSelectedPackId(), isPremium, customPacks);
  const activePack = getPackById(packId, customPacks);
  const packCats = () => packId === "classic" ? getCategories() : getPackCategories(packId, getCurrentLang(), customPacks);
  const [categories, setCategories] = useState<string[]>(packCats());
  const [muted, setMuted] = useState(false);
  const [stopFlash, setStopFlash] = useState(false);
  const [spyUsesLeft, setSpyUsesLeft] = useState(1);
  const [spyUsesThisRound, setSpyUsesThisRound] = useState(0);
  const [oracleUsed, setOracleUsed] = useState(false);
  const [oracleReveal, setOracleReveal] = useState<SpecialReveal>(null);
  const [bluffSetup, setBluffSetup] = useState<AiBluffSetup | null>(null);
  const [bluffReveal, setBluffReveal] = useState<AiBluffReveal | null>(null);
  const [aiPersonality, setAiPersonality] = useState<AIPersonality>(() => pickRandomPersonality());
  const [aiDifficulty, setAiDifficulty] = useState<"easy" | "expert">(() => {
    const stored = localStorage.getItem("stop-ai-difficulty");
    return stored === "expert" ? "expert" : "easy";
  });

  useEffect(() => {
    localStorage.setItem("stop-ai-difficulty", aiDifficulty);
  }, [aiDifficulty]);

  const aiDifficultyRef = useRef<"easy" | "expert">(aiDifficulty);
  useEffect(() => {
    aiDifficultyRef.current = aiDifficulty;
  }, [aiDifficulty]);

  // The complete original SoloGame component must continue below this point.
}
