import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Card } from "@/components/ui";
import { useGetLeaderboard, useGetPlayerStats } from "@workspace/api-client-react";
import { Trophy, Users, UserPlus, UserCheck, Swords, Clock, Copy, Check, CalendarClock } from "lucide-react";
import { usePlayer } from "@/hooks/use-player";
import { motion } from "framer-motion";
import { useT } from "@/i18n/useT";
import { getApiUrl } from "@/lib/utils";
import { usePresence, sendChallenge, pollChallengeStatus, type OnlinePlayer } from "@/lib/usePresence";
import { useFollows } from "@/lib/useFollows";
import { ChallengeNotification } from "@/components/ChallengeNotification";
import { useLocation } from "wouter";

type ChallengeState = "idle" | "sending" | "waiting";

function OnlineDot({ isOnline }: { isOnline: boolean }) {
  if (!isOnline) return null;
  return (
    <span className="inline-block w-2 h-2 rounded-full bg-green-400 shadow-[0_0_5px_#4ade80] flex-shrink-0" title="Online" />
  );
}

function FollowBtn({
  isFollowing,
  onToggle,
}: {
  isFollowing: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={(e) => { e.stopPropagation(); onToggle(); }}
      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
      style={
        isFollowing
          ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }
          : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.7)" }
      }
      title={isFollowing ? "Dejar de seguir" : "Agregar amigo"}
    >
      {isFollowing ? <UserCheck size={11} /> : <UserPlus size={11} />}
      {isFollowing ? "Amigo" : "Agregar"}
    </button>
  );
}

function ChallengeBtn({
  onlinePlayer,
  currentPlayer,
  lang,
}: {
  onlinePlayer: OnlinePlayer;
  currentPlayer: any;
  lang?: string;
}) {
  const [, setLocation] = useLocation();
  const [state, setState] = useState<ChallengeState>("idle");
  const pendingRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const handleChallenge = useCallback(async () => {
    if (state !== "idle" || !currentPlayer) return;
    setState("sending");
    const result = await sendChallenge(currentPlayer, onlinePlayer.playerId, lang);
    if (!result) { setState("idle"); return; }
    pendingRef.current = result.challengeId;
    setState("waiting");
    pollRef.current = setInterval(async () => {
      if (!pendingRef.current) { clearInterval(pollRef.current!); return; }
      const status = await pollChallengeStatus(pendingRef.current);
      if (status.status === "accepted") {
        clearInterval(pollRef.current!);
        pendingRef.current = null;
        setLocation(`/room/${status.roomCode}`);
      } else if (status.status === "declined" || status.status === "expired") {
        clearInterval(pollRef.current!);
        pendingRef.current = null;
        setState("idle");
      }
    }, 2500);
    setTimeout(() => {
      if (pollRef.current) clearInterval(pollRef.current);
      pendingRef.current = null;
      setState("idle");
    }, 60000);
  }, [state, currentPlayer, onlinePlayer.playerId]);

  if (onlinePlayer.roomCode) {
    return (
      <CopyJoinBtn roomCode={onlinePlayer.roomCode} />
    );
  }

  if (state === "waiting") {
    return (
      <span className="flex items-center gap-1 px-2 py-1 text-[11px] text-yellow-400/80 font-bold flex-shrink-0">
        <Clock size={11} /> Esperando…
      </span>
    );
  }

  return (
    <button
      onClick={(e) => { e.stopPropagation(); handleChallenge(); }}
      disabled={state === "sending"}
      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
      style={{ background: "rgba(249,168,37,0.12)", border: "1px solid rgba(249,168,37,0.3)", color: "#f9a825" }}
      title="Retar a este jugador"
    >
      {state === "sending"
        ? <div className="w-3 h-3 border border-yellow-400/40 border-t-yellow-400 rounded-full animate-spin" />
        : <Swords size={11} />}
      Retar
    </button>
  );
}

