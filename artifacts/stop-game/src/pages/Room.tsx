import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { Button, Card, Input, Progress } from "@/components/ui";
import { useGetRoom, useSubmitRoomResults } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { Share2, Play, ArrowLeft, Trophy, CheckCircle2, Circle, Volume2, VolumeX } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES_ES } from "@/lib/utils";
import confetti from "canvas-confetti";
import { RoomInvitePanel } from "@/components/RoomInvitePanel";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { usePresence } from "@/lib/usePresence";
import { Roulette } from "@/components/Roulette";
import { useTicker } from "@/hooks/useTicker";

const ROUND_TIME = 60;

/** Mirror of server-side normalizeWord — strip accents, lower, keep only a-z + ñ */
function normalizeForScore(word: string): string {
  return word.trim().toLowerCase()
    .replace(/ñ/g, "~")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/~/g, "ñ")
    .replace(/[^a-zñ\s]/g, "")
    .trim();
}

function calcScore(responses: Record<string, string>, letter: string): number {
  let score = 0;
  const usedNorm = new Set<string>();
  const normLetter = normalizeForScore(letter);
  for (const val of Object.values(responses)) {
    const norm = normalizeForScore(val);
    if (norm.length >= 2 && norm.startsWith(normLetter) && !usedNorm.has(norm)) {
      score += 10;
      usedNorm.add(norm);
    }
  }
  return score;
}

