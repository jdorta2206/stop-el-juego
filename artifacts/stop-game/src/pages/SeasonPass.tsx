import { useMemo } from "react";
import { Layout } from "@/components/Layout";
import { motion } from "framer-motion";
import { Crown, Gift, Lock, Star, Sparkles, CheckCircle2 } from "lucide-react";
import { useSeason, type Mission, type TierReward } from "@/hooks/useSeason";
import { usePlayer } from "@/hooks/use-player";
import { usePremium } from "@/lib/usePremium";
import { useState } from "react";
import { PremiumModal } from "@/components/PremiumModal";

const MISSION_LABELS: Record<string, string> = {
  winOne:    "Gana 1 partida",
  playTwo:   "Juega 2 partidas",
  playThree: "Juega 3 partidas",
  score30:   "Saca 30 puntos en una ronda",
  score50:   "Saca 50 puntos en una ronda",
  streak3:   "Mantén una racha de 3 días",
  valid15:   "Consigue 15 palabras válidas",
  dailyDone: "Completa el reto diario",
};

function daysLeft(endDate: string): number {
  const end = new Date(endDate + "T23:59:59Z").getTime();
  const now = Date.now();
  return Math.max(0, Math.ceil((end - now) / 86_400_000));
}

function MissionRow({ mission, onClaim }: { mission: Mission; onClaim: (id: string) => void }) {
  const label = MISSION_LABELS[mission.i18nKey] ?? mission.i18nKey;
  const pct = Math.min(100, (mission.progress / mission.target) * 100);
  return (
    <div
      className="w-full p-3 rounded-xl"
      style={{
        background: mission.completed && !mission.claimed
          ? "linear-gradient(135deg, rgba(249,168,37,0.18), rgba(220,38,38,0.10))"
          : "rgba(255,255,255,0.05)",
        border: mission.completed && !mission.claimed
          ? "1.5px solid rgba(249,168,37,0.55)"
          : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div className="flex items-center justify-between mb-1.5">
        <div className="flex items-center gap-2 min-w-0">
          {mission.claimed ? (
            <CheckCircle2 className="w-4 h-4 text-green-400 flex-shrink-0" />
          ) : mission.completed ? (
            <Sparkles className="w-4 h-4 text-[#f9a825] flex-shrink-0" />
          ) : (
            <Star className="w-4 h-4 text-white/40 flex-shrink-0" />
          )}
          <p className="text-white font-bold text-sm truncate">{label}</p>
        </div>
        <span className="text-[#f9a825] font-black text-xs flex-shrink-0">+{mission.xpReward} XP</span>
      </div>
      <div className="flex items-center gap-2">
        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: "rgba(255,255,255,0.08)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${pct}%`,
              background: mission.completed
                ? "linear-gradient(90deg, #f9a825, #dc2626)"
                : "linear-gradient(90deg, #6366f1, #8b5cf6)",
            }}
          />
        </div>
        <span className="text-white/60 text-xs font-mono min-w-[44px] text-right">
          {Math.min(mission.progress, mission.target)}/{mission.target}
        </span>
        {mission.completed && !mission.claimed && (
          <button
            onClick={() => onClaim(mission.id)}
            className="px-3 py-1 rounded-lg text-xs font-black"
            style={{ background: "#f9a825", color: "#0d1757" }}
          >
            Reclamar
          </button>
        )}
      </div>
    </div>
  );
}