function CopyJoinBtn({ roomCode }: { roomCode: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigator.clipboard.writeText(roomCode).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  };
  return (
    <button
      onClick={handleCopy}
      className="flex-shrink-0 flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-bold transition-all"
      style={
        copied
          ? { background: "rgba(74,222,128,0.15)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }
          : { background: "rgba(249,168,37,0.12)", border: "1px solid rgba(249,168,37,0.3)", color: "#f9a825" }
      }
      title={`Unirse a sala ${roomCode}`}
    >
      {copied ? <><Check size={11} />Copiado</> : <><Copy size={11} />Unirse</>}
    </button>
  );
}

function useWeekCountdown(nextReset?: string) {
  const [timeLeft, setTimeLeft] = useState("");
  useEffect(() => {
    if (!nextReset) return;
    const target = new Date(nextReset).getTime();
    const update = () => {
      const diff = target - Date.now();
      if (diff <= 0) { setTimeLeft("0h 0m"); return; }
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      setTimeLeft(h >= 24 ? `${Math.floor(h / 24)}d ${h % 24}h` : `${h}h ${m}m`);
    };
    update();
    const t = setInterval(update, 60000);
    return () => clearInterval(t);
  }, [nextReset]);
  return timeLeft;
}

export default function Ranking() {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, isLoading } = useGetLeaderboard({ limit: 100 }, {
    query: { refetchOnMount: "always", staleTime: 0 } as any
  });
  const { player } = usePlayer();
  const { t, lang } = useT();
  const isLoggedInPlayer = !!(player && player.loginMethod !== "guest");
  // Always fetch the current player's own stats (works even if outside top 100)
  const { data: myStats } = useGetPlayerStats(
    player?.id ?? "",
    { query: { enabled: isLoggedInPlayer, refetchOnMount: "always", staleTime: 0 } as any }
  );
  // Weekly ranking
  const { data: weeklyData, isLoading: weeklyLoading } = useQuery({
    queryKey: ["/api/ranking/weekly"],
    queryFn: () => fetch(`${getApiUrl()}/api/ranking/weekly`).then(r => r.json()),
    refetchOnMount: true,
    staleTime: 0,
  });
  const weeklyPlayers: any[] = weeklyData?.players ?? [];
  const weekCountdown = useWeekCountdown(weeklyData?.nextReset);

  const [filter, setFilter] = useState<"global" | "weekly" | "friends">("global");

  // Presence: online players + incoming challenge notifications
  const { onlinePlayers, incomingChallenge, dismissChallenge } = usePresence(
    player?.loginMethod !== "guest" ? player || null : null,
    null,
    lang
  );
  const onlineMap = new Map(onlinePlayers.map((p) => [p.playerId, p]));

  // Follows: who we follow + follow/unfollow actions
  const { isFollowing, follow, unfollow } = useFollows(
    player?.loginMethod !== "guest" ? player?.id || null : null,
    onlinePlayers
  );

  // Friends list for the friends tab (separate fetch to avoid duplicate)
  const [followedIds, setFollowedIds] = useState<Set<string>>(new Set());
  const [followedFriends, setFollowedFriends] = useState<any[]>([]);

  useEffect(() => {
    if (!player?.id) return;
    fetch(`${getApiUrl()}/api/friends/list/${encodeURIComponent(player.id)}`)
      .then(r => r.ok ? r.json() : { friends: [] })
      .then(({ friends }: { friends: any[] }) => {
        setFollowedFriends(friends);
        setFollowedIds(new Set(friends.map((f: any) => f.followedId)));
      })
      .catch(() => {});
  }, [player?.id, isFollowing]);

  // Follow an offline ranking player (no OnlinePlayer data available)
  const followOffline = useCallback(async (p: { playerId: string; playerName: string; avatarColor: string }) => {
    if (!player?.id) return;
    const asOnlinePlayer: OnlinePlayer = {
      playerId: p.playerId,
      name: p.playerName,
      picture: null,
      avatarColor: p.avatarColor || "#e53e3e",
      provider: null,
      roomCode: null,
      lastSeen: Date.now(),
    };
    await follow(asOnlinePlayer);
    setFollowedIds(prev => new Set([...prev, p.playerId]));
  }, [player?.id, follow]);

  const unfollowPlayer = useCallback(async (targetId: string) => {
    await unfollow(targetId);
    setFollowedIds(prev => { const s = new Set(prev); s.delete(targetId); return s; });
  }, [unfollow]);

  const allPlayers = data?.players || [];

  const friendsTabPlayers = (() => {
    if (filter !== "friends") return [];
    const inLeaderboard = allPlayers.filter((p: any) =>
      followedIds.has(p.playerId) || p.playerId === player?.id
    );
    const inLeaderboardIds = new Set(inLeaderboard.map((p: any) => p.playerId));
    const notInLeaderboard: any[] = followedFriends
      .filter((f: any) => !inLeaderboardIds.has(f.followedId) && f.followedId !== player?.id)
      .map((f: any) => ({
        playerId: f.followedId,
        playerName: f.followedName,
        avatarColor: f.followedAvatarColor,
        totalScore: 0,
        gamesPlayed: 0,
        wins: 0,
        noGames: true,
      }));
    return [...inLeaderboard, ...notInLeaderboard];
  })();

  const players =
    filter === "friends" ? friendsTabPlayers :
    filter === "weekly"  ? weeklyPlayers :
    allPlayers;
  const top3 = players.slice(0, 3);
  const rest = players.slice(3);
  const baseList = filter === "weekly" ? weeklyPlayers : allPlayers;
  const myEntry = baseList.find((p: any) => p.playerId === player?.id);
  const myRank = myEntry ? baseList.indexOf(myEntry) + 1 : null;
  const isLoggedIn = player && player.loginMethod !== "guest";
  // If not in the top-100 list, build an entry from personal stats
  const myFallbackEntry = !myEntry && myStats?.score && myStats.score.gamesPlayed > 0
    ? {
        playerId: player?.id,
        playerName: myStats.score.playerName,
        avatarColor: myStats.score.avatarColor || player?.avatarColor,
        totalScore: myStats.score.totalScore,
        gamesPlayed: myStats.score.gamesPlayed,
        wins: myStats.score.wins,
      }
    : null;

  const PODIUM_ORDER = [1, 0, 2];
  const medalColors: Record<number, { bg: string; border: string; size: string; label: string }> = {
    0: { bg: "linear-gradient(135deg, #f9a825, #f57f17)", border: "#f9a825", size: "w-20 h-20 text-3xl", label: "🥇" },
    1: { bg: "linear-gradient(135deg, #9e9e9e, #757575)", border: "#9e9e9e",  size: "w-16 h-16 text-2xl", label: "🥈" },
    2: { bg: "linear-gradient(135deg, #a0522d, #795548)", border: "#a0522d", size: "w-14 h-14 text-xl",  label: "🥉" },
  };

  return (
    <Layout>
      {/* Incoming challenge overlay */}
      {incomingChallenge && (
        <ChallengeNotification challenge={incomingChallenge} onDismiss={dismissChallenge} />
      )}

      <div className="flex-1 flex flex-col max-w-3xl mx-auto w-full py-8 space-y-6">

        <div className="text-center">
          <h1 className="text-4xl md:text-5xl font-display font-black text-white flex items-center justify-center gap-4">
            <Trophy className="w-10 h-10 text-secondary" />
            {t.ranking.title}
            <Trophy className="w-10 h-10 text-secondary" />
          </h1>
          {onlinePlayers.length > 0 && (
            <p className="mt-2 text-xs text-green-400/70 font-bold flex items-center justify-center gap-1.5">
              <span className="inline-block w-1.5 h-1.5 rounded-full bg-green-400 shadow-[0_0_4px_#4ade80]" />
              {onlinePlayers.length} jugador{onlinePlayers.length !== 1 ? "es" : ""} online ahora
            </p>
          )}
        </div>

        <div className="flex justify-center">
          <div className="bg-black/30 p-1 rounded-full flex gap-1">
            <button
              className={`px-4 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${filter === "global" ? "bg-secondary text-black shadow-md" : "text-white hover:bg-white/10"}`}
              onClick={() => setFilter("global")}
            >
              <Trophy className="w-4 h-4" />
              {lang === "en" ? "Global" : lang === "pt" ? "Global" : lang === "fr" ? "Global" : "Global"}
            </button>
            <button
              className={`px-4 py-2 rounded-full font-bold transition-all flex items-center gap-2 relative ${filter === "weekly" ? "bg-amber-500 text-black shadow-md" : "text-white hover:bg-white/10"}`}
              onClick={() => setFilter("weekly")}
            >
              <CalendarClock className="w-4 h-4" />
              {lang === "en" ? "Week" : lang === "pt" ? "Semana" : lang === "fr" ? "Semaine" : "Semana"}
              <span className="absolute -top-1.5 -right-1 text-[9px] font-black bg-amber-400 text-black rounded-full px-1 leading-tight">NEW</span>
            </button>
            <button
              className={`px-4 py-2 rounded-full font-bold transition-all flex items-center gap-2 ${filter === "friends" ? "bg-secondary text-black shadow-md" : "text-white hover:bg-white/10"}`}
              onClick={() => setFilter("friends")}
            >
              <Users className="w-4 h-4" />
              {lang === "en" ? "Friends" : lang === "pt" ? "Amigos" : lang === "fr" ? "Amis" : "Amigos"}
            </button>
          </div>
        </div>

        {/* Weekly countdown banner */}
        {filter === "weekly" && weekCountdown && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex items-center justify-center gap-2 py-2 px-4 rounded-2xl text-sm font-bold"
            style={{ background: "rgba(245,158,11,0.12)", border: "1px solid rgba(245,158,11,0.3)", color: "#f59e0b" }}
          >
            <CalendarClock className="w-4 h-4 flex-shrink-0" />
            {lang === "en" ? `Resets in ${weekCountdown}` :
             lang === "pt" ? `Reinicia em ${weekCountdown}` :
             lang === "fr" ? `Réinitialise dans ${weekCountdown}` :
             `Reinicia en ${weekCountdown}`}
            {" "}·{" "}
            {lang === "en" ? "Who will win this week?" :
             lang === "pt" ? "Quem vai ganhar esta semana?" :
             lang === "fr" ? "Qui va gagner cette semaine ?" :
             "¿Quién gana esta semana?"}
          </motion.div>
        )}

        {(filter === "weekly" ? weeklyLoading : isLoading) ? (
          <div className="space-y-3">
            {[1,2,3,4,5].map(i => (
              <div key={i} className="h-16 bg-white/10 rounded-xl animate-pulse" />
            ))}
          </div>
        ) : players.length === 0 && filter === "friends" ? (
          <div className="p-16 text-center text-white/50 font-bold bg-black/20 rounded-2xl border border-white/10">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>Ningún amigo aparece en el ranking aún.</p>
            <p className="text-sm mt-2 text-white/30">
              Agrega amigos desde el ranking global con el botón <UserPlus className="inline w-3 h-3" /> Agregar.
            </p>
          </div>
        ) : players.length === 0 && filter === "weekly" ? (
          <div className="p-16 text-center text-white/50 font-bold bg-black/20 rounded-2xl border border-white/10">
            <CalendarClock className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p className="text-lg">
              {lang === "en" ? "No games this week yet. Be the first!" :
               lang === "pt" ? "Nenhum jogo esta semana ainda. Sê o primeiro!" :
               lang === "fr" ? "Aucune partie cette semaine. Sois le premier !" :
               "Nadie ha jugado esta semana aún. ¡Sé el primero!"}
            </p>
          </div>
        ) : players.length === 0 ? (
          <div className="p-16 text-center text-white/50 font-bold bg-black/20 rounded-2xl border border-white/10">
            <Trophy className="w-12 h-12 mx-auto mb-4 opacity-20" />
            <p>{t.ranking.noRanking}</p>
          </div>
        ) : (
          <>
            {filter === "friends" && followedFriends.length > 0 && friendsTabPlayers.some((p: any) => p.noGames) && (
              <div className="px-3 py-2 bg-white/5 border border-white/10 rounded-xl text-xs text-white/40 text-center">
                {friendsTabPlayers.filter((p: any) => p.noGames).length === 1
                  ? "1 amigo aún no ha jugado una partida registrada."
                  : `${friendsTabPlayers.filter((p: any) => p.noGames).length} amigos aún no han jugado una partida registrada.`}
              </div>
            )}

            {/* ── PODIUM ── */}
            {top3.length > 0 && (
              <div className="flex items-end justify-center gap-4 py-4">
                {PODIUM_ORDER.map(visualIdx => {
                  const p = top3[visualIdx];
                  if (!p) return <div key={visualIdx} className="w-24" />;
                  const m = medalColors[visualIdx];
                  const isMe = p.playerId === player?.id;
                  const podiumHeights = ["h-28", "h-20", "h-16"];
                  const isOnline = onlineMap.has(p.playerId);
                  const onlineData = onlineMap.get(p.playerId);
                  const alreadyFollowing = isFollowing(p.playerId) || followedIds.has(p.playerId);

                  return (
                    <motion.div
                      key={p.playerId}
                      initial={{ opacity: 0, y: 40 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: visualIdx * 0.15, type: "spring", bounce: 0.4 }}
                      className="flex flex-col items-center gap-2"
                    >
                      <span className="text-2xl">{m.label}</span>
                      <motion.div
                        animate={visualIdx === 0 ? { y: [0, -4, 0] } : {}}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className={`${m.size} rounded-full flex items-center justify-center font-black text-white shadow-xl border-4 relative`}
                        style={{ background: p.avatarColor || "#555", borderColor: m.border }}
                      >
                        {p.playerName.charAt(0).toUpperCase()}
                        {isMe && (
                          <span className="absolute -top-2 -right-2 bg-secondary text-black text-[9px] font-black px-1.5 py-0.5 rounded-full">{t.game.you.toUpperCase()}</span>
                        )}
                        {isOnline && !isMe && (
                          <span className="absolute -bottom-1 -right-1 w-3.5 h-3.5 rounded-full bg-green-400 border-2 border-[hsl(222_47%_11%)] shadow-[0_0_6px_#4ade80]" />
                        )}
                      </motion.div>
                      <div className="text-center">
                        <p className="font-black text-sm truncate max-w-[80px]">{p.playerName}</p>
                        <p className={`font-black ${(p as any).noGames ? "text-white/30 text-xs" : "text-secondary"}`}>
                          {(p as any).noGames ? "Sin partidas" : `${p.totalScore} ${t.game.points}`}
                        </p>
                      </div>

                      {/* Podium action buttons */}
                      {!isMe && isLoggedIn && (
                        <div className="flex flex-col items-center gap-1">
                          <FollowBtn
                            isFollowing={alreadyFollowing}
                            onToggle={() =>
                              alreadyFollowing
                                ? unfollowPlayer(p.playerId)
                                : followOffline(p)
                            }
                          />
                          {isOnline && onlineData && (
                            <ChallengeBtn onlinePlayer={onlineData} currentPlayer={player} lang={lang} />
                          )}
                        </div>
                      )}

                      <div
                        className={`${podiumHeights[visualIdx]} w-24 rounded-t-xl flex items-end justify-center pb-2`}
                        style={{ background: `linear-gradient(to bottom, ${m.border}33, ${m.border}11)`, border: `1px solid ${m.border}44` }}
                      >
                        <span className="font-black text-2xl opacity-30">#{visualIdx + 1}</span>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            )}

            {/* ── MY POSITION CARD ── */}
            {(() => {
              // On weekly: only show if the user is IN the weekly list (no global-stats fallback)
              // On global: show from list or fallback from personal stats
              const displayEntry =
                filter === "weekly"
                  ? (myEntry && myRank && myRank > 3 ? myEntry : null)
                  : (myEntry && myRank && myRank > 3 ? myEntry : myFallbackEntry);
              const displayRank = myRank && myRank > 3 ? myRank : null;
              if (!displayEntry || filter === "friends") return null;
              return (
                <Card className="p-3 bg-secondary/10 border border-secondary/30">
                  <div className="flex items-center gap-3">
                    <span className="text-secondary font-black text-lg w-10 text-center">
                      {displayRank ? `#${displayRank}` : "—"}
                    </span>
                    <div className="w-9 h-9 rounded-full flex items-center justify-center text-white font-bold shadow" style={{ backgroundColor: (displayEntry as any).avatarColor || "#555" }}>
                      {(displayEntry as any).playerName?.charAt(0).toUpperCase()}
                    </div>
                    <span className="flex-1 font-black">{(displayEntry as any).playerName} <span className="text-secondary text-xs">({t.game.you})</span></span>
                    <span className="text-white/60 text-sm">{(displayEntry as any).gamesPlayed}</span>
                    <span className="text-secondary font-black text-lg">{(displayEntry as any).totalScore} {t.game.points}</span>
                  </div>
                </Card>
              );
            })()}

            {/* ── REST OF LIST ── */}
            {rest.length > 0 && (
              <Card className="p-2 bg-black/20 border-white/10 shadow-xl">
                <div className="grid grid-cols-[36px_1fr_64px_auto] gap-2 px-3 py-2 text-xs font-bold text-white/40 uppercase tracking-wider">
                  <div className="text-center">#</div>
                  <div>{t.ranking.player}</div>
                  <div className="text-right">{t.ranking.score}</div>
                  <div />
                </div>
                <div className="flex flex-col gap-1">
                  {rest.map((p: any, idx: number) => {
                    const position = filter === "global" ? idx + 4 : players.indexOf(p) + 1;
                    const isMe = p.playerId === player?.id;
                    const isOnline = onlineMap.has(p.playerId);
                    const onlineData = onlineMap.get(p.playerId);
                    const alreadyFollowing = isFollowing(p.playerId) || followedIds.has(p.playerId);

                    return (
                      <motion.div
                        key={p.playerId}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.04 }}
                        className={`grid grid-cols-[36px_1fr_64px_auto] gap-2 px-3 py-2.5 items-center rounded-xl ${
                          isMe
                            ? "bg-secondary text-black font-black shadow-md shadow-secondary/20"
                            : p.noGames
                            ? "bg-white/5 border border-white/5 text-white/40 font-bold"
                            : "bg-card/60 hover:bg-card border border-white/5 text-white font-bold"
                        }`}
                      >
                        {/* Position */}
                        <div className={`text-center font-bold text-sm ${isMe ? "text-black/60" : "text-white/30"}`}>
                          {p.noGames ? "-" : position}
                        </div>

                        {/* Player name + online dot */}
                        <div className="flex items-center gap-2 overflow-hidden">
                          <div className="relative flex-shrink-0">
                            <div
                              className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs shadow"
                              style={{ backgroundColor: p.avatarColor || "#555" }}
                            >
                              {p.playerName.charAt(0).toUpperCase()}
                            </div>
                            {isOnline && (
                              <span className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-green-400 border-2 border-[hsl(222_47%_11%)] shadow-[0_0_4px_#4ade80]" />
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-center gap-1.5">
                              <span className="truncate text-sm">{p.playerName}</span>
                              {isMe && <span className={`text-[10px] font-bold ${isMe ? "text-black/50" : "text-white/40"}`}>({t.game.you})</span>}
                            </div>
                            {isOnline && !isMe && (
                              <p className="text-[10px] text-green-400/80 font-medium leading-none mt-0.5">
                                {onlineData?.roomCode ? `En sala: ${onlineData.roomCode}` : "En el menú"}
                              </p>
                            )}
                          </div>
                        </div>

                        {/* Score */}
                        <div className={`text-right font-black ${isMe ? "text-black" : p.noGames ? "text-white/30" : "text-secondary"}`}>
                          {p.noGames ? "—" : p.totalScore}
                        </div>

                        {/* Actions */}
                        <div className="flex items-center gap-1 justify-end">
                          {!isMe && isLoggedIn && (
                            <>
                              <FollowBtn
                                isFollowing={alreadyFollowing}
                                onToggle={() =>
                                  alreadyFollowing
                                    ? unfollowPlayer(p.playerId)
                                    : followOffline(p)
                                }
                              />
                              {isOnline && onlineData && (
                                <ChallengeBtn onlinePlayer={onlineData} currentPlayer={player} lang={lang} />
                              )}
                            </>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </Card>
            )}
          </>
        )}
      </div>
    </Layout>
  );
}
