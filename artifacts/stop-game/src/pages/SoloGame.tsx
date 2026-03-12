import { useState, useEffect, useRef } from "react";
import { Link } from "wouter";
import confetti from "canvas-confetti";
import { Layout } from "@/components/Layout";
import { Button, Card, Input, Progress } from "@/components/ui";
import { Roulette } from "@/components/Roulette";
import { CATEGORIES_ES, ALPHABET_ES } from "@/lib/utils";
import { useValidateRound, useSubmitScore } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { motion, AnimatePresence } from "framer-motion";
import { InterstitialAd, RewardedAd, BannerAd } from "@/components/AdSystem";
import { Tv2 } from "lucide-react";

type GameState = "LOBBY" | "SPINNING" | "PLAYING" | "EVALUATING" | "RESULTS" | "AD_BETWEEN_ROUNDS";

const ROUND_TIME = 60;

export default function SoloGame() {
  const { player } = usePlayer();
  const [gameState, setGameState] = useState<GameState>("LOBBY");
  const [currentLetter, setCurrentLetter] = useState<string>("");
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [round, setRound] = useState(1);
  const [totalScore, setTotalScore] = useState(0);
  const [aiTotalScore, setAiTotalScore] = useState(0);
  const [showRewardedAd, setShowRewardedAd] = useState(false);
  const [rewardedUsed, setRewardedUsed] = useState(false);

  const validateMutation = useValidateRound();
  const submitScoreMutation = useSubmitScore();
  const timerRef = useRef<NodeJS.Timeout>(null);

  const startGame = () => {
    const randomLetter = ALPHABET_ES[Math.floor(Math.random() * ALPHABET_ES.length)];
    setCurrentLetter(randomLetter);
    setResponses({});
    setGameState("SPINNING");
  };

  const startRound = () => {
    setGameState("PLAYING");
    setTimeLeft(ROUND_TIME);
    setRewardedUsed(false);

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
    setGameState("EVALUATING");

    const formattedResponses = CATEGORIES_ES.map(cat => ({
      category: cat,
      word: responses[cat] || ""
    }));

    try {
      await validateMutation.mutateAsync({
        data: {
          letter: currentLetter,
          language: "es",
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
      setTotalScore(prev => prev + (results.playerTotalScore || 0));
      setAiTotalScore(prev => prev + (results.aiTotalScore || 0));

      if ((results.playerTotalScore || 0) > (results.aiTotalScore || 0)) {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      }
    }
  }, [gameState, results]);

  const nextRound = () => {
    if (round >= 3) {
      // Game over — submit score and go back to lobby
      if (player) {
        submitScoreMutation.mutate({
          data: {
            playerId: player.id,
            playerName: player.name,
            avatarColor: player.avatarColor,
            score: totalScore,
            letter: currentLetter,
            mode: "solo",
            won: totalScore > aiTotalScore,
          }
        });
      }
      setGameState("LOBBY");
      setRound(1);
      setTotalScore(0);
      setAiTotalScore(0);
    } else {
      // Show interstitial ad between rounds
      setGameState("AD_BETWEEN_ROUNDS");
    }
  };

  const afterInterstitial = () => {
    setRound(r => r + 1);
    startGame();
  };

  const handleRewardedComplete = (reward: number) => {
    setTimeLeft(prev => prev + reward);
    setRewardedUsed(true);
    setShowRewardedAd(false);
  };

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-2xl mx-auto w-full">

        {/* Between-rounds interstitial */}
        {gameState === "AD_BETWEEN_ROUNDS" && (
          <InterstitialAd onDone={afterInterstitial} />
        )}

        {/* Rewarded ad overlay */}
        {showRewardedAd && (
          <RewardedAd
            rewardType="extraTime"
            rewardAmount={30}
            onComplete={handleRewardedComplete}
            onSkip={() => setShowRewardedAd(false)}
          />
        )}

        {/* Header Stats */}
        <div className="flex justify-between items-center bg-black/20 rounded-2xl p-4 mb-5 backdrop-blur-md">
          <div className="text-center">
            <p className="text-xs text-white/60 font-bold uppercase">Ronda</p>
            <p className="text-2xl font-display font-bold">{round}/3</p>
          </div>
          <div className="text-center border-l border-r border-white/20 px-6">
            <p className="text-xs text-white/60 font-bold uppercase">Tú</p>
            <p className="text-2xl font-display font-black text-secondary">{totalScore}</p>
          </div>
          <div className="text-center">
            <p className="text-xs text-white/60 font-bold uppercase">IA</p>
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
                <h2 className="text-4xl font-display font-bold mb-2">Jugar contra la IA</h2>
                <p className="text-white/70 max-w-md">La IA es rápida y no comete errores ortográficos. ¡Demuestra que los humanos somos más creativos!</p>
              </div>
              <Button size="xl" onClick={startGame}>Comenzar Ronda {round}</Button>
              <BannerAd className="w-full max-w-md" />
            </motion.div>
          )}

          {/* SPINNING */}
          {gameState === "SPINNING" && (
            <motion.div
              key="spinning"
              initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
              className="flex-1 flex flex-col items-center justify-center"
            >
              <h3 className="text-2xl font-display font-bold mb-8 animate-pulse">Girando la ruleta...</h3>
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
              {/* Letter + timer bar */}
              <div className="flex items-center gap-4 mb-5 bg-primary p-4 rounded-2xl shadow-lg border-2 border-white/10">
                <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center text-primary font-display font-black text-4xl shadow-inner flex-shrink-0">
                  {currentLetter}
                </div>
                <div className="flex-1">
                  <div className="flex justify-between mb-1">
                    <span className="font-bold text-sm text-white/70">Tiempo restante</span>
                    <span className={timeLeft <= 10 ? "text-red-400 font-black animate-pulse" : "font-bold"}>
                      {timeLeft}s
                    </span>
                  </div>
                  <Progress
                    value={(timeLeft / ROUND_TIME) * 100}
                    indicatorClass={timeLeft <= 10 ? "bg-red-500" : timeLeft <= 30 ? "bg-yellow-400" : "bg-green-400"}
                  />
                </div>
              </div>

              {/* +30s rewarded ad button */}
              {!rewardedUsed && (
                <button
                  onClick={() => setShowRewardedAd(true)}
                  className="mb-3 flex items-center justify-center gap-2 py-2 px-4 rounded-xl border border-yellow-500/30 bg-yellow-500/10 text-yellow-300 text-sm font-bold hover:bg-yellow-500/20 transition-all"
                >
                  <Tv2 className="w-4 h-4" /> Ver anuncio para +30 segundos
                </button>
              )}

              {/* Category inputs */}
              <div className="space-y-2 flex-1 overflow-y-auto pb-28">
                {CATEGORIES_ES.map(category => (
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

              {/* STOP button */}
              <div className="fixed bottom-4 left-0 w-full px-4 z-20">
                <div className="max-w-2xl mx-auto">
                  <Button
                    variant="destructive"
                    size="xl"
                    className="w-full py-6 rounded-full text-3xl shadow-2xl shadow-red-900/50 border-4 border-white/20"
                    onClick={handleStop}
                  >
                    ¡STOP!
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
              <h2 className="text-3xl font-display font-bold">La IA está evaluando...</h2>
              <p className="text-white/60 mt-2">Revisando diccionarios y reglas</p>
            </motion.div>
          )}

          {/* RESULTS */}
          {gameState === "RESULTS" && (
            <motion.div
              key="results"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col pb-8"
            >
              <h2 className="text-3xl font-display font-bold mb-4 text-center">Resultados de la Ronda</h2>

              {/* Round score summary */}
              <div className="bg-primary/50 rounded-2xl p-4 flex justify-around mb-5 border border-white/10">
                <div className="text-center">
                  <p className="text-sm font-bold text-white/60">Tu puntuación</p>
                  <p className="text-4xl font-display font-black text-secondary">+{results?.playerTotalScore || 0}</p>
                </div>
                <div className="text-center border-l border-white/20 pl-8">
                  <p className="text-sm font-bold text-white/60">Puntuación IA</p>
                  <p className="text-4xl font-display font-black">+{results?.aiTotalScore || 0}</p>
                </div>
              </div>

              {/* Category breakdown */}
              <div className="space-y-3 mb-6 flex-1 overflow-y-auto">
                {CATEGORIES_ES.map(category => {
                  const res = results?.results?.[category];
                  const playerRes = res?.player;
                  const aiRes = res?.ai;

                  return (
                    <Card key={category} className="p-4 bg-black/20 border-white/5">
                      <h4 className="font-bold text-secondary text-xs mb-2 uppercase tracking-wider">{category}</h4>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-card p-3 rounded-lg border border-white/10 relative overflow-hidden">
                          <p className="text-xs text-white/50 font-bold mb-1">Tú</p>
                          <p className="font-semibold text-lg break-words">{playerRes?.response || "—"}</p>
                          <div className={`absolute top-0 right-0 h-full w-1.5 ${playerRes?.score === 10 ? "bg-green-500" : playerRes?.score === 5 ? "bg-yellow-400" : "bg-red-500/60"}`} />
                          <span className="absolute bottom-2 right-3 text-xs font-bold opacity-50">{playerRes?.score ?? 0}pts</span>
                        </div>
                        <div className="bg-primary/40 p-3 rounded-lg border border-white/10 relative overflow-hidden">
                          <p className="text-xs text-white/50 font-bold mb-1">IA</p>
                          <p className="font-semibold text-lg break-words">{aiRes?.response || "—"}</p>
                          <div className={`absolute top-0 right-0 h-full w-1.5 ${aiRes?.score === 10 ? "bg-green-500" : aiRes?.score === 5 ? "bg-yellow-400" : "bg-red-500/60"}`} />
                          <span className="absolute bottom-2 right-3 text-xs font-bold opacity-50">{aiRes?.score ?? 0}pts</span>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {/* Banner ad in results */}
              <BannerAd className="mb-4" />

              {/* Next round / finish buttons */}
              <div className="grid grid-cols-2 gap-3">
                {round >= 3 ? (
                  <>
                    <Button size="lg" onClick={() => { setRound(1); setGameState("LOBBY"); setTotalScore(0); setAiTotalScore(0); }}>
                      Nueva Partida
                    </Button>
                    <Link href="/ranking">
                      <Button variant="secondary" size="lg" className="w-full">Ver Ranking</Button>
                    </Link>
                  </>
                ) : (
                  <Button size="lg" className="col-span-2" onClick={nextRound}>
                    Siguiente Ronda ({round + 1}/3)
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
