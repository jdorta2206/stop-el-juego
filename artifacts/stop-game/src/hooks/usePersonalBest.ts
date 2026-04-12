import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl } from "@/lib/utils";

const STORAGE_KEY = "stop_best_score_v2";

type GameMode = "normal" | "quick" | "chaos" | "daily";
type BestScores = Partial<Record<GameMode, number>>;

async function syncBestsFromServer(playerId: string): Promise<BestScores> {
  try {
    const r = await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`);
    if (!r.ok) return {};
    const data = await r.json();
    return (data.personalBests && typeof data.personalBests === "object") ? data.personalBests : {};
  } catch { return {}; }
}

async function saveBestsToServer(playerId: string, personalBests: BestScores) {
  try {
    await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personalBests }),
    });
  } catch {}
}

export function usePersonalBest(mode: GameMode, playerId?: string) {
  const [bests, setBests] = useState<BestScores>(() => {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}"); }
    catch { return {}; }
  });
  const syncedRef = useRef(false);

  // ── Sync from server on mount (server wins for each mode if higher) ──────
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
      if (playerId) saveBestsToServer(playerId, updated);
    }
    return { isNew, diff: score - prev };
  }, [bests, mode, playerId]);

  return { best, updateBest };
}
