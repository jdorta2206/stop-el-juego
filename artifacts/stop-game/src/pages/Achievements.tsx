import { Link } from "wouter";
import { motion } from "framer-motion";
import { Layout } from "@/components/Layout";
import { Lock, ArrowLeft, Trophy } from "lucide-react";
import { ACHIEVEMENTS, useAchievements } from "@/hooks/useAchievements";
import { usePlayer } from "@/hooks/use-player";
import { useT } from "@/i18n/useT";

export default function Achievements() {
  const { player } = usePlayer();
  const { unlocked } = useAchievements(player?.id);
  const { t } = useT();
  const tA = t.achievements as unknown as Record<string, string>;

  const total = ACHIEVEMENTS.length;
  const got = ACHIEVEMENTS.filter(a => unlocked.has(a.id)).length;
  const pct = Math.round((got / total) * 100);

  return (
    <Layout>
      <div className="w-full max-w-2xl mx-auto px-4 py-4 space-y-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Link href="/">
            <button
              className="p-2 rounded-xl"
              style={{ background: "rgba(0,0,0,0.25)", border: "2px solid rgba(255,255,255,0.15)" }}
              aria-label="Volver"
            >
              <ArrowLeft className="w-5 h-5 text-white" />
            </button>
          </Link>
          <div className="flex items-center gap-2">
            <Trophy className="w-6 h-6 text-[#f9a825]" />
            <h1 className="text-2xl font-black text-white">{tA.title ?? "Logros"}</h1>
          </div>
        </div>

        {/* Progress bar */}
        <motion.div
          initial={{ opacity: 0, y: -6 }}
          animate={{ opacity: 1, y: 0 }}
          className="rounded-2xl p-4"
          style={{
            background: "linear-gradient(135deg, rgba(245,158,11,0.18), rgba(220,38,38,0.12))",
            border: "2px solid rgba(245,158,11,0.45)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex items-baseline justify-between mb-2">
            <span className="text-white font-black text-lg">{got} / {total}</span>
            <span className="text-[#f9a825] font-black text-sm">{pct}%</span>
          </div>
          <div className="h-2 rounded-full overflow-hidden" style={{ background: "rgba(0,0,0,0.35)" }}>
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="h-full"
              style={{ background: "linear-gradient(90deg, #f9a825, #ff6b35)" }}
            />
          </div>
        </motion.div>

        {/* Grid de logros */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {ACHIEVEMENTS.map((a, idx) => {
            const isUnlocked = unlocked.has(a.id);
            const name = tA[a.nameKey] ?? a.nameKey;
            const desc = tA[a.descKey] ?? a.descKey;
            return (
              <motion.div
                key={a.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: idx * 0.03 }}
                className="relative rounded-2xl p-4 flex flex-col items-center text-center"
                style={{
                  background: isUnlocked
                    ? "linear-gradient(135deg, rgba(245,158,11,0.22), rgba(220,38,38,0.14))"
                    : "rgba(0,0,0,0.30)",
                  border: isUnlocked
                    ? "2px solid rgba(245,158,11,0.55)"
                    : "2px solid rgba(255,255,255,0.10)",
                  boxShadow: isUnlocked ? "0 6px 20px rgba(249,168,37,0.15)" : "none",
                  backdropFilter: "blur(8px)",
                  opacity: isUnlocked ? 1 : 0.72,
                }}
              >
                {a.image ? (
                  <img
                    src={a.image}
                    alt={name}
                    width={64}
                    height={64}
                    loading="lazy"
                    className="w-16 h-16 mb-2 select-none"
                    style={{
                      filter: isUnlocked
                        ? "drop-shadow(0 4px 10px rgba(249,168,37,0.35))"
                        : "grayscale(1) brightness(0.55)",
                      transition: "filter 0.4s",
                    }}
                    draggable={false}
                  />
                ) : (
                  <div
                    className="text-4xl mb-2"
                    style={{
                      filter: isUnlocked ? "none" : "grayscale(1) brightness(0.6)",
                    }}
                  >
                    {a.icon}
                  </div>
                )}
                <p className="text-white font-black text-sm leading-tight mb-1">{name}</p>
                <p className="text-white/70 text-xs leading-snug">{desc}</p>
                <div
                  className="mt-2 px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider"
                  style={{
                    background: isUnlocked ? "rgba(249,168,37,0.22)" : "rgba(255,255,255,0.08)",
                    color: isUnlocked ? "#f9a825" : "rgba(255,255,255,0.55)",
                  }}
                >
                  +{a.xpReward} XP
                </div>
                {!isUnlocked && (
                  <div
                    className="absolute top-2 right-2 p-1 rounded-full"
                    style={{ background: "rgba(0,0,0,0.5)" }}
                  >
                    <Lock className="w-3 h-3 text-white/60" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      </div>
    </Layout>
  );
}
