import { useState, useCallback } from "react";

const STORAGE_KEY = "stop_best_score_v2";

type GameMode = "normal" | "quick" | "chaos" | "daily";
type BestScores = Partial<Record<GameMode, number>>;

export function usePersonalBest(mode: GameMode) {
  const [bests, setBests] = useState<BestScores>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  });

  const best = bests[mode] ?? 0;

  const updateBest = useCallback((score: number): { isNew: boolean; diff: number } => {
    const prev = bests[mode] ?? 0;
    const isNew = score > prev;
    if (isNew) {
      const updated: BestScores = { ...bests, [mode]: score };
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(updated)); } catch {}
      setBests(updated);
    }
    return { isNew, diff: score - prev };
  }, [bests, mode]);

  return { best, updateBest };
}
