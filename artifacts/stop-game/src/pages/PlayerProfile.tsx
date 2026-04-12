import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import { Trophy, Flame, Gamepad2, Users, Star, ArrowLeft, UserPlus, UserCheck } from "lucide-react";
import { motion } from "framer-motion";
import { usePlayer } from "@/hooks/use-player";
import { getApiUrl } from "@/lib/utils";
import { useFollows } from "@/lib/useFollows";
import { useCallback, useState } from "react";
import { type OnlinePlayer } from "@/lib/usePresence";

const MODE_LABELS: Record<string, { label: string; icon: string }> = {
  solo: { label: "Solo", icon: "🎯" },
  multiplayer: { label: "Multijugador", icon: "👥" },
  daily: { label: "Diario", icon: "📅" },
  blitz: { label: "Blitz", icon: "⚡" },
  challenge: { label: "Reto", icon: "🏆" },
};

function StatCard({ label, value, sub }: { label: string; value: string | number; sub?: string }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 bg-black/30 rounded-2xl border border-white/10">
      <span className="text-2xl font-black text-secondary">{value}</span>
      <span className="text-xs font-bold text-white/50 text-center leading-tight">{label}</span>
      {sub && <span className="text-[10px] text-white/30">{sub}</span>}
    </div>
  );
}

export default function PlayerProfile() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const { player: me } = usePlayer();

  const { data, isLoading, isError } = useQuery({
    queryKey: [`/api/ranking/profile/${id}`],
    queryFn: () =>
      fetch(`${getApiUrl()}/api/ranking/profile/${encodeURIComponent(id!)}`)
        .then(r => { if (!r.ok) throw new Error("not found"); return r.json(); }),
    enabled: !!id,
    staleTime: 30_000,
  });

  const isMe = me?.id === id;
  const isLoggedIn = !!(me && me.loginMethod !== "guest");

  const { isFollowing, follow, unfollow } = useFollows(
    isLoggedIn ? me?.id ?? null : null,
    []
  );
  const [followState, setFollowState] = useState<"idle" | "loading">("idle");
  const alreadyFollowing = isFollowing(id ?? "");

  const handleFollow = useCallback(async () => {
    if (!data || !me || followState === "loading") return;
    setFollowState("loading");
    const asOnlinePlayer: OnlinePlayer = {
      playerId: data.playerId,
      name: data.playerName,
      picture: null,
      avatarColor: data.avatarColor || "#e53e3e",
      provider: null,
      roomCode: null,
      lastSeen: Date.now(),
    };
    if (alreadyFollowing) {
      await unfollow(data.playerId);
    } else {
      await follow(asOnlinePlayer);
    }
    setFollowState("idle");
  }, [data, me, alreadyFollowing, follow, unfollow, followState]);

  if (isLoading) {
    return (
      <Layout>
        <div className="flex-1 flex items-center justify-center">
          <div className="w-10 h-10 border-4 border-secondary border-t-transparent rounded-full animate-spin" />
        </div>
      </Layout>
    );
  }

  if (isError || !data) {
    return (
      <Layout>
        <div className="flex-1 flex flex-col items-center justify-center gap-4 text-white/50">
          <Trophy className="w-16 h-16 opacity-20" />
          <p className="font-bold text-xl">Jugador no encontrado</p>
          <Button onClick={() => setLocation("/ranking")}>
            <ArrowLeft className="w-4 h-4 mr-2" /> Volver al ranking
          </Button>
        </div>
      </Layout>
    );
  }

  const modeKeys = Object.keys(data.modeStats ?? {});

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full py-6 gap-6">

        {/* Back button */}
        <button
          onClick={() => setLocation("/ranking")}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-bold transition-colors self-start"
        >
          <ArrowLeft size={16} /> Ranking
        </button>

        {/* Avatar + name + title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <div
            className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-2xl border-4 border-white/10"
            style={{ backgroundColor: data.avatarColor || "#e53e3e" }}
          >
            {data.playerName?.charAt(0).toUpperCase()}
          </div>
          <div className="text-center">
            <h1 className="text-3xl font-display font-black">{data.playerName}</h1>
            <p className="text-secondary font-bold mt-0.5">{data.title}</p>
            <p className="text-white/40 text-sm mt-0.5">Puesto #{data.globalRank} global</p>
          </div>

          {/* Follow button */}
          {!isMe && isLoggedIn && (
            <button
              onClick={handleFollow}
              disabled={followState === "loading"}
              className="flex items-center gap-2 px-5 py-2 rounded-full font-bold text-sm transition-all"
              style={
                alreadyFollowing
                  ? { background: "rgba(74,222,128,0.12)", border: "1px solid rgba(74,222,128,0.3)", color: "#4ade80" }
                  : { background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.15)", color: "rgba(255,255,255,0.8)" }
              }
            >
              {alreadyFollowing ? <UserCheck size={14} /> : <UserPlus size={14} />}
              {alreadyFollowing ? "Siguiendo" : "Seguir"}
            </button>
          )}
        </motion.div>

        {/* Streak banner */}
        {(data.currentStreak > 0 || data.longestStreak > 0) && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.1 }}
            className="flex items-center justify-around p-4 rounded-2xl border"
            style={{ background: "rgba(249,115,22,0.10)", borderColor: "rgba(249,115,22,0.25)" }}
          >
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-3xl font-black text-orange-400 flex items-center gap-1">
                <Flame className="w-6 h-6" />
                {data.currentStreak}
              </span>
              <span className="text-xs text-white/50 font-bold">Racha actual</span>
            </div>
            <div className="w-px h-10 bg-white/10" />
            <div className="flex flex-col items-center gap-0.5">
              <span className="text-3xl font-black text-orange-300">{data.longestStreak}</span>
              <span className="text-xs text-white/50 font-bold">Mejor racha</span>
            </div>
          </motion.div>
        )}

        {/* Global stats grid */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="grid grid-cols-3 gap-3"
        >
          <StatCard label="Puntos totales" value={data.totalScore} />
          <StatCard label="Partidas" value={data.gamesPlayed} />
          <StatCard label="Victorias" value={data.wins} />
        </motion.div>

        {/* Monthly score */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-black/20"
        >
          <Star className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-black text-white">{data.monthlyScore} pts <span className="text-amber-400">este mes</span></p>
            <p className="text-xs text-white/40">Ranking mensual activo</p>
          </div>
        </motion.div>

        {/* Stats by game mode */}
        {modeKeys.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="space-y-3"
          >
            <h2 className="font-display font-black text-lg flex items-center gap-2">
              <Gamepad2 className="w-5 h-5 text-secondary" />
              Por modo de juego
            </h2>
            <div className="space-y-2">
              {modeKeys.map(mode => {
                const s = data.modeStats[mode];
                const meta = MODE_LABELS[mode] ?? { label: mode, icon: "🎮" };
                return (
                  <div
                    key={mode}
                    className="flex items-center gap-4 p-3 bg-black/20 rounded-xl border border-white/10"
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{meta.label}</p>
                      <p className="text-xs text-white/40">{s.games} partidas · {s.wins} victorias</p>
                    </div>
                    <div className="text-right">
                      <p className="font-black text-secondary">{s.totalScore} pts</p>
                      <p className="text-xs text-white/40">Mejor: {s.bestScore}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* Challenge button */}
        <Button
          variant="secondary"
          size="lg"
          className="w-full mt-2"
          onClick={() => setLocation("/multiplayer")}
        >
          <Users className="w-4 h-4 mr-2" />
          Retar a una partida
        </Button>

      </div>
    </Layout>
  );
}
