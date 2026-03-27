import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import type { AchievementDef } from "@/hooks/useAchievements";

interface AchievementToastProps {
  achievement: AchievementDef | null;
  onDone: () => void;
  tAchievements: {
    new: string;
    xpBonus: string;
    [key: string]: string;
  };
}

export function AchievementToast({ achievement, onDone, tAchievements }: AchievementToastProps) {
  useEffect(() => {
    if (!achievement) return;
    const t = setTimeout(onDone, 3800);
    return () => clearTimeout(t);
  }, [achievement, onDone]);

  const name = achievement ? (tAchievements[achievement.nameKey] ?? achievement.nameKey) : "";

  return (
    <AnimatePresence>
      {achievement && (
        <motion.div
          key={achievement.id}
          initial={{ y: -90, opacity: 0, scale: 0.85 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: -90, opacity: 0, scale: 0.85 }}
          transition={{ type: "spring", bounce: 0.5 }}
          className="fixed top-4 left-0 right-0 flex justify-center z-[100] pointer-events-none px-4"
        >
          <div
            className="flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl max-w-sm w-full"
            style={{
              background: "linear-gradient(135deg, hsl(222 47% 14%), hsl(222 47% 20%))",
              border: "2px solid rgba(249,168,37,0.6)",
              boxShadow: "0 8px 40px rgba(249,168,37,0.2), 0 4px 20px rgba(0,0,0,0.6)",
            }}
          >
            <motion.span
              animate={{ rotate: [0, -10, 10, -5, 0], scale: [1, 1.3, 1] }}
              transition={{ duration: 0.5, delay: 0.1 }}
              className="text-3xl flex-shrink-0"
            >
              {achievement.icon}
            </motion.span>
            <div className="flex-1 min-w-0">
              <p className="text-[#f9a825] font-black text-xs uppercase tracking-wider">{tAchievements.new}</p>
              <p className="text-white font-black text-base leading-tight truncate">{name}</p>
            </div>
            <div
              className="flex-shrink-0 px-2 py-1 rounded-lg font-black text-sm"
              style={{ background: "rgba(249,168,37,0.2)", color: "#f9a825" }}
            >
              +{achievement.xpReward} XP
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