// Local UI phase — what the current player sees
type LocalPhase = "lobby" | "spinning" | "playing" | "freeze" | "submitted" | "bluffvoting" | "bluff_results" | "between_rounds" | "finished";

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
  const [muted, setMuted] = useState(false);

  // Multiplayer bluff state
  const [bluffedCategories, setBluffedCategories] = useState<Set<string>>(new Set());
  const [myBluffResults, setMyBluffResults] = useState<{ cat: string; caught: boolean }[]>([]);
  const [bluffVoteTimeLeft, setBluffVoteTimeLeft] = useState(15);
  const [myVotes, setMyVotes] = useState<Record<string, Record<string, "lie" | "real">>>({});
  const bluffVoteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bluffedCategoriesRef = useRef<Set<string>>(new Set());
  const responsesSnapshotRef = useRef<Record<string, string>>({});

  const responsesRef = useRef<Record<string, string>>({});
  const lastRoundRef = useRef<number>(0);
  const lastStatusRef = useRef<string>("");
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const freezeTimerRef = useRef<NodeJS.Timeout | null>(null);
  const hasSubmittedRef = useRef(false);
  // Synchronous flag: true once freeze has started (avoids double-freeze from stale phase closure)
  const isFreezingRef = useRef(false);
  // Track whether we've intentionally left so cleanup doesn't double-fire
  const hasLeftRef = useRef(false);
  // Keep latest phase and roomCode in refs so leaveRoom doesn't need state deps
  const phaseRef = useRef<string>("lobby");
  const roomCodeRef = useRef<string>(roomCode || "");

  const submitMutation = useSubmitRoomResults();
  const queryClient = useQueryClient();

  // Call the leave endpoint — only while in lobby; host leaving deletes room
  const leaveRoom = useCallback(() => {
    // Only clean up if still in lobby; game-in-progress rooms stay alive
    if (phaseRef.current !== "lobby") return;
    if (hasLeftRef.current) return;
    const code = roomCodeRef.current;
    if (!code) return;

    // Read playerId directly from localStorage so it works even if React state is null
    let playerId: string | null = null;
    try {
      const stored = localStorage.getItem("stop_player_v2");
      if (stored) playerId = JSON.parse(stored).id ?? null;
    } catch { /* ignore */ }
    if (!playerId) return;

    hasLeftRef.current = true;
    const url = `/api/rooms/${code.toUpperCase()}/leave`;
    const body = JSON.stringify({ playerId });
    // sendBeacon works even when the page is being unloaded
    if (navigator.sendBeacon) {
      navigator.sendBeacon(url, new Blob([body], { type: "application/json" }));
    } else {
      fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true }).catch(() => {});
    }
  }, []); // no deps — reads everything from refs/localStorage directly

  // Ticking sound — only active during PLAYING phase
  const { toggleMute } = useTicker(timeLeft, ROUND_TIME, phase === "playing" && !muted);

  // Presence + challenge/room-invite notifications while in lobby
  const { incomingChallenge, dismissChallenge } = usePresence(
    phase === "lobby" ? (player || null) : null,
    roomCode
  );

  // Adaptive polling: fast during active play/voting, slower when idle
  const pollingInterval =
    phase === "bluffvoting"                                          ? 1000 :
    phase === "playing" || phase === "freeze" || phase === "submitted" ? 1500 :
    /* lobby / between_rounds / finished / spinning */                  4000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: room, error } = useGetRoom(roomCode || "", {
    query: { refetchInterval: pollingInterval, enabled: !!roomCode } as any
  });

  const isHost = room?.hostId === player?.id;
  const roomStatus = (room?.status as string) || "";
  const currentLetter = room?.currentLetter || "";
  const currentRound = room?.currentRound || 0;
  const maxRounds = room?.maxRounds || 3;
  const players = room?.players || [];
  const stopper = (room as any)?.stopper;

  // Keep responsesRef and bluffedCategoriesRef in sync
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { bluffedCategoriesRef.current = bluffedCategories; }, [bluffedCategories]);
  // Keep phase and roomCode refs in sync so leaveRoom always has the latest values
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roomCodeRef.current = roomCode || ""; }, [roomCode]);

  const stopAllTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (freezeTimerRef.current) { clearInterval(freezeTimerRef.current); freezeTimerRef.current = null; }
  }, []);

  const submitResults = useCallback(async (score: number) => {
    if (hasSubmittedRef.current || !player || !roomCode) return;
    hasSubmittedRef.current = true;
    setPhase("submitted");
    const bluffedList = [...bluffedCategoriesRef.current];
    // Build bluffedWords map: category → what the player wrote
    const bluffedWords: Record<string, string> = {};
    for (const cat of bluffedList) {
      bluffedWords[cat] = responsesSnapshotRef.current[cat] ?? "";
    }
    try {
      await submitMutation.mutateAsync({
        roomCode: roomCode.toUpperCase(),
        data: {
          playerId: player.id,
          roundScore: score,
          letter: currentLetter,
          bluffedCategories: bluffedList.length > 0 ? bluffedList : undefined,
          bluffedWords: bluffedList.length > 0 ? bluffedWords : undefined,
        },
      });
    } catch (e) { console.error("submit error:", e); }
  }, [player, roomCode, currentLetter]);

  const autoSubmit = useCallback(() => {
    // Snapshot current responses before clearing for the bluff words map
    responsesSnapshotRef.current = { ...responsesRef.current };
    const score = calcScore(responsesRef.current, currentLetter);
    submitResults(score);
  }, [currentLetter, submitResults]);

  // Start game timer for this round
  const startRoundTimer = useCallback(() => {
    stopAllTimers();
    hasSubmittedRef.current = false;
    isFreezingRef.current = false;
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

  // Start freeze countdown (when STOP is called by someone).
  // isFreezingRef is set SYNCHRONOUSLY so the polling effect can check it
  // without relying on the stale `phase` closure value.
  const startFreezeCountdown = useCallback(() => {
    if (isFreezingRef.current) return; // already freezing — do not double-start
    isFreezingRef.current = true;
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

  const apiBase = (() => {
    const env = (import.meta as any).env;
    return env?.VITE_API_URL ?? window.location.origin;
  })();

  // Cast a bluff vote (opponent calls this)
  const castBluffVote = useCallback(async (accusedPlayerId: string, category: string, vote: "lie" | "real") => {
    if (!player || !roomCode) return;
    setMyVotes(prev => ({
      ...prev,
      [accusedPlayerId]: { ...(prev[accusedPlayerId] ?? {}), [category]: vote },
    }));
    try {
      await fetch(`${apiBase}/api/rooms/${roomCode.toUpperCase()}/bluff-vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voterId: player.id, accusedPlayerId, category, vote }),
      });
    } catch { /* silent */ }
  }, [player, roomCode, apiBase]);

  // Force-resolve bluffs after deadline (any client can call this)
  const resolveBluffs = useCallback(async () => {
    if (!roomCode) return;
    try {
      await fetch(`${apiBase}/api/rooms/${roomCode.toUpperCase()}/resolve-bluffs`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
    } catch { /* silent */ }
  }, [roomCode, apiBase]);

  // React to room status changes from polling
  useEffect(() => {
    if (!room) return;
    const prevStatus = lastStatusRef.current;
    lastStatusRef.current = roomStatus;

    if (roomStatus === "finished") {
      stopAllTimers();
      if (bluffVoteTimerRef.current) { clearInterval(bluffVoteTimerRef.current); bluffVoteTimerRef.current = null; }
      setPhase("finished");
      const sortedPlayers = [...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
      const maxScore = sortedPlayers[0]?.score || 0;
      const myPlayer = players.find((p: any) => p.playerId === player?.id);
      if (myPlayer && myPlayer.score === maxScore && players.length > 1) {
        confetti({ particleCount: 150, spread: 70, origin: { y: 0.6 } });
      }
      queryClient.invalidateQueries({ queryKey: ["/api/ranking/scores"] });
      return;
    }

    if (roomStatus === "bluffvoting" && phase !== "bluffvoting" && phase !== "bluff_results") {
      setPhase("bluffvoting");
      // Start local countdown from deadline
      const deadline = (room as any).bluffVoteDeadline;
      const secsLeft = deadline ? Math.max(0, Math.ceil((new Date(deadline).getTime() - Date.now()) / 1000)) : 15;
      setBluffVoteTimeLeft(secsLeft);
      if (bluffVoteTimerRef.current) clearInterval(bluffVoteTimerRef.current);
      bluffVoteTimerRef.current = setInterval(() => {
        setBluffVoteTimeLeft(prev => {
          if (prev <= 1) {
            clearInterval(bluffVoteTimerRef.current!);
            bluffVoteTimerRef.current = null;
            resolveBluffs();
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      return;
    }

    if (roomStatus === "stopped") {
      if (phase === "playing") {
        stopAllTimers();
        setPhase("freeze");
        startFreezeCountdown();
      }
      return;
    }

    if (roomStatus === "playing") {
      if (currentRound !== lastRoundRef.current) {
        lastRoundRef.current = currentRound;
        hasSubmittedRef.current = false;
        isFreezingRef.current = false;
        setResponses({});
        responsesRef.current = {};
        setBluffedCategories(new Set());
        bluffedCategoriesRef.current = new Set();
        setMyVotes({});
        setMyBluffResults([]);
        setBluffVoteTimeLeft(15);
        if (bluffVoteTimerRef.current) { clearInterval(bluffVoteTimerRef.current); bluffVoteTimerRef.current = null; }
        setTimeLeft(ROUND_TIME);
        setPhase("spinning");
      }
      return;
    }

    if (roomStatus === "waiting") {
      if (bluffVoteTimerRef.current) { clearInterval(bluffVoteTimerRef.current); bluffVoteTimerRef.current = null; }
      if (currentRound > 0 && prevStatus !== "waiting") {
        setPhase("between_rounds");
      } else if (currentRound === 0) {
        setPhase("lobby");
      }
    }
  }, [roomStatus, currentRound]);

  // Cleanup on unmount: stop timers and notify server that player left
  useEffect(() => {
    return () => {
      stopAllTimers();
      leaveRoom();
    };
  }, [stopAllTimers, leaveRoom]);

  // Also fire leaveRoom if the browser tab/window is closed
  useEffect(() => {
    const handleUnload = () => leaveRoom();
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [leaveRoom]);

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

  const toggleBluff = (cat: string) => {
    setBluffedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else if (next.size < 2) next.add(cat);
      return next;
    });
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
            <button onClick={() => { leaveRoom(); setLocation("/multiplayer"); }}
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

        {/* ── SPINNING — letter roulette ── */}
        {phase === "spinning" && (
          <motion.div key="spinning"
            initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0 }}
            className="flex-1 flex flex-col items-center justify-center gap-6"
          >
            <p className="text-2xl font-display font-bold animate-pulse text-center">
              Ronda {currentRound} de {maxRounds} · ¡Girando la letra!
            </p>
            <Roulette
              isSpinning={true}
              targetLetter={currentLetter}
              onSpinComplete={() => {
                setPhase("playing");
                startRoundTimer();
              }}
            />
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
              <button
                onClick={() => { toggleMute(); setMuted(m => !m); }}
                className="p-2 rounded-full hover:bg-white/10 transition-colors flex-shrink-0"
                title={muted ? "Activar sonido" : "Silenciar"}
              >
                {muted ? <VolumeX className="w-5 h-5 text-white/40" /> : <Volume2 className="w-5 h-5 text-white/70" />}
              </button>
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

            {/* Bluff hint */}
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs text-white/30">🎭 Activa hasta 2 respuestas como MENTIRA</p>
              <p className="text-xs font-bold" style={{ color: bluffedCategories.size > 0 ? "#a855f7" : "rgba(255,255,255,0.2)" }}>
                🎭 {bluffedCategories.size}/2
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-2 flex-1 overflow-y-auto pb-28">
              {CATEGORIES_ES.map(cat => {
                const isBluffed = bluffedCategories.has(cat);
                const canBluff = !isBluffed && bluffedCategories.size >= 2;
                return (
                  <div key={cat} className="bg-card p-3 rounded-xl border transition-all"
                    style={{
                      borderColor: isBluffed ? "#a855f7" : "rgba(255,255,255,0.05)",
                      background: isBluffed ? "rgba(168,85,247,0.07)" : undefined,
                    }}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-xs font-black text-secondary uppercase tracking-wider">{cat}</label>
                      <button
                        onClick={() => toggleBluff(cat)}
                        disabled={canBluff}
                        className={`text-xs px-2 py-0.5 rounded-lg font-bold transition-all ${
                          isBluffed ? "bg-purple-500 text-white" :
                          canBluff ? "bg-white/5 text-white/20 cursor-not-allowed" :
                          "bg-white/10 text-white/40 hover:bg-purple-500/30 hover:text-purple-300"
                        }`}
                      >
                        {isBluffed ? "🎭 MENTIRA" : "🎭"}
                      </button>
                    </div>
                    <Input
                      value={responses[cat] || ""}
                      onChange={e => setResponses(r => ({ ...r, [cat]: e.target.value.toUpperCase() }))}
                      placeholder={`${cat} con ${currentLetter}...`}
                      autoComplete="off" autoCorrect="off"
                    />
                  </div>
                );
              })}
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

        {/* ── BLUFF VOTING — opponents vote on each bluffed word ── */}
        {phase === "bluffvoting" && (() => {
          const bluffers = players.filter((p: any) => p.bluffedCategories?.length > 0 && p.playerId !== player?.id);
          const iAmBluffer = (players.find((p: any) => p.playerId === player?.id) as any)?.bluffedCategories?.length > 0;

          return (
            <motion.div key="bluffvoting"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="fixed inset-0 z-40 flex flex-col items-center bg-black/90 backdrop-blur-sm pt-8 px-4 gap-4 overflow-y-auto pb-8"
            >
              {/* Header */}
              <div className="text-center">
                <motion.h2
                  initial={{ scale: 0.7 }} animate={{ scale: 1 }}
                  transition={{ type: "spring", bounce: 0.4 }}
                  className="text-4xl font-display font-black text-yellow-400"
                >
                  🎭 ¡EL JUICIO!
                </motion.h2>
                <p className="text-sm text-white/50 mt-1">
                  {iAmBluffer
                    ? "Los demás están votando si mentiste..."
                    : "¿Alguien está mintiendo? ¡Descúbrelo!"}
                </p>
                {/* Countdown ring */}
                <div className="mt-3 flex items-center justify-center gap-2">
                  <span className={`text-2xl font-black ${bluffVoteTimeLeft <= 5 ? "text-red-400 animate-pulse" : "text-white/60"}`}>
                    {bluffVoteTimeLeft}s
                  </span>
                  <span className="text-white/30 text-sm">para votar</span>
                </div>
              </div>

              {iAmBluffer ? (
                /* ── You bluffed: show what you wrote and waiting message ── */
                <div className="w-full max-w-sm space-y-3">
                  <p className="text-center text-yellow-400/80 text-xs font-bold uppercase tracking-wider">Tus palabras sospechosas</p>
                  {(players.find((p: any) => p.playerId === player?.id) as any)?.bluffedCategories?.map((cat: string, i: number) => {
                    const word = (players.find((p: any) => p.playerId === player?.id) as any)?.bluffedWords?.[cat] ?? "—";
                    return (
                      <motion.div key={cat}
                        initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: i * 0.15 }}
                        className="p-4 rounded-2xl border border-purple-500/40 bg-purple-900/20 flex items-center gap-3"
                      >
                        <span className="text-2xl">🎭</span>
                        <div>
                          <p className="text-xs uppercase text-purple-300/60">{cat}</p>
                          <p className="font-black text-white text-lg">{word}</p>
                        </div>
                      </motion.div>
                    );
                  })}
                  <p className="text-center text-white/30 text-sm mt-4 animate-pulse">
                    Esperando los votos de los demás...
                  </p>
                </div>
              ) : (
                /* ── You're an opponent: vote on each bluffed player ── */
                <div className="w-full max-w-sm space-y-5">
                  {bluffers.length === 0 ? (
                    <p className="text-center text-white/30">No hay mentiras que juzgar.</p>
                  ) : bluffers.map((bluffer: any, bi: number) => (
                    <motion.div key={bluffer.playerId}
                      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: bi * 0.1 }}
                      className="rounded-2xl overflow-hidden border border-white/10"
                      style={{ background: "rgba(0,0,0,0.3)" }}
                    >
                      {/* Bluffer header */}
                      <div className="flex items-center gap-3 px-4 py-3 border-b border-white/10">
                        <div className="w-8 h-8 rounded-full flex items-center justify-center font-black text-white text-sm"
                          style={{ backgroundColor: bluffer.avatarColor }}>
                          {bluffer.playerName?.[0]?.toUpperCase()}
                        </div>
                        <span className="font-black text-white">{bluffer.playerName}</span>
                        <span className="ml-auto text-yellow-400/70 text-xs font-bold">apostó {bluffer.bluffedCategories.length} respuesta{bluffer.bluffedCategories.length > 1 ? "s" : ""}</span>
                      </div>

                      {/* Vote on each category */}
                      <div className="p-3 space-y-2">
                        {bluffer.bluffedCategories.map((cat: string, ci: number) => {
                          const word = bluffer.bluffedWords?.[cat] ?? "???";
                          const myVote = myVotes[bluffer.playerId]?.[cat];
                          return (
                            <motion.div key={cat}
                              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                              transition={{ delay: bi * 0.1 + ci * 0.08 }}
                              className="rounded-xl p-3"
                              style={{ background: "rgba(255,255,255,0.04)" }}
                            >
                              <div className="flex items-center justify-between mb-2">
                                <div>
                                  <p className="text-xs text-white/40 uppercase tracking-wide">{cat}</p>
                                  <p className="font-black text-white text-base">{word}</p>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => castBluffVote(bluffer.playerId, cat, "lie")}
                                  disabled={!!myVote}
                                  className="flex-1 py-2 rounded-xl font-black text-sm transition-all"
                                  style={myVote === "lie"
                                    ? { background: "#ef4444", color: "white" }
                                    : myVote
                                    ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
                                    : { background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171" }}
                                >
                                  {myVote === "lie" ? "🕵️ ¡Mentira!" : "🕵️ Es mentira"}
                                </button>
                                <button
                                  onClick={() => castBluffVote(bluffer.playerId, cat, "real")}
                                  disabled={!!myVote}
                                  className="flex-1 py-2 rounded-xl font-black text-sm transition-all"
                                  style={myVote === "real"
                                    ? { background: "#22c55e", color: "white" }
                                    : myVote
                                    ? { background: "rgba(255,255,255,0.06)", color: "rgba(255,255,255,0.3)" }
                                    : { background: "rgba(34,197,94,0.12)", border: "1px solid rgba(34,197,94,0.35)", color: "#4ade80" }}
                                >
                                  {myVote === "real" ? "✅ ¡Es real!" : "✅ Es real"}
                                </button>
                              </div>
                            </motion.div>
                          );
                        })}
                      </div>
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          );
        })()}

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