function TierCard({
  reward, currentTier, claimed, onClaim, isPremium, onPremiumClick,
}: {
  reward: TierReward;
  currentTier: number;
  claimed: { free: number[]; premium: number[] };
  onClaim: (tier: number, track: "free" | "premium") => void;
  isPremium: boolean;
  onPremiumClick: () => void;
}) {
  const unlocked = currentTier >= reward.tier;
  const freeClaimed = claimed.free.includes(reward.tier);
  const premClaimed = claimed.premium.includes(reward.tier);

  return (
    <div
      className="flex flex-col items-center min-w-[110px] rounded-xl p-2 gap-1.5"
      style={{
        background: unlocked
          ? "linear-gradient(180deg, rgba(249,168,37,0.10), rgba(13,23,87,0.4))"
          : "rgba(255,255,255,0.03)",
        border: unlocked ? "1.5px solid rgba(249,168,37,0.4)" : "1px solid rgba(255,255,255,0.08)",
      }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center font-black text-sm"
        style={{
          background: unlocked ? "linear-gradient(135deg, #f9a825, #dc2626)" : "rgba(255,255,255,0.08)",
          color: unlocked ? "white" : "rgba(255,255,255,0.4)",
        }}
      >
        {reward.tier}
      </div>

      {/* Free reward */}
      <button
        onClick={() => unlocked && !freeClaimed && onClaim(reward.tier, "free")}
        disabled={!unlocked || freeClaimed}
        className="w-full text-[10px] rounded-lg p-1.5 font-bold leading-tight"
        style={{
          background: freeClaimed
            ? "rgba(34,197,94,0.18)"
            : unlocked ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.03)",
          color: freeClaimed ? "#86efac" : unlocked ? "white" : "rgba(255,255,255,0.35)",
          border: freeClaimed ? "1px solid rgba(34,197,94,0.4)" : "1px solid transparent",
        }}
      >
        <Gift className="w-3 h-3 inline mr-0.5" />
        {freeClaimed ? "OK" : reward.free.label}
      </button>

      {/* Premium reward */}
      <button
        onClick={() => {
          if (!isPremium) return onPremiumClick();
          if (unlocked && !premClaimed) onClaim(reward.tier, "premium");
        }}
        disabled={isPremium && (!unlocked || premClaimed)}
        className="w-full text-[10px] rounded-lg p-1.5 font-bold leading-tight"
        style={{
          background: premClaimed
            ? "rgba(34,197,94,0.18)"
            : isPremium && unlocked ? "rgba(249,168,37,0.18)" : "rgba(249,168,37,0.06)",
          color: premClaimed ? "#86efac" : isPremium && unlocked ? "#f9a825" : "rgba(249,168,37,0.5)",
          border: premClaimed
            ? "1px solid rgba(34,197,94,0.4)"
            : "1px solid rgba(249,168,37,0.3)",
        }}
      >
        {!isPremium ? <Lock className="w-3 h-3 inline mr-0.5" /> : <Crown className="w-3 h-3 inline mr-0.5" />}
        {premClaimed ? "OK" : reward.premium.label}
      </button>
    </div>
  );
}

