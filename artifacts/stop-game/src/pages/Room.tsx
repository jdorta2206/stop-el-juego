import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card, Input, Progress } from "@/components/ui";
import { useGetRoom, useSubmitRoomResults, useSubmitScore } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { Share2, Play, ArrowLeft, Trophy, CheckCircle2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES_ES } from "@/lib/utils";
import confetti from "canvas-confetti";
import { RoomInvitePanel } from "@/components/RoomInvitePanel";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { usePresence } from "@/lib/usePresence";

const ROUND_TIME = 60;

function calcScore(responses: Record<string, string>, letter: string): number {
  let score = 0;
  for (const val of Object.values(responses)) {
    const t = val.trim().toUpperCase();
    if (t && t.startsWith(letter.toUpperCase())) score += 10;
  }
  return score;
}

// Local UI phase — what the current player sees
type LocalPhase = "lobby" | "playing" | "freeze" | "submitted" | "between_rounds" | "finished";

export default function Room() {
  const { id: roomCode } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { player } = usePlayer();

  const [phase, setPhase] = useState<LocalPhase>("lobby");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [freezeCountdown, setFreezeCountdown] = useState(3);
  const [copied, setCopied] = useState(false);
  const [isStopping, setIsStopping] = useState(false);

  const responsesRef = useRef<Record<string, string>>({});
  const lastRoundRef = useRef<number>(0);
  const lastStatusRef = useRef<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const freezeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSubmittedRef = useRef(false);

  const submitMutation = useSubmitRoomResults();
  const submitScoreMutation = useSubmitScore();
  const hasSubmittedLeaderboardRef = useRef(false);

  // Presence + challenge/room-invite notifications while in lobby
  const { incomingChallenge, dismissChallenge } = usePresence(
    phase === "lobby" ? (player || null) : null,
    roomCode
  );

  const { data: room, error } = useGetRoom(roomCode || "", {
    query: { refetchInterval: 1500, enabled: !!roomCode }
  });

  const isHost = room?.hostId === player?.id;
  const roomStatus = (room?.status as string) || "";
  const currentLetter = room?.currentLetter || "";
  const currentRound = room?.currentRound || 0;
  const maxRounds = room?.maxRounds || 3;
  const players = room?.players || [];
  const stopper = (room as any)?.stopper;

  // Keep responsesRef in sync
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  const stopAllTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (freezeTimerRef.current) { clearInterval(freezeTimerRef.current); freezeTimerRef.current = null; }
  }, []);

  const submitResults = useCallback(async (score: number) => {
    if (hasSubmittedRef.current || !player || !roomCode) return;
    hasSubmittedRef.current = true;
    setPhase("submitted");
    try {
      await submitMutation.mutateAsync({
        roomCode: roomCode.toUpperCase(),
        data: { playerId: player.id, roundScore: score, letter: currentLetter },
      });
    } catch (e) { console.error("submit error:", e); }
  }, [player, roomCode, currentLetter]);

  const autoSubmit = useCallback(() => {
    const score = calcScore(responsesRef.current, currentLetter);
    submitResults(score);
  }, [currentLetter, submitResults]);

  // Start game timer for this round
  const startRoundTimer = useCallback(() => {
    stopAllTimers();
    hasSubmittedRef.current = false;
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopAllTimers();
          autoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopAllTimers, autoSubmit]);

  // Start freeze countdown (when STOP is called by someone)
  const startFreezeCountdown = useCallback(() => {
    stopAllTimers();
    setFreezeCountdown(3);
    let count = 3;
    freezeTimerRef.current = setInterval(() => {
      count--;
      setFreezeCountdown(count);
      if (count <= 0) {
        clearInterval(freezeTimerRef.current!);
        autoSubmit();
      }
    }, 1000);
  }, [stopAllTimers, autoSubmit]);

  // React to room status changes from polling
  useEffect(() => {
    if (!room) return;
    const prevStatus = lastStatusRef.current;
    lastStatusRef.current = roomStatus;

    if (roomStatus === "finished") {
      stopAllTimers();
      setPhase("finished");
      const sortedPlayers = [...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      const maxScore = sortedPlayers[0]?.score || 0;
      const myPlayer = players.find((p: any) => p.playerId === player?.id);
      if (myPlayer && myPlayer.score === maxScore && players.length > 1) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      // Submit multiplayer score to global leaderboard (once per game)
      if (player && player.loginMethod !== "guest" && !hasSubmittedLeaderboardRef.current && myPlayer) {
        hasSubmittedLeaderboardRef.current = true;
        const winner = sortedPlayers[0];
        submitScoreMutation.mutate({
          data: {
            playerId: player.id,
            playerName: player.name,
            avatarColor: player.avatarColor,
            score: myPlayer.score || 0,
            letter: room?.currentLetter || "A",
            mode: "multiplayer",
            won: winner?.playerId === player.id,
          }
        });
      }
      return;
    }

    if (roomStatus === "stopped") {
      // Only transition to freeze if we were playing (not already submitted/freezing)
      if (phase === "playing") {
        stopAllTimers();
        setPhase("freeze");
        startFreezeCountdown();
      }
      return;
    }

    if (roomStatus === "playing") {
      if (currentRound !== lastRoundRef.current) {
        // New round — reset everything
        lastRoundRef.current = currentRound;
        hasSubmittedRef.current = false;
        setResponses({});
        responsesRef.current = {};
        setPhase("playing");
        setTimeLeft(ROUND_TIME);
        startRoundTimer();
      }
      return;
    }

    if (roomStatus === "waiting") {
      if (currentRound > 0 && prevStatus !== "waiting") {
        // Between rounds
        setPhase("between_rounds");
      } else if (currentRound === 0) {
        setPhase("lobby");
      }
    }
  }, [roomStatus, currentRound]);

  // Cleanup on unmount
  useEffect(() => () => stopAllTimers(), [stopAllTimers]);

  const handleStop = async () => {
    if (phase !== "playing" || isStopping || !player || !roomCode) return;
    setIsStopping(true);
    try {
      await fetch(`/api/rooms/${roomCode.toUpperCase()}/stop`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, playerName: player.name }),
      });
      // Immediately transition to freeze locally too (don't wait for polling)
      stopAllTimers();
      setPhase("freeze");
      startFreezeCountdown();
    } catch (e) { console.error(e); }
    setIsStopping(false);
  };

  const handleStart = async () => {
    if (!roomCode) return;
    try {
      await fetch(`/api/rooms/${roomCode.toUpperCase()}/start`, { method: "POST" });
    } catch (e) { console.error(e); }
  };

  const handleShare = async () => {
    const text = `¡Únete a mi sala de STOP! Código: ${roomCode}`;
    if (navigator.share) {
      try { await navigator.share({ title: "STOP - Sala de juego", text }); } catch {}
    } else {
      navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  if (error) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center text-center">
          <h2 className="text-3xl font-display font-bold mb-4">Sala no encontrada</h2>
          <Button onClick={() => setLocation("/multiplayer")}>Volver</Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      {/* Room-invite / challenge notifications while in lobby */}
      <AnimatePresence>
        {incomingChallenge && (
          <ChallengeNotification challenge={incomingChallenge} onDismiss={dismissChallenge} />
        )}
      </AnimatePresence>

      <AnimatePresence mode="wait">

        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <motion.div key="lobby"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-6"
          >
            <button onClick={() => setLocation("/multiplayer")}
              className="flex items-center gap-2 text-white/60 hover:text-white mb-6 w-fit transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Salir
            </button>

            <div className="text-center mb-6">
              <p className="text-xs font-bold text-white/50 uppercase tracking-widest mb-2">Código de Sala</p>
              <div className="bg-black/30 inline-block px-8 py-4 rounded-2xl border-2 border-white/20">
                <h1 className="text-5xl font-display font-black tracking-widest text-secondary">{roomCode}</h1>
              </div>
              <p className="text-white/50 text-xs mt-2">Sin límite de jugadores · Comparte el código</p>
            </div>

            <div className="grid md:grid-cols-2 gap-5 mb-5">
              {/* Left: players in room */}
              <Card className="p-5">
                <h3 className="font-display font-bold text-base mb-3 text-white/70">
                  Jugadores ({players.length})
                </h3>
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {players.map((p: any) => (
                    <div key={p.playerId} className="flex items-center gap-3 bg-black/20 p-2.5 rounded-xl">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-white text-sm"
                        style={{ backgroundColor: p.avatarColor || "#555" }}>
                        {p.playerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 font-bold text-sm truncate">
                        {p.playerName}
                        {p.playerId === player?.id && <span className="text-white/40 text-xs ml-1">(tú)</span>}
                      </span>
                      {p.isHost && <span className="text-xs bg-secondary text-black px-2 py-0.5 rounded-full font-black">HOST</span>}
                    </div>
                  ))}
                  {players.length === 0 && <p className="text-white/30 text-sm text-center py-4">Cargando...</p>}
                </div>
              </Card>

              {/* Right: actions */}
              <div className="flex flex-col gap-3">
                <Card className="p-4 flex items-center justify-between gap-3 bg-primary/20">
                  <div className="flex items-center gap-2">
                    <Share2 className="w-5 h-5 text-secondary flex-shrink-0" />
                    <span className="text-sm text-white/70 font-bold">Compartir código</span>
                  </div>
                  <Button variant="secondary" size="sm" onClick={handleShare}>
                    {copied ? "¡Copiado! ✓" : "Copiar"}
                  </Button>
                </Card>
                {isHost ? (
                  <Button size="xl" className="w-full shadow-xl border-2 border-white/20" onClick={handleStart}
                    disabled={players.length < 1}>
                    <Play className="w-5 h-5 mr-2 fill-current" /> Iniciar Partida
                  </Button>
                ) : (
                  <div className="bg-black/20 p-4 rounded-xl text-center border border-white/10">
                    <p className="font-bold animate-pulse text-secondary">Esperando al anfitrión...</p>
                  </div>
                )}
              </div>
            </div>

            {/* Invite panel — invite friends directly to this room */}
            {player && player.loginMethod !== "guest" && roomCode && (
              <div className="mb-5">
                <RoomInvitePanel player={player} roomCode={roomCode} />
              </div>
            )}
          </motion.div>
        )}

        {/* ── PLAYING ── */}
        {phase === "playing" && (
          <motion.div key="playing"
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col max-w-2xl mx-auto w-full"
          >
            {/* Header */}
            <div className="flex items-center gap-3 mb-4 bg-primary/70 p-3 rounded-2xl border border-white/10">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-primary font-display font-black text-3xl shadow-inner flex-shrink-0">
                {currentLetter}
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold text-white/60 mb-1">
                  <span>RONDA {currentRound}/{maxRounds} · {players.length} jugadores</span>
                  <span className={timeLeft <= 10 ? "text-red-400 animate-pulse font-black" : ""}>{timeLeft}s</span>
                </div>
                <Progress value={(timeLeft / ROUND_TIME) * 100}
                  indicatorClass={timeLeft <= 10 ? "bg-red-500" : timeLeft <= 30 ? "bg-yellow-400" : "bg-green-400"} />
              </div>
            </div>

            {/* Who's submitted */}
            <div className="flex gap-1.5 mb-3 flex-wrap">
              {players.map((p: any) => (
                <span key={p.playerId}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-bold ${p.isReady ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/40"}`}>
                  {p.isReady ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                  {p.playerName}
                </span>
              ))}
            </div>

            {/* Inputs */}
            <div className="space-y-2 flex-1 overflow-y-auto pb-28">
              {CATEGORIES_ES.map(cat => (
                <div key={cat} className="bg-card p-3 rounded-xl border border-white/5">
                  <label className="block text-xs font-black text-secondary mb-1 uppercase tracking-wider">{cat}</label>
                  <Input
                    value={responses[cat] || ""}
                    onChange={e => setResponses(r => ({ ...r, [cat]: e.target.value.toUpperCase() }))}
                    placeholder={`${cat} con ${currentLetter}...`}
                    autoComplete="off" autoCorrect="off"
                  />
                </div>
              ))}
            </div>

            {/* STOP button */}
            <div className="fixed bottom-4 left-0 w-full px-4 z-20">
              <div className="max-w-2xl mx-auto">
                <Button variant="destructive" size="xl"
                  className="w-full py-5 rounded-full text-3xl shadow-2xl shadow-red-900/50 border-4 border-white/20"
                  onClick={handleStop} isLoading={isStopping}>
                  ¡STOP!
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── FREEZE — someone pressed STOP ── */}
        {phase === "freeze" && (
          <motion.div key="freeze"
            initial={{ opacity: 0, scale: 1.05 }} animate={{ opacity: 1, scale: 1 }}
            className="fixed inset-0 z-40 flex flex-col items-center justify-center gap-6 bg-black/80 backdrop-blur-sm"
          >
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", bounce: 0.5 }}
              className="text-8xl"
            >
              ✋
            </motion.div>

            <div className="text-center">
              <h2 className="text-6xl font-display font-black text-secondary mb-2">¡STOP!</h2>
              {stopper && (
                <p className="text-white/80 text-xl font-bold">
                  <span className="text-secondary">{stopper.name}</span> ha parado el juego
                </p>
              )}
            </div>

            {/* Your frozen answers */}
            <Card className="p-4 max-w-sm w-full bg-black/40 border-white/10 max-h-60 overflow-y-auto">
              <p className="text-xs font-bold text-white/40 uppercase tracking-wider mb-3 text-center">Tus respuestas</p>
              <div className="space-y-1.5">
                {CATEGORIES_ES.map(cat => (
                  <div key={cat} className="flex items-center justify-between text-sm">
                    <span className="text-secondary font-bold uppercase text-xs">{cat}</span>
                    <span className={`font-bold ${responses[cat]?.trim() ? "text-white" : "text-white/20"}`}>
                      {responses[cat]?.trim() || "—"}
                    </span>
                  </div>
                ))}
              </div>
            </Card>

            <div className="text-center">
              <p className="text-white/50 text-sm mb-2">Enviando respuestas en</p>
              <motion.div
                key={freezeCountdown}
                initial={{ scale: 1.5, opacity: 0.5 }}
                animate={{ scale: 1, opacity: 1 }}
                className="text-6xl font-display font-black text-secondary"
              >
                {freezeCountdown}
              </motion.div>
            </div>
          </motion.div>
        )}

        {/* ── SUBMITTED — waiting for all others ── */}
        {phase === "submitted" && (
          <motion.div key="submitted"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center gap-5"
          >
            <div className="text-6xl">⏳</div>
            <div>
              <h2 className="text-3xl font-display font-black text-secondary mb-1">Respuestas enviadas</h2>
              <p className="text-white/60 font-bold">Esperando a los demás jugadores...</p>
            </div>

            <div className="w-full space-y-2">
              {players.map((p: any) => (
                <div key={p.playerId}
                  className={`flex items-center gap-3 p-3 rounded-xl border ${p.isReady ? "bg-green-500/10 border-green-500/30" : "bg-white/5 border-white/10"}`}>
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-bold"
                    style={{ backgroundColor: p.avatarColor }}>
                    {p.playerName.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-bold text-sm">{p.playerName}</span>
                  {p.isReady
                    ? <span className="text-green-400 text-sm font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Listo</span>
                    : <span className="text-white/30 text-xs font-bold animate-pulse">Enviando...</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── BETWEEN ROUNDS — results + next round button ── */}
        {phase === "between_rounds" && (
          <motion.div key="between_rounds"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col max-w-md mx-auto w-full py-8 gap-5"
          >
            <div className="text-center">
              <p className="text-secondary font-black text-sm uppercase tracking-widest">Resultados</p>
              <h2 className="text-3xl font-display font-black">Ronda {currentRound - 1}/{maxRounds}</h2>
            </div>

            {/* Ranking for this point */}
            <Card className="p-4 bg-black/20 border-white/10">
              <div className="space-y-2">
                {[...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((p: any, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const isMe = p.playerId === player?.id;
                  return (
                    <motion.div key={p.playerId}
                      initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.08 }}
                      className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? "bg-secondary/20 border border-secondary/30" : "bg-white/5"}`}>
                      <span className="text-xl">{medals[i] || `#${i + 1}`}</span>
                      <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold"
                        style={{ backgroundColor: p.avatarColor }}>
                        {p.playerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-black text-sm">{p.playerName} {isMe && <span className="text-secondary text-xs">(tú)</span>}</p>
                        <p className="text-xs text-white/40">+{p.roundScore || 0} pts esta ronda</p>
                      </div>
                      <p className="font-black text-secondary text-lg">{p.score || 0}</p>
                    </motion.div>
                  );
                })}
              </div>
            </Card>

            {isHost ? (
              <Button size="xl" className="w-full border-2 border-white/20" onClick={handleStart}>
                <Play className="w-5 h-5 mr-2 fill-current" /> Siguiente Ronda ({currentRound}/{maxRounds})
              </Button>
            ) : (
              <div className="bg-black/20 p-4 rounded-xl text-center border border-white/10">
                <p className="font-bold animate-pulse text-secondary">Esperando al anfitrión...</p>
              </div>
            )}
          </motion.div>
        )}

        {/* ── FINISHED ── */}
        {phase === "finished" && (
          <motion.div key="finished"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col max-w-md mx-auto w-full py-8 gap-6"
          >
            <div className="text-center">
              <Trophy className="w-16 h-16 text-secondary mx-auto mb-3" />
              <h2 className="text-4xl font-display font-black">¡Partida Terminada!</h2>
              <p className="text-white/60 mt-1">Clasificación final</p>
            </div>

            <div className="space-y-3">
              {[...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((p: any, i) => {
                const medals = ["🥇", "🥈", "🥉"];
                const isMe = p.playerId === player?.id;
                return (
                  <motion.div key={p.playerId}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${isMe ? "bg-secondary/20 border-secondary/40 scale-[1.02]" : "bg-black/20 border-white/10"}`}>
                    <span className="text-2xl">{medals[i] || `#${i + 1}`}</span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow"
                      style={{ backgroundColor: p.avatarColor }}>
                      {p.playerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-black">{p.playerName} {isMe && <span className="text-secondary/80 font-bold">(Tú)</span>}</p>
                      {i === 0 && <p className="text-xs text-secondary font-black">¡GANADOR!</p>}
                    </div>
                    <p className="text-2xl font-black text-secondary">{p.score || 0}</p>
                  </motion.div>
                );
              })}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => setLocation("/ranking")}>
                <Trophy className="w-4 h-4 mr-2" /> Ranking
              </Button>
              <Button size="lg" onClick={() => setLocation("/multiplayer")}>Nueva Partida</Button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </Layout>
  );
}
