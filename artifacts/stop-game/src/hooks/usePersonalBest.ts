import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl } from "@/lib/utils";

const STORAGE_KEY = "stop_best_score_v2";

type GameMode = "normal" | "quick" | "chaos" | "daily" | "random";
type BestScores = Partial<Record<GameMode, number>>;

/**
 * The backend already exposes per-mode best scores through
 * /api/ranking/profile/:playerId. The old implementation called the removed
 * /api/ranking/progress/:playerId endpoint, which produced a 404 on the web.
 */
async function syncBestsFromServer(playerId: string): Promise<BestScores> {
  try {
    const r = await fetch(`${getApiUrl()}/api/ranking/profile/${encodeURIComponent(playerId)}`, {
      credentials: "include",
    });
    if (!r.ok) return {};
    const data = await r.json();
    const modeStats = data?.modeStats;
    if (!modeStats || typeof modeStats !== "object") return {};

    const bests: BestScores = {};
    for (const [mode, stats] of Object.entries(modeStats as Record<string, { bestScore?: number }>)) {
      const score = Number(stats?.bestScore ?? 0);
      if (score >= 0) bests[mode as GameMode] = score;
    }
    return bests;
  } catch {
    return {};
  }
}

export function usePersonalBest(mode: GameMode, playerId?: string) {
  const [bests, setBests] = useState<BestScores>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  });
  const syncedRef = useRef(false);

  // Server history is the source of truth for the initial best score.
  useEffect(() => {
    if (!playerId || syncedRef.current) return;
    syncedRef.current = true;
    syncBestsFromServer(playerId).then(serverBests => {
      if (Object.keys(serverBests).length === 0) return;
      setBests(prev => {
        const merged: BestScores = { ...prev };
        let changed = false;
        for (const [m, score] of Object.entries(serverBests)) {
          if ((merged[m as GameMode] ?? 0) < (score as number)) {
            merged[m as GameMode] = score as number;
            changed = true;
          }
        }
        if (changed) {
          try { localStorage.setItem(STORAGE_KEY, JSON.stringify(merged)); } catch {}
          return merged;
        }
        return prev;
      });
    });
  }, [playerId]);

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
