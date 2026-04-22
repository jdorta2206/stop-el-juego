import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";

import { useParams, useLocation } from "wouter";
import { Layout } from "@/components/Layout";
import { PremiumBadge } from "@/components/PremiumBadge";
import { usePremium } from "@/lib/usePremium";
import { useFollows } from "@/lib/useFollows";
import { FollowButton } from "@/components/FollowButton";
import { Button, Card, Input, Progress } from "@/components/ui";
import { useGetRoom, useSubmitRoomResults, getGetRoomQueryKey } from "@workspace/api-client-react";
import { usePlayer } from "@/hooks/use-player";
import { Share2, Play, ArrowLeft, Trophy, CheckCircle2, Circle, Volume2, VolumeX, Layers } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { CATEGORIES_ES } from "@/lib/utils";
import confetti from "canvas-confetti";
import { RoomInvitePanel } from "@/components/RoomInvitePanel";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { usePresence } from "@/lib/usePresence";
import { Roulette } from "@/components/Roulette";
import { useTicker } from "@/hooks/useTicker";
import { ShareResultsModal } from "@/components/ShareResultsModal";
import { getApiUrl } from "@/lib/utils";

const ROUND_TIME = 60;

// 🎲 Modo Misterio (STOP Random multijugador): duración secreta determinista
// derivada de roomCode + ronda + letra. Todos los clientes calculan lo mismo
// sin necesidad de que el servidor coordine timestamps.
const RANDOM_MIN = 15;
const RANDOM_MAX = 55;
function randomRoundDuration(roomCode: string, round: number, letter: string): number {
  const seed = `${roomCode}|${round}|${letter}`;
  let hash = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    hash ^= seed.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  const positive = Math.abs(hash);
  const range = RANDOM_MAX - RANDOM_MIN + 1;
  return RANDOM_MIN + (positive % range);
}

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

  // Tournament context (optional — from query params)
  const tournamentCtx = (() => {
    const params = new URLSearchParams(window.location.search);
    const t = params.get("torneo");
    const m = params.get("match");
    return t && m ? { code: t, matchId: m } : null;
  })();
  const { player } = usePlayer();
  const { isPremium: meIsPremium } = usePremium(player?.id);
  const { followedIds, follow, unfollow } = useFollows(player?.id);

  // Sync spy budget with premium status: 2/round if premium, 1/round otherwise
  useEffect(() => {
    const limit = meIsPremium ? 2 : 1;
    setSpyLimit(limit);
    setSpyUsesLeft(limit);
  }, [meIsPremium]);

  const [phase, setPhase] = useState<LocalPhase>("lobby");
  const [responses, setResponses] = useState<Record<string, string>>({});
  const [timeLeft, setTimeLeft] = useState(ROUND_TIME);
  const [freezeCountdown, setFreezeCountdown] = useState(3);
  const [copied, setCopied] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [muted, setMuted] = useState(false);
  const [revealedCount, setRevealedCount] = useState(0);
  const [showShareModal, setShowShareModal] = useState(false);
  const [floatingReactions, setFloatingReactions] = useState<Array<{ id: string; emoji: string; playerName: string }>>([]);
  const seenReactionIds = useRef<Set<string>>(new Set());
  const [showPhrases, setShowPhrases] = useState(false);
  // 🕵️ Spy / Robar respuesta — 1 use/round (free) or 2/round (premium), -10 pts each at submit
  const [spyUsesLeft, setSpyUsesLeft] = useState(1);
  const [spyLimit, setSpyLimit] = useState(1);
  const [spyLoading, setSpyLoading] = useState(false);
  const [spyReveal, setSpyReveal] = useState<{ rivalName: string; category: string; word: string } | null>(null);
  const [spyError, setSpyError] = useState<string | null>(null);
  const [visiblePhrases, setVisiblePhrases] = useState<Array<{ id: string; playerName: string; text: string }>>([]);
  const seenPhraseIds = useRef<Set<string>>(new Set());
  const [sseActive, setSseActive] = useState(false);
  const [typingPlayers, setTypingPlayers] = useState<Array<{ playerId: string; playerName: string }>>([]);
  const [rematchCode, setRematchCode] = useState<string | null>(null);
  const [rematchLoading, setRematchLoading] = useState(false);
  const lastTypingPing = useRef(0);
  const [categoryPack, setCategoryPack] = useState<"standard" | "crazy" | "mix">("standard");
  const [roundCategories, setRoundCategories] = useState<string[]>(CATEGORIES_ES);
  const CRAZY_CATEGORIES_ES = [
    "Excusa para llegar tarde", "Película que finges haber visto", "Animal que querrías de mascota",
    "Cosa que no debes decir en una cita", "Superhéroe inventado", "Profesión del futuro",
    "Cosa que encuentras bajo el sofá", "Deporte que nunca se inventó",
  ];
  const computeCategories = useCallback((pack: "standard" | "crazy" | "mix", letter: string, round: number) => {
    if (pack === "crazy") return CRAZY_CATEGORIES_ES;
    if (pack === "mix") {
      const seed = letter.charCodeAt(0) * 31 + round * 7;
      const mixed = [...CATEGORIES_ES];
      const idx = seed % mixed.length;
      const crazyIdx = seed % CRAZY_CATEGORIES_ES.length;
      mixed[idx] = CRAZY_CATEGORIES_ES[crazyIdx];
      return mixed;
    }
    return CATEGORIES_ES;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Multiplayer bluff state
  const [bluffedCategories, setBluffedCategories] = useState<Set<string>>(new Set());
  const [myBluffResults, setMyBluffResults] = useState<{ cat: string; caught: boolean }[]>([]);
  const [bluffVoteTimeLeft, setBluffVoteTimeLeft] = useState(15);
  const [myVotes, setMyVotes] = useState<Record<string, Record<string, "lie" | "real">>>({});
  const bluffVoteTimerRef = useRef<NodeJS.Timeout | null>(null);
  const bluffedCategoriesRef = useRef<Set<string>>(new Set());
  const responsesSnapshotRef = useRef<Record<string, string>>({});
  const iAmTheStopperRef = useRef(false);

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

  // ── SSE: real-time push updates (replaces polling for critical game moments) ──
  useEffect(() => {
    if (!roomCode || !player?.id) return;
    const code = roomCode.toUpperCase();
    const API = getApiUrl();
    const url = `${API}/api/rooms/${code}/events?playerId=${player.id}`;
    let es: EventSource;
    let retryTimeout: ReturnType<typeof setTimeout>;
    let closed = false;

    function connect() {
      if (closed) return;
      es = new EventSource(url);
      es.onopen = () => setSseActive(true);
      es.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          queryClient.setQueryData(getGetRoomQueryKey(code), data);
        } catch {}
      };
      es.onerror = () => {
        setSseActive(false);
        es.close();
        if (!closed) retryTimeout = setTimeout(connect, 5000);
      };
    }
    connect();

    return () => {
      closed = true;
      clearTimeout(retryTimeout);
      es?.close();
      setSseActive(false);
    };
  }, [roomCode, player?.id, queryClient]);

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

  // When SSE is active it pushes updates in real-time — polling is just a safety fallback
  const pollingInterval = sseActive
    ? 30_000
    : phase === "bluffvoting"                                          ? 1000
    : phase === "playing" || phase === "freeze" || phase === "submitted" ? 1500
    : /* lobby / between_rounds / finished / spinning */                  4000;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: room, error } = useGetRoom(roomCode || "", {
    query: { refetchInterval: pollingInterval, enabled: !!roomCode } as any
  });

  const isHost = room?.hostId === player?.id;
  const roomStatus = (room?.status as string) || "";
  const currentLetter = room?.currentLetter || "";
  const currentRound = room?.currentRound || 0;
  const maxRounds = room?.maxRounds || 3;
  const maxPlayers = (room as any)?.maxPlayers || 8;
  const gameMode = (room as any)?.gameMode || "classic";
  const players = room?.players || [];
  const stopper = (room as any)?.stopper;

  // Keep responsesRef and bluffedCategoriesRef in sync
  useEffect(() => { responsesRef.current = responses; }, [responses]);
  useEffect(() => { bluffedCategoriesRef.current = bluffedCategories; }, [bluffedCategories]);
  // Keep phase and roomCode refs in sync so leaveRoom always has the latest values
  useEffect(() => { phaseRef.current = phase; }, [phase]);
  useEffect(() => { roomCodeRef.current = roomCode || ""; }, [roomCode]);

  // Sync categoryPack from room data
  useEffect(() => {
    const pack = (room as any)?.categoryPack;
    if (pack && ["standard", "crazy", "mix"].includes(pack)) setCategoryPack(pack);
  }, [(room as any)?.categoryPack]);

  // Sync typing presence from room data (excluding self)
  useEffect(() => {
    const list = ((room as any)?.typing ?? []) as Array<{ playerId: string; playerName: string }>;
    setTypingPlayers(list.filter(t => t.playerId !== player?.id));
  }, [(room as any)?.typing, player?.id]);

  // Sync rematch link — when host of a finished match clicks Revancha, every player gets it
  useEffect(() => {
    const code = (room as any)?.rematchCode;
    if (code && code !== rematchCode) setRematchCode(code);
  }, [(room as any)?.rematchCode, rematchCode]);

  // Throttled "I'm typing" ping — fires at most once every 1.5s while typing.
  // Also sends a snapshot of current responses so /spy can peek at what rivals wrote.
  const pingTyping = useCallback(() => {
    if (!player?.id || !roomCode) return;
    const now = Date.now();
    if (now - lastTypingPing.current < 1500) return;
    lastTypingPing.current = now;
    fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/typing`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        playerId: player.id,
        playerName: player.name ?? "?",
        responses: { ...responsesRef.current },
      }),
    }).catch(() => {});
  }, [player?.id, player?.name, roomCode]);

  // Trigger Revancha — first caller creates the new room, others piggyback on the broadcast
  const handleRematch = useCallback(async () => {
    if (rematchLoading) return;
    if (rematchCode) { setLocation(`/sala/${rematchCode}`); return; }
    if (!player?.id || !roomCode) return;
    setRematchLoading(true);
    try {
      const r = await fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/rematch`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id, playerName: player.name ?? "?", avatarColor: (player as any).avatarColor }),
      });
      const j = await r.json();
      if (j.rematchCode) { setRematchCode(j.rematchCode); setLocation(`/sala/${j.rematchCode}`); }
    } catch {} finally { setRematchLoading(false); }
  }, [rematchCode, rematchLoading, player, roomCode, setLocation]);

  // Recompute categories when round starts
  useEffect(() => {
    if (phase === "playing" && currentLetter && currentRound) {
      setRoundCategories(computeCategories(categoryPack, currentLetter, currentRound));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, currentLetter, currentRound]);

  // Process incoming reactions from room polling
  useEffect(() => {
    const reactions: Array<{ id: string; emoji: string; playerName: string }> = (room as any)?.reactions ?? [];
    const newOnes = reactions.filter(r => !seenReactionIds.current.has(r.id));
    if (newOnes.length === 0) return;
    newOnes.forEach(r => seenReactionIds.current.add(r.id));
    setFloatingReactions(prev => [...prev, ...newOnes]);
    newOnes.forEach(r => {
      setTimeout(() => {
        setFloatingReactions(prev => prev.filter(x => x.id !== r.id));
      }, 3200);
    });
  }, [(room as any)?.reactions]);

  const sendReaction = useCallback(async (emoji: string) => {
    if (!player || !roomCode) return;
    try {
      await fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/react`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ emoji, playerName: player.name }),
      });
    } catch {}
  }, [player, roomCode]);

  // Process incoming quick phrases from room polling
  useEffect(() => {
    const phrases: Array<{ id: string; playerName: string; text: string }> = (room as any)?.phrases ?? [];
    const newOnes = phrases.filter(p => !seenPhraseIds.current.has(p.id));
    if (newOnes.length === 0) return;
    newOnes.forEach(p => seenPhraseIds.current.add(p.id));
    setVisiblePhrases(prev => [...prev, ...newOnes].slice(-5));
    newOnes.forEach(p => {
      setTimeout(() => {
        setVisiblePhrases(prev => prev.filter(x => x.id !== p.id));
      }, 6000);
    });
  }, [(room as any)?.phrases]);

  const sendQuickPhrase = useCallback(async (phraseIndex: number) => {
    if (!player || !roomCode) return;
    setShowPhrases(false);
    try {
      await fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/phrase`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerName: player.name, phraseIndex }),
      });
    } catch {}
  }, [player, roomCode]);

  const saveCategoryPack = useCallback(async (pack: "standard" | "crazy" | "mix") => {
    if (!player || !roomCode) return;
    setCategoryPack(pack);
    try {
      await fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/category-pack`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: player.id, pack }),
      });
    } catch {}
  }, [player, roomCode]);

  const stopAllTimers = useCallback(() => {
    if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
    if (freezeTimerRef.current) { clearInterval(freezeTimerRef.current); freezeTimerRef.current = null; }
  }, []);

  const submitResults = useCallback(async (score: number, isStopper = false) => {
    if (hasSubmittedRef.current || !player || !roomCode) return;
    hasSubmittedRef.current = true;
    setPhase("submitted");
    const bluffedList = [...bluffedCategoriesRef.current];
    // Build bluffedWords map: category → what the player wrote
    const bluffedWords: Record<string, string> = {};
    for (const cat of bluffedList) {
      bluffedWords[cat] = responsesSnapshotRef.current[cat] ?? "";
    }
    // Speed bonus: stopper gets +5 if they filled ALL categories
    const allFilled = CATEGORIES_ES.every(cat => (responsesSnapshotRef.current[cat] ?? "").trim().length >= 2);
    const finalScore = isStopper && allFilled ? score + 5 : score;
    // 🕵️ Nota: el coste -10 por ESPIAR lo aplica el servidor autoritativamente.
    try {
      await submitMutation.mutateAsync({
        roomCode: roomCode.toUpperCase(),
        data: {
          playerId: player.id,
          roundScore: finalScore,
          letter: currentLetter,
          answers: { ...responsesSnapshotRef.current },
          bluffedCategories: bluffedList.length > 0 ? bluffedList : undefined,
          bluffedWords: bluffedList.length > 0 ? bluffedWords : undefined,
        },
      });
    } catch (e) { console.error("submit error:", e); }
  }, [player, roomCode, currentLetter]);

  const autoSubmit = useCallback((asStopper = false) => {
    // Snapshot current responses before clearing for the bluff words map
    responsesSnapshotRef.current = { ...responsesRef.current };
    const score = calcScore(responsesRef.current, currentLetter);
    submitResults(score, asStopper);
  }, [currentLetter, submitResults]);

  // 🎲 In random mode, the round duration is a hidden value derived deterministically
  // from roomCode + currentRound + currentLetter, so all clients agree without server coord.
  const isRandomMode = (room as any)?.gameMode === "random";
  const roundDurationFor = useCallback((round: number, letter: string) => {
    if (isRandomMode && roomCode) {
      // Use a deterministic seed; even if `letter` is briefly missing the result
      // stays consistent across clients (never falls back to 60s mid-round).
      return randomRoundDuration(roomCode.toUpperCase(), round, letter || "");
    }
    return ROUND_TIME;
  }, [isRandomMode, roomCode]);

  // Start game timer for this round
  const startRoundTimer = useCallback(() => {
    stopAllTimers();
    hasSubmittedRef.current = false;
    isFreezingRef.current = false;
    // Reset timeLeft to the round-specific duration (random mode → hidden value)
    setTimeLeft(roundDurationFor(currentRound, currentLetter));
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          stopAllTimers();
          autoSubmit(false); // timer expired — not a stopper
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, [stopAllTimers, autoSubmit, roundDurationFor, currentRound, currentLetter]);

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
        autoSubmit(iAmTheStopperRef.current); // speed bonus if this player called STOP
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
      // Tournament: report match result (host only to avoid duplicate calls)
      if (tournamentCtx && player && sortedPlayers.length > 0 && room?.hostId === player.id) {
        const winner = sortedPlayers[0] as any;
        fetch(`${getApiUrl()}/api/tournaments/${tournamentCtx.code}/match-result`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ matchId: tournamentCtx.matchId, winnerId: winner.playerId, winnerName: winner.playerName }),
        }).catch(() => {});
      }
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
        // Mark if this player was the one who called STOP (for speed bonus)
        iAmTheStopperRef.current = stopper?.id === player?.id;
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
        setRevealedCount(0);
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

      {/* Floating emoji reactions overlay */}
      <div className="fixed bottom-24 left-0 w-full pointer-events-none z-50 flex justify-center">
        <AnimatePresence>
          {floatingReactions.map(r => (
            <motion.div
              key={r.id}
              initial={{ opacity: 0, y: 0, x: (Math.random() - 0.5) * 120, scale: 0.5 }}
              animate={{ opacity: 1, y: -200, scale: 1.4 }}
              exit={{ opacity: 0, scale: 0.8 }}
              transition={{ duration: 3, ease: "easeOut" }}
              className="absolute flex flex-col items-center gap-0.5 pointer-events-none"
            >
              <span className="text-4xl drop-shadow-lg">{r.emoji}</span>
              <span className="text-[10px] font-bold text-white/70 bg-black/40 px-1.5 py-0.5 rounded-full">{r.playerName}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick phrases floating display */}
      <div className="fixed bottom-28 left-0 right-0 flex flex-col items-center gap-1 z-30 pointer-events-none px-4">
        <AnimatePresence>
          {visiblePhrases.map(p => (
            <motion.div
              key={p.id}
              initial={{ opacity: 0, y: 12, scale: 0.9 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.95 }}
              className="bg-black/70 backdrop-blur-sm border border-white/15 rounded-2xl px-4 py-2 flex items-center gap-2"
            >
              <span className="text-xs font-bold text-white/60">{p.playerName}:</span>
              <span className="text-sm font-bold text-white">{p.text}</span>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Quick phrases picker panel */}
      <AnimatePresence>
        {showPhrases && (
          <motion.div
            key="phrases-panel"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            className="fixed bottom-24 left-1/2 -translate-x-1/2 z-40 w-72 bg-[#0e0a2e] border border-white/15 rounded-2xl shadow-2xl p-3 grid grid-cols-2 gap-2"
          >
            {["¡Buena!", "¡Trampa! 😤", "¡Revanche!", "¡Eso no vale!", "🔥 ¡Brillante!", "😂 ¡Me ganaste!", "¡GG!", "🤔 ¡Difícil esa!"].map((txt, i) => (
              <button
                key={i}
                onClick={() => sendQuickPhrase(i)}
                className="text-sm font-bold text-white bg-white/5 hover:bg-white/15 rounded-xl py-2 px-3 text-left transition-colors"
              >
                {txt}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Share results modal */}
      {showShareModal && currentLetter && (
        <ShareResultsModal
          open={showShareModal}
          onClose={() => setShowShareModal(false)}
          letter={currentLetter}
          playerScore={players.find((p: any) => p.playerId === player?.id)?.score ?? 0}
          aiScore={0}
          categories={[]}
          results={{}}
          t={{ shareResults: "Compartir resultado", shareText: "", shareScore: "", shareChallenge: "", you: "Tú:", ai: "IA:", points: "pts", empty: "—" }}
          multiplayerData={{
            players: players.map((p: any) => ({ playerId: p.playerId, playerName: p.playerName, score: p.score ?? 0, avatarColor: p.avatarColor })),
            myPlayerId: player?.id ?? "",
            letter: currentLetter,
          }}
        />
      )}

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
              <p className="text-white/50 text-xs mt-2">
                {(() => {
                  const modeLabel: Record<string, string> = { classic: "🎯 Clásico", blitz: "⚡ Blitz", challenge: "🏆 Reto" };
                  return `${modeLabel[gameMode] ?? "🎯 Clásico"} · Máx ${maxPlayers} jugadores · Comparte el código`;
                })()}
              </p>
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
                        style={{
                          backgroundColor: p.avatarColor || "#555",
                          boxShadow: p.isPremium ? "0 0 0 2px #fde047, 0 0 10px rgba(250,204,21,0.65)" : undefined,
                        }}>
                        {p.playerName.charAt(0).toUpperCase()}
                      </div>
                      <span className="flex-1 font-bold text-sm truncate flex items-center gap-1">
                        <span className="truncate">{p.playerName}</span>
                        {p.isPremium && <PremiumBadge size="xs" />}
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
                {isHost && <StreamerModeCard room={room} playerId={player?.id ?? ""} />}
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

            {/* Category pack selector — host only */}
            <Card className="p-4 mb-3">
              <div className="flex items-center gap-2 mb-3">
                <Layers className="w-4 h-4 text-secondary" />
                <span className="text-sm font-black text-white/70">Categorías</span>
                {!isHost && <span className="text-xs text-white/30 ml-auto">El anfitrión elige</span>}
              </div>
              <div className="grid grid-cols-3 gap-2">
                {([
                  { id: "standard", label: "📚 Clásicas", desc: "Las de siempre" },
                  { id: "crazy", label: "🌀 Locas", desc: "Muy originales" },
                  { id: "mix", label: "🎲 Mixtas", desc: "Sorpresa" },
                ] as const).map(opt => (
                  <button
                    key={opt.id}
                    disabled={!isHost}
                    onClick={() => isHost && saveCategoryPack(opt.id)}
                    className="flex flex-col items-center gap-1 py-3 px-2 rounded-xl text-center transition-all"
                    style={{
                      background: categoryPack === opt.id ? "rgba(181,48,26,0.25)" : "rgba(255,255,255,0.05)",
                      border: `2px solid ${categoryPack === opt.id ? "rgba(181,48,26,0.7)" : "rgba(255,255,255,0.08)"}`,
                      opacity: !isHost ? 0.6 : 1,
                      cursor: isHost ? "pointer" : "default",
                    }}
                  >
                    <span className="text-sm font-black text-white">{opt.label}</span>
                    <span className="text-[10px] text-white/40">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </Card>

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
                // 🕵️ Reset spy budget for the new round
                setSpyUsesLeft(spyLimit);
                setSpyReveal(null);
                setSpyError(null);
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
                  {isRandomMode ? (
                    <span className="text-fuchsia-300 font-black animate-pulse">🎲 MISTERIO</span>
                  ) : (
                    <span className={timeLeft <= 10 ? "text-red-400 animate-pulse font-black" : ""}>{timeLeft}s</span>
                  )}
                </div>
                {isRandomMode ? (
                  <div className="relative h-2 w-full overflow-hidden rounded-full bg-purple-950/50 border border-fuchsia-500/30">
                    <motion.div
                      className="absolute inset-y-0 w-1/3 bg-gradient-to-r from-fuchsia-500 via-purple-400 to-pink-500 rounded-full"
                      animate={{ x: ["-30%", "230%"] }}
                      transition={{ duration: 2.4, repeat: Infinity, ease: "easeInOut" }}
                    />
                  </div>
                ) : (
                  <Progress value={(timeLeft / ROUND_TIME) * 100}
                    indicatorClass={timeLeft <= 10 ? "bg-red-500" : timeLeft <= 30 ? "bg-yellow-400" : "bg-green-400"} />
                )}
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
            <div className="flex gap-1.5 mb-2 flex-wrap">
              {players.map((p: any) => (
                <span key={p.playerId}
                  className={`flex items-center gap-1 text-xs px-2 py-1 rounded-full font-bold ${p.isReady ? "bg-green-500/20 text-green-300" : "bg-white/10 text-white/40"}`}>
                  {p.isReady ? <CheckCircle2 className="w-3 h-3" /> : <Circle className="w-3 h-3" />}
                  {p.playerName}
                  {p.isPremium && <PremiumBadge size="xs" />}
                </span>
              ))}
            </div>

            {/* Live typing presence — pure social pressure */}
            <AnimatePresence>
              {typingPlayers.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -6 }}
                  className="flex items-center gap-2 mb-3 text-xs text-white/70"
                >
                  <span className="flex gap-0.5">
                    {[0, 1, 2].map(i => (
                      <motion.span
                        key={i}
                        className="inline-block w-1 h-1 rounded-full bg-amber-400"
                        animate={{ opacity: [0.3, 1, 0.3] }}
                        transition={{ duration: 0.9, repeat: Infinity, delay: i * 0.15 }}
                      />
                    ))}
                  </span>
                  <span className="font-bold truncate">
                    {typingPlayers.length === 1
                      ? `${typingPlayers[0].playerName} está escribiendo...`
                      : typingPlayers.length === 2
                        ? `${typingPlayers[0].playerName} y ${typingPlayers[1].playerName} están escribiendo...`
                        : `${typingPlayers.length} jugadores están escribiendo...`}
                  </span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Power card — shown if player has one */}
            {(() => {
              const me = players.find((p: any) => p.playerId === player?.id) as any;
              const cardId = me?.powerCard;
              const cardUsed = me?.powerCardUsed;
              if (!cardId) return null;
              const CARD_META: Record<string, { emoji: string; name: string; desc: string; color: string }> = {
                lightning:  { emoji: "⚡", name: "Rayo",        desc: "+15s a tu tiempo",        color: "#facc15" },
                shield:     { emoji: "🛡️", name: "Escudo",      desc: "Inmune a votos de mentira", color: "#4ade80" },
                sabotage:   { emoji: "❌", name: "Sabotaje",    desc: "Roba 10pts al líder",     color: "#ef4444" },
                steal:      { emoji: "🔄", name: "Hurto",       desc: "Roba 10pts al líder",     color: "#22d3ee" },
                double_or_nothing: { emoji: "🎯", name: "Doble o Nada", desc: "×2 a tu score",   color: "#f97316" },
              };
              const card = CARD_META[cardId] ?? { emoji: "🃏", name: cardId, desc: "", color: "#a855f7" };
              return (
                <motion.div
                  initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
                  className="flex items-center gap-3 p-2.5 rounded-xl mb-2"
                  style={{
                    background: cardUsed ? "rgba(255,255,255,0.03)" : `${card.color}18`,
                    border: `1.5px solid ${cardUsed ? "rgba(255,255,255,0.08)" : `${card.color}60`}`,
                    opacity: cardUsed ? 0.5 : 1,
                  }}
                >
                  <span className="text-2xl flex-shrink-0">{card.emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-black" style={{ color: card.color }}>{card.name}</p>
                    <p className="text-[10px] text-white/40">{card.desc}</p>
                  </div>
                  {!cardUsed && (
                    <motion.button
                      whileTap={{ scale: 0.9 }}
                      onClick={async () => {
                        if (!player || !roomCode) return;
                        try {
                          const r = await fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/use-card`, {
                            method: "POST", headers: { "Content-Type": "application/json" },
                            body: JSON.stringify({ playerId: player.id }),
                          });
                          const data = await r.json();
                          if (data.ok) {
                            if (cardId === "lightning") setTimeLeft(t => Math.min(t + 15, ROUND_TIME + 15));
                          }
                        } catch {}
                      }}
                      className="px-3 py-1 rounded-lg text-xs font-black flex-shrink-0"
                      style={{ background: card.color, color: "#000" }}
                    >
                      Usar
                    </motion.button>
                  )}
                  {cardUsed && <span className="text-[10px] text-white/30 font-bold flex-shrink-0">Usada</span>}
                </motion.div>
              );
            })()}

            {/* Bluff hint */}
            <div className="flex items-center justify-between mb-2 px-1">
              <p className="text-xs text-white/30">🎭 Activa hasta 2 respuestas como MENTIRA</p>
              <p className="text-xs font-bold" style={{ color: bluffedCategories.size > 0 ? "#a855f7" : "rgba(255,255,255,0.2)" }}>
                🎭 {bluffedCategories.size}/2
              </p>
            </div>

            {/* Inputs */}
            <div className="space-y-2 flex-1 overflow-y-auto pb-28">
              {roundCategories.map(cat => {
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
                      onChange={e => {
                        setResponses(r => ({ ...r, [cat]: e.target.value.toUpperCase() }));
                        pingTyping();
                      }}
                      placeholder={`${cat} con ${currentLetter}...`}
                      autoComplete="off" autoCorrect="off"
                    />
                  </div>
                );
              })}
            </div>

            {/* Emoji reactions bar + STOP button */}
            <div className="fixed bottom-4 left-0 w-full px-4 z-20 flex flex-col gap-2">
              <div className="max-w-2xl mx-auto w-full flex items-center justify-center gap-2">
                {["🔥", "❤️", "😂", "👑", "🎯", "😤", "💪", "🤯"].map(emoji => (
                  <motion.button
                    key={emoji}
                    whileTap={{ scale: 0.75 }}
                    onClick={() => sendReaction(emoji)}
                    className="w-9 h-9 flex items-center justify-center rounded-full text-xl bg-black/50 border border-white/15 backdrop-blur-sm hover:bg-white/10 active:scale-75 transition-all"
                  >
                    {emoji}
                  </motion.button>
                ))}
                <motion.button
                  whileTap={{ scale: 0.75 }}
                  onClick={() => setShowPhrases(v => !v)}
                  className={`w-9 h-9 flex items-center justify-center rounded-full text-xl border backdrop-blur-sm transition-all ${showPhrases ? "bg-white/20 border-white/40" : "bg-black/50 border-white/15 hover:bg-white/10"}`}
                >
                  💬
                </motion.button>
              </div>
              <div className="max-w-2xl mx-auto w-full flex flex-col gap-2">
                {/* 🕵️ ESPÍA — peek at a rival's in-progress answer */}
                <button
                  type="button"
                  disabled={spyUsesLeft <= 0 || spyLoading}
                  onClick={async () => {
                    if (spyUsesLeft <= 0 || spyLoading || !player?.id || !roomCode) return;
                    setSpyError(null);
                    setSpyLoading(true);
                    try {
                      const r = await fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/spy`, {
                        method: "POST",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({ playerId: player.id }),
                      });
                      if (!r.ok) {
                        const j = await r.json().catch(() => ({}));
                        setSpyError(j.error || "No se pudo espiar 🤷");
                        setTimeout(() => setSpyError(null), 2200);
                      } else {
                        const data = await r.json();
                        if (typeof data.usesLeft === "number") setSpyUsesLeft(data.usesLeft);
                        if (typeof data.limit === "number") setSpyLimit(data.limit);
                        setSpyReveal(data);
                        setTimeout(() => setSpyReveal(null), 5000);
                      }
                    } catch {
                      setSpyError("Sin conexión 📡");
                      setTimeout(() => setSpyError(null), 2200);
                    } finally {
                      setSpyLoading(false);
                    }
                  }}
                  className={`w-full py-2 rounded-full text-sm font-bold border-2 transition-all ${
                    spyUsesLeft <= 0
                      ? "bg-black/40 border-white/10 text-white/40 cursor-not-allowed"
                      : spyLimit > 1
                      ? "bg-gradient-to-r from-yellow-500 via-purple-600 to-fuchsia-600 border-yellow-300/60 text-white hover:scale-[1.02] active:scale-95 shadow-lg shadow-purple-900/40"
                      : "bg-gradient-to-r from-purple-600 to-fuchsia-600 border-white/30 text-white hover:scale-[1.02] active:scale-95 shadow-lg shadow-purple-900/40"
                  }`}
                >
                  {spyLoading
                    ? "Espiando…"
                    : spyUsesLeft <= 0
                    ? "🕵️ ESPÍA agotado"
                    : spyLimit > 1
                    ? `⭐ 🕵️ ESPIAR (${spyUsesLeft}/${spyLimit}) · -10 pts c/u`
                    : "🕵️ ESPIAR a un rival · -10 pts"}
                </button>
                <Button variant="destructive" size="xl"
                  className="w-full py-5 rounded-full text-3xl shadow-2xl shadow-red-900/50 border-4 border-white/20"
                  onClick={handleStop} isLoading={isStopping}>
                  ¡STOP!
                </Button>
              </div>
            </div>
            {/* 🕵️ Spy reveal popup */}
            <AnimatePresence>
              {spyReveal && (
                <motion.div
                  key="spy-reveal"
                  initial={{ opacity: 0, scale: 0.85, y: -20 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: -10 }}
                  className="fixed top-20 left-1/2 -translate-x-1/2 z-50 max-w-sm w-[90vw] rounded-2xl border-2 border-fuchsia-400/60 bg-gradient-to-br from-purple-900/95 to-fuchsia-900/95 backdrop-blur-md p-4 shadow-2xl shadow-purple-900/60"
                >
                  <div className="text-xs uppercase tracking-wider text-fuchsia-200/80 font-bold mb-1">🕵️ Interceptado</div>
                  <div className="text-sm text-white/90">
                    <span className="font-bold text-fuchsia-200">{spyReveal.rivalName}</span> está escribiendo en{" "}
                    <span className="font-bold text-white">{spyReveal.category}</span>:
                  </div>
                  <div className="mt-2 text-2xl font-display font-black text-white text-center py-2 px-3 bg-black/30 rounded-lg border border-white/10">
                    "{spyReveal.word}"
                  </div>
                  <div className="text-[10px] text-white/50 text-center mt-2">-10 pts · desaparece en 5s</div>
                </motion.div>
              )}
              {spyError && (
                <motion.div
                  key="spy-error"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="fixed top-20 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-full bg-black/80 border border-white/20 text-sm text-white"
                >
                  {spyError}
                </motion.div>
              )}
            </AnimatePresence>
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
                {roundCategories.map(cat => (
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
                    style={{
                      backgroundColor: p.avatarColor,
                      boxShadow: p.isPremium ? "0 0 0 2px #fde047, 0 0 10px rgba(250,204,21,0.65)" : undefined,
                    }}>
                    {p.playerName.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 font-bold text-sm flex items-center gap-1">
                    {p.playerName}
                    {p.isPremium && <PremiumBadge size="xs" />}
                  </span>
                  {p.isReady
                    ? <span className="text-green-400 text-sm font-bold flex items-center gap-1"><CheckCircle2 className="w-4 h-4" /> Listo</span>
                    : <span className="text-white/30 text-xs font-bold animate-pulse">Enviando...</span>}
                </div>
              ))}
            </div>
          </motion.div>
        )}

        {/* ── BETWEEN ROUNDS — answer reveal + scores ── */}
        {phase === "between_rounds" && (() => {
          const normLetter = normalizeForScore(currentLetter || room?.currentLetter || "");
          // Build uniqueness map: for each category, which normalized values appear >1 times
          const duplicatesByCategory: Record<string, Set<string>> = {};
          for (const cat of CATEGORIES_ES) {
            const vals = players
              .map((p: any) => normalizeForScore(p.answers?.[cat] ?? ""))
              .filter(v => v.length >= 2 && v.startsWith(normLetter));
            const seen = new Set<string>();
            const dupes = new Set<string>();
            for (const v of vals) { if (seen.has(v)) dupes.add(v); else seen.add(v); }
            duplicatesByCategory[cat] = dupes;
          }
          const showScores = revealedCount >= CATEGORIES_ES.length;
          const roundNumber = currentRound > 1 ? currentRound - 1 : maxRounds;
          return (
            <motion.div key="between_rounds"
              initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
              className="flex-1 flex flex-col max-w-lg mx-auto w-full py-4 gap-4"
            >
              <div className="text-center">
                <p className="text-secondary font-black text-sm uppercase tracking-widest">Ronda {roundNumber}/{maxRounds}</p>
                <h2 className="text-2xl font-display font-black">
                  {showScores ? "Puntuaciones" : `Letra ${currentLetter || room?.currentLetter}`}
                </h2>
              </div>

              {!showScores ? (
                <>
                  {/* Category reveal grid */}
                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {CATEGORIES_ES.map((cat, catIdx) => {
                      const revealed = catIdx < revealedCount;
                      return (
                        <motion.div key={cat}
                          initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: catIdx * 0.04 }}
                          className="bg-black/20 border border-white/10 rounded-xl overflow-hidden"
                        >
                          {/* Category header */}
                          <div className="px-3 py-1.5 bg-white/5 flex items-center justify-between">
                            <p className="font-black text-xs uppercase tracking-widest text-white/60">{cat}</p>
                          </div>
                          {/* Player answers */}
                          <div className="divide-y divide-white/5">
                            {players.map((p: any) => {
                              const raw = p.answers?.[cat] ?? "";
                              const norm = normalizeForScore(raw);
                              const valid = norm.length >= 2 && norm.startsWith(normLetter);
                              const isDupe = valid && duplicatesByCategory[cat].has(norm);
                              const isMe = p.playerId === player?.id;
                              return (
                                <div key={p.playerId}
                                  className={`flex items-center gap-2 px-3 py-1.5 transition-all duration-300 ${revealed ? "opacity-100" : "opacity-0 pointer-events-none"}`}
                                >
                                  <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-white text-[10px] font-bold"
                                    style={{
                                      backgroundColor: p.avatarColor,
                                      boxShadow: p.isPremium ? "0 0 0 1.5px #fde047, 0 0 6px rgba(250,204,21,0.6)" : undefined,
                                    }}>
                                    {p.playerName.charAt(0).toUpperCase()}
                                  </div>
                                  <p className={`text-xs font-bold flex-1 truncate flex items-center gap-1 ${isMe ? "text-secondary" : "text-white/80"}`}>
                                    <span className="truncate">{p.playerName}</span>
                                    {p.isPremium && <PremiumBadge size="xs" />}
                                  </p>
                                  <p className={`text-xs font-black truncate max-w-[120px] ${!revealed ? "blur-sm" : valid ? isDupe ? "text-yellow-400" : "text-green-400" : "text-white/30"}`}>
                                    {raw || "—"}
                                  </p>
                                  {revealed && valid && (
                                    <span className="text-[10px] font-black shrink-0"
                                      style={{ color: isDupe ? "#facc15" : "#4ade80" }}>
                                      {isDupe ? "×2" : "✓"}
                                    </span>
                                  )}
                                  {/* 👏 Vote-for-funniest button */}
                                  {revealed && valid && !isMe && (() => {
                                    const allVotes = ((room as any)?.funVotes ?? []) as Array<{
                                      round: number; voterId: string; votedPlayerId: string; category: string; answer: string;
                                    }>;
                                    const roundNum = currentRound > 1 ? currentRound - 1 : maxRounds;
                                    const myVote = allVotes.find(v =>
                                      v.round === roundNum && v.voterId === player?.id);
                                    const iVotedThis =
                                      myVote?.votedPlayerId === p.playerId && myVote?.category === cat;
                                    const voteCount = allVotes.filter(v =>
                                      v.round === roundNum && v.votedPlayerId === p.playerId && v.category === cat
                                    ).length;
                                    return (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          if (!player?.id || !roomCode) return;
                                          try {
                                            await fetch(`${getApiUrl()}/api/rooms/${roomCode.toUpperCase()}/funvote`, {
                                              method: "POST",
                                              headers: { "Content-Type": "application/json" },
                                              body: JSON.stringify({
                                                playerId: player.id,
                                                votedPlayerId: p.playerId,
                                                category: cat,
                                                round: roundNum,
                                                answer: raw,
                                              }),
                                            });
                                          } catch {}
                                        }}
                                        title={iVotedThis ? "Tu voto" : "Votar como jugada graciosa"}
                                        className={`text-sm shrink-0 px-1.5 py-0.5 rounded-full transition-all border ${
                                          iVotedThis
                                            ? "bg-pink-500/30 border-pink-400/60 scale-110"
                                            : "bg-white/5 border-transparent hover:bg-white/15 opacity-60 hover:opacity-100"
                                        }`}
                                      >
                                        👏{voteCount > 0 ? <span className="ml-0.5 text-[10px] font-black">{voteCount}</span> : null}
                                      </button>
                                    );
                                  })()}
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      );
                    })}
                  </div>
                  <Button size="lg" className="w-full shrink-0"
                    onClick={() => setRevealedCount(prev => Math.min(prev + 1, CATEGORIES_ES.length))}>
                    {revealedCount === 0 ? "▶ Revelar" : revealedCount < CATEGORIES_ES.length ? `Siguiente (${revealedCount}/${CATEGORIES_ES.length})` : "Ver puntuaciones"}
                  </Button>
                  {revealedCount > 0 && revealedCount < CATEGORIES_ES.length && (
                    <button className="text-xs text-white/30 underline text-center"
                      onClick={() => setRevealedCount(CATEGORIES_ES.length)}>
                      Ver todo de una vez
                    </button>
                  )}
                </>
              ) : (
                <>
                  {/* Score summary */}
                  <div className="space-y-2">
                    {[...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0)).map((p: any, i) => {
                      const medals = ["🥇", "🥈", "🥉"];
                      const isMe = p.playerId === player?.id;
                      const roundPts = p.roundScore ?? 0;
                      return (
                        <motion.div key={p.playerId}
                          initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: i * 0.08 }}
                          className={`flex items-center gap-3 p-3 rounded-xl ${isMe ? "bg-secondary/20 border border-secondary/30" : "bg-black/20 border border-white/10"}`}>
                          <span className="text-xl">{medals[i] || `#${i + 1}`}</span>
                          <div className="w-8 h-8 rounded-full flex-shrink-0 flex items-center justify-center text-white font-bold"
                            style={{
                              backgroundColor: p.avatarColor,
                              boxShadow: p.isPremium ? "0 0 0 2px #fde047, 0 0 10px rgba(250,204,21,0.65)" : undefined,
                            }}>
                            {p.playerName.charAt(0).toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="font-black text-sm truncate flex items-center gap-1">
                              <span className="truncate">{p.playerName}</span>
                              {p.isPremium && <PremiumBadge size="xs" />}
                              {isMe && <span className="text-secondary text-xs">(tú)</span>}
                            </p>
                            <p className="text-xs text-white/40">+{roundPts} pts esta ronda</p>
                          </div>
                          <p className="font-black text-secondary text-lg shrink-0">{p.score || 0}</p>
                        </motion.div>
                      );
                    })}
                  </div>
                  {isHost ? (
                    <Button size="xl" className="w-full border-2 border-white/20" onClick={handleStart}>
                      <Play className="w-5 h-5 mr-2 fill-current" /> Siguiente Ronda ({currentRound}/{maxRounds})
                    </Button>
                  ) : (
                    <div className="bg-black/20 p-4 rounded-xl text-center border border-white/10">
                      <p className="font-bold animate-pulse text-secondary">Esperando al anfitrión...</p>
                    </div>
                  )}
                </>
              )}
            </motion.div>
          );
        })()}

        {/* ── FINISHED ── */}
        {phase === "finished" && (() => {
          const sorted = [...players].sort((a: any, b: any) => (b.score || 0) - (a.score || 0));
          const myIdx = sorted.findIndex((p: any) => p.playerId === player?.id);
          const myPos = myIdx >= 0 ? myIdx + 1 : null;
          const total = sorted.length;
          const medals = ["🥇", "🥈", "🥉"];
          const champ = sorted[0];
          const wooden = total >= 3 ? sorted[sorted.length - 1] : null;
          const posEmoji = myPos === 1 ? "🥇" : myPos === 2 ? "🥈" : myPos === 3 ? "🥉" : "💀";
          const posMsg =
            myPos === 1 ? "¡CAMPEÓN!"
            : myPos === 2 ? "¡Casi casi!"
            : myPos === 3 ? "Top 3, vamos"
            : myPos === total ? "Cuchara de palo 🐌"
            : `Quedaste #${myPos}`;

          return (
          <motion.div key="finished"
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            className="flex-1 flex flex-col max-w-md mx-auto w-full py-8 gap-6"
          >
            {/* 🎯 Position toast — first thing the player sees */}
            {myPos && total > 1 && (
              <motion.div
                initial={{ scale: 0.4, opacity: 0, y: -30 }}
                animate={{ scale: [0.4, 1.18, 1], opacity: 1, y: 0 }}
                transition={{ duration: 0.7, times: [0, 0.6, 1], type: "spring", bounce: 0.5 }}
                className="text-center py-5 px-4 rounded-3xl border-2"
                style={{
                  background: myPos === 1
                    ? "linear-gradient(135deg, rgba(249,168,37,0.35), rgba(220,38,38,0.25))"
                    : myPos === total
                      ? "linear-gradient(135deg, rgba(100,116,139,0.35), rgba(30,41,59,0.4))"
                      : "linear-gradient(135deg, rgba(99,102,241,0.3), rgba(168,85,247,0.25))",
                  borderColor: myPos === 1 ? "#f9a825" : myPos === total ? "#64748b" : "#a855f7",
                }}
              >
                <div className="text-6xl mb-1">{posEmoji}</div>
                <p className="text-3xl font-display font-black" style={{
                  color: myPos === 1 ? "#fbbf24" : "#fff",
                  textShadow: "0 2px 8px rgba(0,0,0,0.4)",
                }}>
                  {posMsg}
                </p>
                <p className="text-sm text-white/70 mt-1 font-bold">
                  {myPos} de {total} jugadores
                </p>
              </motion.div>
            )}

            <div className="text-center">
              <Trophy className="w-16 h-16 text-secondary mx-auto mb-3" />
              <h2 className="text-4xl font-display font-black">¡Partida Terminada!</h2>
              <p className="text-white/60 mt-1">Clasificación final</p>
            </div>

            <div className="space-y-3">
              {sorted.map((p: any, i) => {
                const isMe = p.playerId === player?.id;
                return (
                  <motion.div key={p.playerId}
                    initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.1 }}
                    className={`flex items-center gap-4 p-4 rounded-2xl border ${isMe ? "bg-secondary/20 border-secondary/40 scale-[1.02]" : "bg-black/20 border-white/10"}`}>
                    <span className="text-2xl">{medals[i] || `#${i + 1}`}</span>
                    <div className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow"
                      style={{
                        backgroundColor: p.avatarColor,
                        boxShadow: p.isPremium ? "0 0 0 2.5px #fde047, 0 0 14px rgba(250,204,21,0.7)" : undefined,
                      }}>
                      {p.playerName.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1">
                      <p className="font-black flex items-center gap-1">
                        {p.playerName}
                        {p.isPremium && <PremiumBadge size="sm" />}
                        {isMe && <span className="text-secondary/80 font-bold">(Tú)</span>}
                      </p>
                      {i === 0 && <p className="text-xs text-secondary font-black">¡GANADOR!</p>}
                      {!isMe && player?.id && (
                        <div className="mt-1.5">
                          <FollowButton
                            meId={player.id}
                            targetId={p.playerId}
                            targetName={p.playerName}
                            targetAvatarColor={p.avatarColor}
                            isFollowing={followedIds.has(p.playerId)}
                            follow={follow}
                            unfollow={unfollow}
                            size="xs"
                          />
                        </div>
                      )}
                    </div>
                    <p className="text-2xl font-black text-secondary">{p.score || 0}</p>
                  </motion.div>
                );
              })}
            </div>

            {/* 🎭 Premios humillación — listo para compartir */}
            {total >= 2 && (() => {
              // Compute extra humiliation awards from final-round answers.
              // Each player has `answers` (Record<category, word>) and `bluffedCategories` (array).
              type P = any;
              const norm = (w: string) => (w ?? "").toString().trim().toLowerCase();

              // Build category → list of normalized words across all players (last round)
              const wordsByCat = new Map<string, string[]>();
              for (const p of players as P[]) {
                const ans = (p.answers ?? {}) as Record<string, string>;
                for (const [cat, w] of Object.entries(ans)) {
                  const nw = norm(w);
                  if (!nw) continue;
                  const arr = wordsByCat.get(cat) ?? [];
                  arr.push(nw);
                  wordsByCat.set(cat, arr);
                }
              }
              // Per player: count unique vs duplicated answers in the final round
              const stats = (players as P[]).map(p => {
                const ans = (p.answers ?? {}) as Record<string, string>;
                let unique = 0, dup = 0, filled = 0;
                for (const [cat, w] of Object.entries(ans)) {
                  const nw = norm(w);
                  if (!nw) continue;
                  filled++;
                  const occurrences = (wordsByCat.get(cat) ?? []).filter(x => x === nw).length;
                  if (occurrences === 1) unique++;
                  else if (occurrences >= 2) dup++;
                }
                return {
                  playerId: p.playerId,
                  playerName: p.playerName,
                  unique, dup, filled,
                  bluffs: (p.bluffedCategories?.length ?? 0) as number,
                };
              });

              const winnerOf = <K extends "unique" | "dup" | "bluffs">(k: K, minVal = 1) => {
                const best = stats.reduce<typeof stats[0] | null>((acc, s) =>
                  s[k] >= minVal && (!acc || s[k] > acc[k]) ? s : acc, null);
                if (!best) return null;
                // Skip if tied with another player on the same metric
                const tied = stats.filter(s => s[k] === best[k]);
                return tied.length === 1 ? best : null;
              };
              const loserMostEmpty = (() => {
                const maxEmpty = Math.max(...stats.map(s => Math.max(0, 8 - s.filled)));
                if (maxEmpty < 3) return null; // only shame if truly bad (3+ empty)
                const cand = stats.filter(s => (8 - s.filled) === maxEmpty);
                return cand.length === 1 ? cand[0] : null;
              })();

              const original = winnerOf("unique", 2);
              const copion   = winnerOf("dup", 2);
              const bluffer  = winnerOf("bluffs", 1);

              // 👏 Jugada de la partida: la respuesta con más votos a "graciosa"
              const allVotes = ((room as any)?.funVotes ?? []) as Array<{
                round: number; voterId: string; votedPlayerId: string; category: string; answer: string;
              }>;
              const tally = new Map<string, { player: any; category: string; answer: string; round: number; votes: number }>();
              for (const v of allVotes) {
                const k = `${v.round}|${v.votedPlayerId}|${v.category}`;
                const t = tally.get(k);
                if (t) t.votes++;
                else {
                  const target = (players as P[]).find(p => p.playerId === v.votedPlayerId);
                  if (target) tally.set(k, { player: target, category: v.category, answer: v.answer, round: v.round, votes: 1 });
                }
              }
              const funniest = (() => {
                if (tally.size === 0) return null;
                const entries = Array.from(tally.values());
                entries.sort((a, b) => b.votes - a.votes);
                const top = entries[0];
                // tie at top → no clear winner
                if (entries.length > 1 && entries[1].votes === top.votes) return null;
                return top;
              })();

              return (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="rounded-2xl p-4 border border-white/10 bg-gradient-to-br from-yellow-900/20 to-red-900/20"
              >
                <p className="text-xs font-black text-white/60 uppercase tracking-wider text-center mb-3">
                  🏅 Premios de la partida
                </p>
                <div className="space-y-2">
                  <div className="flex items-center gap-3 text-sm">
                    <span className="text-2xl">👑</span>
                    <div className="flex-1">
                      <p className="font-black text-yellow-400">Rey del Stop</p>
                      <p className="text-xs text-white/60">{champ.playerName} · {champ.score || 0} pts</p>
                    </div>
                  </div>
                  {wooden && wooden.playerId !== champ.playerId && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-2xl">🐌</span>
                      <div className="flex-1">
                        <p className="font-black text-slate-300">Cuchara de palo</p>
                        <p className="text-xs text-white/60">{wooden.playerName} · {wooden.score || 0} pts</p>
                      </div>
                    </div>
                  )}
                  {original && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-2xl">🦄</span>
                      <div className="flex-1">
                        <p className="font-black text-fuchsia-300">El Único</p>
                        <p className="text-xs text-white/60">{original.playerName} · {original.unique} respuestas que nadie más puso</p>
                      </div>
                    </div>
                  )}
                  {copion && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-2xl">🦜</span>
                      <div className="flex-1">
                        <p className="font-black text-orange-300">El Copión</p>
                        <p className="text-xs text-white/60">{copion.playerName} · {copion.dup} respuestas calcadas</p>
                      </div>
                    </div>
                  )}
                  {bluffer && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-2xl">🎭</span>
                      <div className="flex-1">
                        <p className="font-black text-cyan-300">El Bluffer</p>
                        <p className="text-xs text-white/60">{bluffer.playerName} · {bluffer.bluffs} bluff{bluffer.bluffs === 1 ? "" : "s"}</p>
                      </div>
                    </div>
                  )}
                  {loserMostEmpty && loserMostEmpty.playerId !== champ.playerId && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-2xl">🥶</span>
                      <div className="flex-1">
                        <p className="font-black text-blue-300">Cerebro Congelado</p>
                        <p className="text-xs text-white/60">{loserMostEmpty.playerName} · {8 - loserMostEmpty.filled} casillas en blanco</p>
                      </div>
                    </div>
                  )}
                  {funniest && (
                    <div className="flex items-center gap-3 text-sm">
                      <span className="text-2xl">👏</span>
                      <div className="flex-1">
                        <p className="font-black text-pink-300">Jugada de la partida</p>
                        <p className="text-xs text-white/60">
                          {funniest.player.playerName} con <span className="font-black text-white">"{funniest.answer}"</span> en {funniest.category} · {funniest.votes} voto{funniest.votes === 1 ? "" : "s"}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>
              );
            })()}

            {/* Share result button */}
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
              onClick={() => setShowShareModal(true)}
              className="w-full flex items-center justify-center gap-3 py-4 rounded-2xl font-black text-lg"
              style={{
                background: "linear-gradient(135deg, rgba(249,168,37,0.25), rgba(181,48,26,0.2))",
                border: "2px solid rgba(249,168,37,0.5)",
                color: "#f9a825",
              }}
            >
              <Share2 className="w-5 h-5" />
              Compartir resultado 🎮
            </motion.button>

            {tournamentCtx && (
              <motion.button
                whileTap={{ scale: 0.97 }}
                onClick={() => setLocation("/torneo")}
                className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-black text-sm"
                style={{ background: "linear-gradient(135deg, rgba(245,158,11,0.2), rgba(220,38,38,0.2))", border: "1.5px solid rgba(245,158,11,0.4)", color: "#f59e0b" }}
              >
                🏆 Ver bracket del torneo
              </motion.button>
            )}
            {/* ⚡ REVANCHA — same opponents, one tap */}
            {!tournamentCtx && (
              <motion.button
                whileTap={{ scale: 0.96 }}
                onClick={handleRematch}
                disabled={rematchLoading}
                animate={rematchCode ? {
                  boxShadow: [
                    "0 0 0px rgba(220,38,38,0.0)",
                    "0 0 24px rgba(220,38,38,0.7)",
                    "0 0 0px rgba(220,38,38,0.0)",
                  ],
                } : {}}
                transition={{ repeat: Infinity, duration: 1.4 }}
                className="w-full flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-xl disabled:opacity-60"
                style={{
                  background: rematchCode
                    ? "linear-gradient(135deg, #f9a825, #dc2626)"
                    : "linear-gradient(135deg, #1a237e, #283593)",
                  color: "white",
                  textShadow: "0 2px 6px rgba(0,0,0,0.3)",
                }}
              >
                {rematchLoading
                  ? "Creando..."
                  : rematchCode
                    ? "⚔️ ¡ENTRAR A LA REVANCHA!"
                    : "🔥 REVANCHA"}
              </motion.button>
            )}
            <div className="grid grid-cols-2 gap-3">
              <Button variant="secondary" size="lg" onClick={() => setLocation("/ranking")}>
                <Trophy className="w-4 h-4 mr-2" /> Ranking
              </Button>
              <Button size="lg" onClick={() => setLocation("/multiplayer")}>Otra sala</Button>
            </div>
          </motion.div>
          );
        })()}

      </AnimatePresence>
    </Layout>
  );
}

