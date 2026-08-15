import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";

const STORAGE_KEY = "stop_best_score_v2";

type GameMode = "normal" | "quick" | "chaos" | "daily" | "random";
type BestScores = Partial<Record<GameMode, number>>;

function isBestScores(value: unknown): value is BestScores {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  return Object.entries(value).every(([key, score]) =>
    ["normal", "quick", "chaos", "daily", "random"].includes(key) &&
    typeof score === "number" && Number.isFinite(score) && score >= 0,
  );
}

function readLocalBests(): BestScores {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed: unknown = JSON.parse(raw);
    return isBestScores(parsed) ? parsed : {};
  } catch (error) {
    console.warn("Could not read personal bests from local storage", error);
    return {};
  }
}

function writeLocalBests(bests: BestScores): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(bests));
  } catch (error) {
    console.warn("Could not save personal bests to local storage", error);
  }
}

async function syncBestsFromServer(playerId: string): Promise<BestScores> {
  try {
    const r = await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`);
    if (!r.ok) return {};
    const data: unknown = await r.json();
    if (!data || typeof data !== "object" || Array.isArray(data)) return {};
    const personalBests = (data as { personalBests?: unknown }).personalBests;
    return isBestScores(personalBests) ? personalBests : {};
  } catch (error) {
    console.warn("Could not sync personal bests from server", error);
    return {};
  }
}

async function saveBestsToServer(playerId: string, personalBests: BestScores) {
  try {
    await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ personalBests }),
    });
  } catch (error) {
    console.warn("Could not save personal bests to server", error);
  }
}

export function usePersonalBest(mode: GameMode, playerId?: string) {
  const [bests, setBests] = useState<BestScores>(readLocalBests);
  const syncedRef = useRef(false);

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
          writeLocalBests(merged);
          return merged;
        }
        return prev;
      });
    });
  }, [playerId]);

  const best = bests[mode] ?? 0;

  const updateBest = useCallback((score: number): { isNew: boolean; diff: number } => {
    const safeScore = Number.isFinite(score) ? Math.max(0, score) : 0;
    const prev = bests[mode] ?? 0;
    const isNew = safeScore > prev;
    if (isNew) {
      const updated: BestScores = { ...bests, [mode]: safeScore };
      writeLocalBests(updated);
      setBests(updated);
      if (playerId) void saveBestsToServer(playerId, updated);
    }
    return { isNew, diff: safeScore - prev };
  }, [bests, mode, playerId]);

  return { best, updateBest };
}