export default function SeasonPass() {
  const { player } = usePlayer();
  const { isPremium } = usePremium(player?.id);
  const { season, progress, claimMission, claimTier } = useSeason(player?.id);
  const [showPremium, setShowPremium] = useState(false);

  const xpToNext = useMemo(() => {
    if (!progress) return { current: 0, next: 100, pct: 0 };
    const tier = progress.currentTier;
    const base = tier * 100;
    const next = (tier + 1) * 100;
    const pct = ((progress.xp - base) / (next - base)) * 100;
    return { current: progress.xp - base, next: next - base, pct: Math.max(0, Math.min(100, pct)) };
  }, [progress]);

  const themeColor = season?.theme?.color ?? "#f9a825";
  const themeName = season?.theme?.name ?? "Season Pass";
  const themeEmoji = season?.theme?.emoji ?? "🎟️";
  const tagline = season?.theme?.tagline ?? "Juega cada día y desbloquea recompensas";

  return (
    <Layout>
      {showPremium && (
        <PremiumModal
          open={showPremium}
          onClose={() => setShowPremium(false)}
          playerId={player?.id || "guest"}
          playerName={player?.name || ""}
          isPremium={isPremium}
        />
      )}

      <div className="flex-1 max-w-md mx-auto w-full py-4 space-y-4">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4"
          style={{
            background: `linear-gradient(135deg, ${themeColor}33, rgba(13,23,87,0.6))`,
            border: `1.5px solid ${themeColor}66`,
          }}
        >
          <div className="flex items-center gap-3 mb-3">
            <div className="text-4xl">{themeEmoji}</div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] uppercase font-black tracking-widest" style={{ color: themeColor }}>
                Temporada
              </p>
              <h1 className="text-white font-black text-lg leading-tight truncate">{themeName}</h1>
              <p className="text-white/60 text-xs">{tagline}</p>
            </div>
          </div>

          {season && (
            <div className="flex items-center justify-between text-xs text-white/60 mb-2">
              <span>Quedan {daysLeft(season.endDate)} días</span>
              <span>Termina {season.endDate}</span>
            </div>
          )}

          {progress && (
            <>
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-white font-black text-sm">
                  Nivel {progress.currentTier} / {progress.totalTiers}
                </span>
                <span className="text-[#f9a825] font-black text-sm">{progress.xp} XP</span>
              </div>
              <div className="h-2.5 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.3)" }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpToNext.pct}%` }}
                  className="h-full rounded-full"
                  style={{ background: `linear-gradient(90deg, ${themeColor}, #dc2626)` }}
                />
              </div>
              <p className="text-[10px] text-white/50 mt-1 text-right">
                {xpToNext.current}/{xpToNext.next} XP al siguiente nivel
              </p>
            </>
          )}
        </motion.div>

        {/* Premium upsell */}
        {!isPremium && (
          <motion.button
            whileHover={{ scale: 1.01 }}
            whileTap={{ scale: 0.99 }}
            onClick={() => setShowPremium(true)}
            className="w-full p-3 rounded-xl flex items-center gap-3"
            style={{
              background: "linear-gradient(135deg, rgba(249,168,37,0.18), rgba(220,38,38,0.12))",
              border: "1.5px solid rgba(249,168,37,0.5)",
            }}
          >
            <Crown className="w-6 h-6 text-[#f9a825] flex-shrink-0" />
            <div className="flex-1 text-left min-w-0">
              <p className="text-[#f9a825] font-black text-sm">Desbloquea el Pase Premium</p>
              <p className="text-white/70 text-xs">Avatares y marcos exclusivos · €1,99/mes</p>
            </div>
            <span className="text-[#f9a825] font-black">→</span>
          </motion.button>
        )}

        {/* Daily missions */}
        <div className="space-y-2">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-white font-black text-sm uppercase tracking-wider">Misiones de hoy</h2>
            {progress?.hasUnclaimedMissions && (
              <span className="text-[10px] font-black text-[#f9a825] uppercase tracking-wider animate-pulse">
                ¡Hay recompensas!
              </span>
            )}
          </div>
          {!player ? (
            <p className="text-white/50 text-sm text-center py-6">
              Inicia sesión para empezar tu temporada.
            </p>
          ) : progress?.missions?.length ? (
            progress.missions.map((m) => (
              <MissionRow key={m.id} mission={m} onClaim={(id) => claimMission(id)} />
            ))
          ) : (
            <p className="text-white/50 text-sm text-center py-6">Cargando misiones…</p>
          )}
        </div>

        {/* Tiers */}
        <div className="space-y-2">
          <h2 className="text-white font-black text-sm uppercase tracking-wider px-1">
            Recompensas
          </h2>
          {season ? (
            <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 snap-x">
              {season.tiers.map((reward) => (
                <div key={reward.tier} className="snap-start">
                  <TierCard
                    reward={reward}
                    currentTier={progress?.currentTier ?? 0}
                    claimed={progress?.claimedTiers ?? { free: [], premium: [] }}
                    onClaim={(t, track) => claimTier(t, track)}
                    isPremium={isPremium}
                    onPremiumClick={() => setShowPremium(true)}
                  />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-white/50 text-sm text-center py-6">Cargando temporada…</p>
          )}
        </div>
      </div>
    </Layout>
  );
}