// 📺 Modo Streamer — host can publish the room so anyone can spectate at /live/:code
// and an OBS-friendly overlay is exposed at /overlay/:code.
function StreamerModeCard({ room, playerId }: { room: any; playerId: string }) {
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const isPublic = !!room?.isPublic;
  const code = room?.roomCode;
  const apiBase = (import.meta.env.VITE_API_BASE_URL || "") as string;
  const liveUrl = `${window.location.origin}${import.meta.env.BASE_URL}live/${code}`;
  const overlayUrl = `${window.location.origin}${import.meta.env.BASE_URL}overlay/${code}`;

  const toggle = async () => {
    if (!code || !playerId) return;
    setBusy(true);
    try {
      await fetch(`${apiBase}/api/rooms/${encodeURIComponent(code)}/visibility`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hostId: playerId, isPublic: !isPublic }),
      });
    } finally {
      setBusy(false);
    }
  };

  const copy = (url: string, key: string) => {
    navigator.clipboard.writeText(url).catch(() => {});
    setCopied(key);
    setTimeout(() => setCopied(null), 1500);
  };

  return (
    <Card className="p-3 flex flex-col gap-2"
      style={{ background: isPublic ? "rgba(239,68,68,0.10)" : "rgba(255,255,255,0.03)",
        border: isPublic ? "1.5px solid rgba(239,68,68,0.55)" : "1px solid rgba(255,255,255,0.1)" }}>
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <span className="text-base">📺</span>
          <div>
            <p className="text-sm font-black text-white">Modo Streamer</p>
            <p className="text-[11px] text-white/50">
              {isPublic ? "Sala pública · cualquiera puede mirar" : "Activa para que tus viewers puedan ver la partida"}
            </p>
          </div>
        </div>
        <Button size="sm" variant={isPublic ? "destructive" : "secondary"} onClick={toggle} disabled={busy}>
          {isPublic ? "Apagar" : "Activar"}
        </Button>
      </div>
      {isPublic && (
        <div className="flex flex-col gap-1.5 mt-1">
          <div className="flex gap-2">
            <input readOnly value={liveUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 bg-black/40 text-white/80 text-[11px] px-2 py-1 rounded border border-white/10 font-mono" />
            <Button size="sm" variant="ghost" onClick={() => copy(liveUrl, "live")}>
              {copied === "live" ? "✓" : "Live"}
            </Button>
          </div>
          <div className="flex gap-2">
            <input readOnly value={overlayUrl}
              onClick={(e) => (e.target as HTMLInputElement).select()}
              className="flex-1 bg-black/40 text-white/80 text-[11px] px-2 py-1 rounded border border-white/10 font-mono" />
            <Button size="sm" variant="ghost" onClick={() => copy(overlayUrl, "obs")}>
              {copied === "obs" ? "✓" : "OBS"}
            </Button>
          </div>
        </div>
      )}
    </Card>
  );
}
