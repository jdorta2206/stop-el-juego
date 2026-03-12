import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card, Input, Progress } from "@/components/ui";
import { useGetRoom, useSubmitRoomResults } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { Share2, Play, ArrowLeft, Trophy, Clock, CheckCircle2, Circle } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES_ES } from "@/lib/utils";
import confetti from "canvas-confetti";

const ROUND_TIME = 60;

function calcScore(responses: Record<string, string>, letter: string): number {
  let score = 0;
  for (const val of Object.values(responses)) {
    const t = val.trim().toUpperCase();
    if (t && t.startsWith(letter.toUpperCase())) score += 10;
  }
  return score;
}

type RoomPhase = "lobby" | "playing" | "submitted" | "finished";

export default function Room() {
  const { id: roomCode } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { player } = usePlayer();

  const [phase, setPhase] = useState<RoomPhase>("lobby");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [copied, setCopied] = useState(false);

  const responsesRef = useRef<Record<string, string>>({});
  const lastRoundRef = useRef<number>(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const submitMutation = useSubmitRoomResults();

  const { data: room, error } = useGetRoom(roomCode || "", {
    query: {
      refetchInterval: 2000,
      enabled: !!roomCode,
    }
  });

  const isHost = room?.hostId === player?.id;
  const currentLetter = room?.currentLetter || "";
  const currentRound = room?.currentRound || 0;
  const maxRounds = room?.maxRounds || 3;
  const players = room?.players || [];
  const myPlayer = players.find((p: any) => p.playerId === player?.id);

  // Keep responsesRef in sync
  useEffect(() => { responsesRef.current = responses; }, [responses]);

  const stopTimer = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
  }, []);

  const handleSubmit = useCallback(async () => {
    if (!player || !roomCode || phase === "submitted" || phase === "finished") return;
    stopTimer();
    setPhase("submitted");

    const score = calcScore(responsesRef.current, currentLetter);
    try {
      await submitMutation.mutateAsync({
        roomCode: roomCode.toUpperCase(),
        data: { playerId: player.id, roundScore: score, letter: currentLetter },
      });
    } catch (e) {
      console.error("submit error:", e);
    }
  }, [player, roomCode, phase, currentLetter, stopTimer]);

  // Detect round/status changes from polling
  useEffect(() => {
    if (!room) return;

    if (room.status === "finished") {
      stopTimer();
      setPhase("finished");
      // Celebrate if top scorer
      const maxScore = Math.max(...players.map((p: any) => p.score || 0));
      if (myPlayer && myPlayer.score === maxScore && players.length > 1) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      return;
    }

    if (room.status === "playing") {
      if (currentRound !== lastRoundRef.current) {
        // New round started
        lastRoundRef.current = currentRound;
        setResponses({});
        responsesRef.current = {};
        setPhase("playing");
        setTimeLeft(ROUND_TIME);

        stopTimer();
        timerRef.current = setInterval(() => {
          setTimeLeft(prev => {
            if (prev <= 1) {
              handleSubmit();
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
      }
    }

    if (room.status === "waiting") {
      setPhase("lobby");
    }
  }, [room?.status, currentRound]);

  // Cleanup timer
  useEffect(() => () => stopTimer(), [stopTimer]);

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
      <AnimatePresence mode="wait">

        {/* ── LOBBY ── */}
        {phase === "lobby" && (
          <motion.div
            key="lobby"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -20 }}
            className="flex-1 flex flex-col max-w-2xl mx-auto w-full pt-6"
          >
            <button
              onClick={() => setLocation("/multiplayer")}
              className="flex items-center gap-2 text-white/70 hover:text-white mb-6 w-fit transition-colors"
            >
              <ArrowLeft className="w-4 h-4" /> Salir
            </button>

            <div className="text-center mb-8">
              <p className="text-sm font-bold text-white/60 uppercase tracking-widest mb-2">Código de Sala</p>
              <div className="bg-black/30 inline-block px-8 py-4 rounded-2xl border-2 border-white/20 backdrop-blur-md">
                <h1 className="text-5xl font-display font-black tracking-widest text-secondary">
                  {roomCode}
                </h1>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-6 mb-6">
              {/* Player list */}
              <Card className="p-5">
                <h3 className="font-display font-bold text-lg mb-4 flex items-center gap-2">
                  Jugadores ({players.length}/{maxRounds > 3 ? 8 : 8})
                </h3>
                <div className="space-y-2">
                  {players.map((p: any) => (
                    <div key={p.playerId} className="flex items-center gap-3 bg-black/20 p-3 rounded-xl border border-white/5">
                      <div
                        className="w-9 h-9 rounded-full flex items-center justify-center font-bold text-white text-sm shadow"
                        style={{ backgroundColor: p.avatarColor || "#555" }}
                      >
                        {p.playerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 font-bold truncate">
                        {p.playerName}
                        {p.playerId === player?.id && <span className="text-white/40 text-xs ml-1">(tú)</span>}
                      </span>
                      {p.isHost && (
                        <span className="text-xs bg-secondary text-black px-2 py-0.5 rounded-full font-black">HOST</span>
                      )}
                    </div>
                  ))}
                  {players.length === 0 && (
                    <div className="text-white/40 text-sm text-center py-4">Cargando jugadores...</div>
                  )}
                </div>
              </Card>

              {/* Share & Start */}
              <div className="flex flex-col gap-4">
                <Card className="p-5 flex-1 flex flex-col items-center justify-center text-center gap-3 bg-primary/30">
                  <Share2 className="w-8 h-8 text-secondary" />
                  <p className="font-bold text-sm text-white/80">Comparte el código con tus amigos</p>
                  <Button variant="secondary" className="w-full" onClick={handleShare}>
                    {copied ? "¡Copiado! ✓" : "Compartir Enlace"}
                  </Button>
                </Card>

                {isHost ? (
                  <Button
                    size="xl"
                    className="w-full shadow-xl shadow-primary/40 border-2 border-white/20"
                    disabled={players.length < 1}
                    onClick={handleStart}
                  >
                    <Play className="w-5 h-5 mr-2 fill-current" />
                    {currentRound === 0 ? "Iniciar Partida" : `Ronda ${currentRound + 1}/${maxRounds}`}
                  </Button>
                ) : (
                  <div className="bg-black/20 p-4 rounded-xl text-center border border-white/10">
                    <p className="font-bold animate-pulse text-secondary">
                      Esperando al anfitrión...
                    </p>
                    {currentRound > 0 && (
                      <p className="text-white/50 text-sm mt-1">Ronda {currentRound}/{maxRounds} completada</p>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Scores between rounds */}
            {currentRound > 0 && players.length > 0 && (
              <Card className="p-5 bg-black/20 border-white/10">
                <h3 className="font-bold text-secondary mb-3 text-center uppercase tracking-wide text-sm">
                  Puntuaciones tras ronda {currentRound}
                </h3>
                <div className="space-y-2">
                  {[...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((p: any, i) => (
                    <div key={p.playerId} className={`flex items-center gap-3 p-2 rounded-lg ${p.playerId === player?.id ? "bg-secondary/20 border border-secondary/30" : "bg-white/5"}`}>
                      <span className="text-white/40 font-bold w-5 text-center">{i + 1}</span>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold" style={{ backgroundColor: p.avatarColor }}>
                        {p.playerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 font-bold text-sm">{p.playerName}</span>
                      <span className="text-secondary font-black">{p.score || 0} pts</span>
                    </div>
                  ))}
                </div>
              </Card>
            )}
          </motion.div>
        )}

        {/* ── PLAYING ── */}
        {phase === "playing" && (
          <motion.div
            key="playing"
            initial={{ opacity: 0, x: 50 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -50 }}
            className="flex-1 flex flex-col max-w-2xl mx-auto w-full"
          >
            {/* Header: round, letter, timer, scores */}
            <div className="flex items-center gap-3 mb-4 bg-primary/70 p-3 rounded-2xl border border-white/10">
              <div className="w-14 h-14 bg-white rounded-full flex items-center justify-center text-primary font-display font-black text-3xl shadow-inner flex-shrink-0">
                {currentLetter}
              </div>
              <div className="flex-1">
                <div className="flex justify-between text-xs font-bold text-white/60 mb-1">
                  <span>RONDA {currentRound}/{maxRounds}</span>
                  <span className={timeLeft <= 10 ? "text-red-400 animate-pulse" : ""}><Clock className="inline w-3 h-3 mr-0.5" />{timeLeft}s</span>
                </div>
                <Progress
                  value={(timeLeft / ROUND_TIME) * 100}
                  indicatorClass={timeLeft <= 10 ? "bg-red-500" : timeLeft <= 30 ? "bg-yellow-400" : "bg-green-400"}
                />
              </div>
            </div>

            {/* Who has submitted */}
            <div className="flex gap-2 mb-3 flex-wrap">
              {players.map((p: any) => (
                <div key={p.playerId} className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-bold ${p.isReady ? "bg-green-500/20 text-green-300 border border-green-500/30" : "bg-white/10 text-white/40"}`}>
                  {p.isReady ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                  {p.playerName}
                </div>
              ))}
            </div>

            {/* Category inputs */}
            <div className="space-y-2 flex-1 overflow-y-auto pb-28">
              {CATEGORIES_ES.map(cat => (
                <div key={cat} className="bg-card p-3 rounded-xl border border-white/5">
                  <label className="block text-xs font-black text-secondary mb-1 uppercase tracking-wider">{cat}</label>
                  <Input
                    value={responses[cat] || ""}
                    onChange={e => setResponses(r => ({ ...r, [cat]: e.target.value.toUpperCase() }))}
                    placeholder={`${cat} con ${currentLetter}...`}
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
                  className="w-full py-5 rounded-full text-3xl shadow-2xl shadow-red-900/50 border-4 border-white/20"
                  onClick={handleSubmit}
                >
                  ¡STOP!
                </Button>
              </div>
            </div>
          </motion.div>
        )}

        {/* ── SUBMITTED - waiting for others ── */}
        {phase === "submitted" && (
          <motion.div
            key="submitted"
            initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }}
            className="flex-1 flex flex-col items-center justify-center max-w-md mx-auto w-full text-center gap-6"
          >
            <motion.div
              animate={{ scale: [1, 1.08, 1] }}
              transition={{ duration: 2, repeat: Infinity }}
              className="text-7xl"
            >
              ✋
            </motion.div>
            <div>
              <h2 className="text-4xl font-display font-black text-secondary mb-2">¡STOP!</h2>
              <p className="text-white/70 font-bold">Esperando a los demás jugadores...</p>
            </div>

            {/* Who has submitted */}
            <div className="w-full space-y-2">
              {players.map((p: any) => (
                <div key={p.playerId} className={`flex items-center gap-3 p-3 rounded-xl border ${p.isReady ? "bg-green-500/10 border-green-500/30" : "bg-white/5 border-white/10"}`}>
                  <div className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold" style={{ backgroundColor: p.avatarColor }}>
                    {p.playerName.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-bold">{p.playerName}</span>
                  {p.isReady
                    ? <span className="text-green-400 text-sm font-black flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Listo</span>
                    : <span className="text-white/30 text-sm font-bold animate-pulse">Jugando...</span>
                  }
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── FINISHED ── */}
        {phase === "finished" && (
          <motion.div
            key="finished"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col max-w-md mx-auto w-full py-8 gap-6"
          >
            <div className="text-center">
              <Trophy className="w-16 h-16 text-secondary mx-auto mb-3" />
              <h2 className="text-4xl font-display font-black">Partida Terminada</h2>
              <p className="text-white/70 mt-1">Resultados finales</p>
            </div>

            {/* Podium */}
            <div className="space-y-3">
              {[...players]
                .sort((a: any, b: any) => (b.score || 0) - (a.score || 0))
                .map((p: any, i) => {
                  const medals = ["🥇", "🥈", "🥉"];
                  const isMe = p.playerId === player?.id;
                  return (
                    <motion.div
                      key={p.playerId}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.1 }}
                      className={`flex items-center gap-4 p-4 rounded-2xl border ${isMe ? "bg-secondary/20 border-secondary/40 scale-[1.02]" : "bg-black/20 border-white/10"}`}
                    >
                      <span className="text-2xl">{medals[i] || `#${i + 1}`}</span>
                      <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow" style={{ backgroundColor: p.avatarColor }}>
                        {p.playerName.charAt(0).toUpperCase()}
                      </div>
                      <div className="flex-1">
                        <p className="font-black">{p.playerName} {isMe && "(Tú)"}</p>
                        {i === 0 && <p className="text-xs text-secondary font-bold">¡CAMPEÓN!</p>}
                      </div>
                      <p className="text-2xl font-black text-secondary">{p.score || 0}</p>
                    </motion.div>
                  );
                })}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <Button variant="secondary" size="lg" className="w-full" onClick={() => setLocation("/ranking")}>
                <Trophy className="w-4 h-4 mr-2" /> Ranking
              </Button>
              <Button size="lg" className="w-full" onClick={() => setLocation("/multiplayer")}>
                Nueva Partida
              </Button>
            </div>
          </motion.div>
        )}

      </AnimatePresence>
    </Layout>
  );
}
