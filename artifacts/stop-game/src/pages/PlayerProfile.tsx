import { useParams, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { Layout } from "@/components/Layout";
import { Button } from "@/components/ui";
import {
  Trophy, Flame, Gamepad2, Users, Star, ArrowLeft,
  UserPlus, UserCheck, Clock, Sword, Crown,
} from "lucide-react";
import { motion } from "framer-motion";
import { usePlayer } from "@/hooks/use-player";
import { getApiUrl } from "@/lib/utils";
import { useFollows } from "@/lib/useFollows";
import { useCallback, useState } from "react";
import { type OnlinePlayer } from "@/lib/usePresence";

// ── Level system based on total games played ───────────────────────────────
const LEVELS = [
  { min: 0,   max: 4,   label: "Principiante", icon: "🌱", color: "#6b7280" },
  { min: 5,   max: 14,  label: "Amateur",       icon: "🎮", color: "#3b82f6" },
  { min: 15,  max: 29,  label: "Aficionado",    icon: "⚔️", color: "#8b5cf6" },
  { min: 30,  max: 49,  label: "Veterano",      icon: "🛡️", color: "#f59e0b" },
  { min: 50,  max: 99,  label: "Experto",       icon: "🔥", color: "#ef4444" },
  { min: 100, max: 199, label: "Maestro",       icon: "⭐", color: "#f97316" },
  { min: 200, max: Infinity, label: "Leyenda",  icon: "👑", color: "#eab308" },
];

function getLevel(gamesPlayed: number) {
  return LEVELS.find(l => gamesPlayed >= l.min && gamesPlayed <= l.max) ?? LEVELS[0];
}

function getLevelProgress(gamesPlayed: number) {
  const lvl = getLevel(gamesPlayed);
  if (lvl.max === Infinity) return 100;
  const span = lvl.max - lvl.min + 1;
  return Math.round(((gamesPlayed - lvl.min) / span) * 100);
}

// ── Mode labels ────────────────────────────────────────────────────────────
const MODE_LABELS: Record<string, { label: string; icon: string }> = {
  solo:        { label: "Solo",        icon: "🎯" },
  multiplayer: { label: "Multijugador",icon: "👥" },
  daily:       { label: "Diario",      icon: "📅" },
  blitz:       { label: "Blitz",       icon: "⚡" },
  challenge:   { label: "Reto",        icon: "🏆" },
};

// ── Helpers ────────────────────────────────────────────────────────────────
function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="flex flex-col items-center gap-1 p-4 bg-black/30 rounded-2xl border border-white/10">
      <span className="text-2xl font-black text-secondary">{value}</span>
      <span className="text-xs font-bold text-white/50 text-center leading-tight">{label}</span>
    </div>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  const h = Math.floor(diff / 3600000);
  const d = Math.floor(diff / 86400000);
  if (m < 1)  return "ahora mismo";
  if (m < 60) return `hace ${m}m`;
  if (h < 24) return `hace ${h}h`;
  if (d < 7)  return `hace ${d}d`;
  return new Date(dateStr).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

// ── Component ──────────────────────────────────────────────────────────────
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
  const recentGames: any[] = data.recentGames ?? [];
  const level = getLevel(data.gamesPlayed);
  const progress = getLevelProgress(data.gamesPlayed);
  const nextLevel = LEVELS[LEVELS.indexOf(level) + 1];

  return (
    <Layout>
      <div className="flex-1 flex flex-col max-w-md mx-auto w-full py-6 gap-6 pb-10">

        {/* Back button */}
        <button
          onClick={() => setLocation("/ranking")}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm font-bold transition-colors self-start"
        >
          <ArrowLeft size={16} /> Ranking
        </button>

        {/* ── HERO: Avatar + nombre + título + rango ── */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-3"
        >
          <div className="relative">
            <div
              className="w-24 h-24 rounded-full flex items-center justify-center text-4xl font-black text-white shadow-2xl border-4"
              style={{ backgroundColor: data.avatarColor || "#e53e3e", borderColor: level.color + "88" }}
            >
              {data.playerName?.charAt(0).toUpperCase()}
            </div>
            <span
              className="absolute -bottom-1 -right-1 text-xl"
              title={level.label}
            >
              {level.icon}
            </span>
          </div>

          <div className="text-center">
            <h1 className="text-3xl font-display font-black">{data.playerName}</h1>
            <p className="font-bold mt-0.5" style={{ color: "#f9a825" }}>{data.title}</p>
            <p className="text-white/40 text-sm mt-0.5">Puesto #{data.globalRank} global</p>
            {data.isPremium && (
              <motion.div
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                className="inline-flex items-center gap-1.5 mt-2 px-3 py-1 rounded-full"
                style={{ background: "linear-gradient(135deg, rgba(249,168,37,0.2), rgba(245,124,0,0.15))", border: "1.5px solid rgba(249,168,37,0.5)" }}
              >
                <Crown className="w-3.5 h-3.5 text-[#f9a825]" />
                <span className="text-xs font-black text-[#f9a825]">PREMIUM</span>
              </motion.div>
            )}
          </div>

          {/* Follow / "Tú" badge */}
          {isMe ? (
            <span className="px-4 py-1.5 rounded-full text-xs font-black bg-secondary/20 text-secondary border border-secondary/40">
              Tu perfil
            </span>
          ) : isLoggedIn && (
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

        {/* ── NIVEL con barra de progreso ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05 }}
          className="p-4 bg-black/30 rounded-2xl border border-white/10"
        >
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <span className="text-2xl">{level.icon}</span>
              <div>
                <p className="font-black text-sm" style={{ color: level.color }}>Nivel: {level.label}</p>
                <p className="text-xs text-white/40">{data.gamesPlayed} partidas jugadas</p>
              </div>
            </div>
            {nextLevel && (
              <p className="text-[11px] text-white/30 text-right">
                Siguiente:<br />
                <span className="font-bold" style={{ color: nextLevel.color }}>{nextLevel.icon} {nextLevel.label}</span>
              </p>
            )}
          </div>
          <div className="h-2 bg-white/10 rounded-full overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${progress}%` }}
              transition={{ delay: 0.3, duration: 0.8, ease: "easeOut" }}
              className="h-full rounded-full"
              style={{ background: `linear-gradient(to right, ${level.color}88, ${level.color})` }}
            />
          </div>
          {nextLevel && (
            <p className="text-[10px] text-white/30 mt-1 text-right">
              {nextLevel.min - data.gamesPlayed} partidas para {nextLevel.label}
            </p>
          )}
        </motion.div>

        {/* ── RACHA ── */}
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
                <Flame className="w-6 h-6" />{data.currentStreak}
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

        {/* ── ESTADÍSTICAS GLOBALES ── */}
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

        {/* ── PUNTOS DEL MES ── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="flex items-center gap-3 p-4 rounded-2xl border border-white/10 bg-black/20"
        >
          <Star className="w-6 h-6 text-amber-400 flex-shrink-0" />
          <div>
            <p className="font-black text-white">
              {data.monthlyScore} pts{" "}
              <span className="text-amber-400">este mes</span>
            </p>
            <p className="text-xs text-white/40">Ranking mensual activo</p>
          </div>
        </motion.div>

        {/* ── STATS POR MODO ── */}
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
                const winRate = s.games > 0 ? Math.round((s.wins / s.games) * 100) : 0;
                return (
                  <div
                    key={mode}
                    className="flex items-center gap-4 p-3 bg-black/20 rounded-xl border border-white/10"
                  >
                    <span className="text-2xl">{meta.icon}</span>
                    <div className="flex-1">
                      <p className="font-bold text-sm">{meta.label}</p>
                      <p className="text-xs text-white/40">
                        {s.games} partidas · {s.wins} victorias ({winRate}%)
                      </p>
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

        {/* ── HISTORIAL DE PARTIDAS ── */}
        {recentGames.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="space-y-3"
          >
            <h2 className="font-display font-black text-lg flex items-center gap-2">
              <Clock className="w-5 h-5 text-secondary" />
              Últimas partidas
            </h2>
            <div className="space-y-1.5">
              {recentGames.map((g, i) => {
                const meta = MODE_LABELS[g.mode] ?? { label: g.mode, icon: "🎮" };
                return (
                  <motion.div
                    key={g.id}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: 0.3 + i * 0.04 }}
                    className="flex items-center gap-3 px-4 py-2.5 bg-black/20 rounded-xl border border-white/10"
                  >
                    <span className="text-lg">{meta.icon}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{meta.label}</span>
                        {g.letter && (
                          <span className="text-[11px] bg-white/10 px-1.5 py-0.5 rounded font-black text-white/60">
                            {g.letter}
                          </span>
                        )}
                        {g.won && (
                          <span className="text-[10px] bg-secondary/20 text-secondary border border-secondary/30 px-1.5 py-0.5 rounded-full font-black">
                            GANÓ
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-white/30">{timeAgo(g.createdAt)}</p>
                    </div>
                    <span className="font-black text-secondary text-sm flex-shrink-0">
                      +{g.score} pts
                    </span>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>
        )}

        {/* ── ACCIÓN FINAL ── */}
        {!isMe && (
          <Button
            variant="secondary"
            size="lg"
            className="w-full mt-2"
            onClick={() => setLocation("/multiplayer")}
          >
            <Sword className="w-4 h-4 mr-2" />
            Retar a una partida
          </Button>
        )}
        {isMe && (
          <Button
            size="lg"
            className="w-full mt-2"
            onClick={() => setLocation("/")}
          >
            Jugar ahora
          </Button>
        )}

      </div>
    </Layout>
  );
}
