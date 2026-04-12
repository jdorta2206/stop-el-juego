import { useState, useCallback, useEffect } from "react";
import { getApiUrl } from "@/lib/utils";

const XP_KEY = "stop_xp_v2";

export interface League {
  key: string;
  emoji: string;
  color: string;
  minLevel: number;
}

const LEAGUES: League[] = [
  { key: "bronze",   emoji: "🥉", color: "#cd7f32", minLevel: 1  },
  { key: "silver",   emoji: "🥈", color: "#c0c0c0", minLevel: 5  },
  { key: "gold",     emoji: "🥇", color: "#ffd700", minLevel: 10 },
  { key: "diamond",  emoji: "💎", color: "#67e8f9", minLevel: 15 },
  { key: "master",   emoji: "👑", color: "#f9a825", minLevel: 20 },
];

export function getLeague(level: number): League {
  let league = LEAGUES[0];
  for (const l of LEAGUES) {
    if (level >= l.minLevel) league = l;
  }
  return league;
}

export function getNextLeague(level: number): League | null {
  const current = getLeague(level);
  const idx = LEAGUES.findIndex(l => l.key === current.key);
  return idx < LEAGUES.length - 1 ? LEAGUES[idx + 1] : null;
}

const LEVEL_THRESHOLDS = [
  0, 100, 250, 450, 700, 1000, 1400, 1900, 2500, 3200,
  4000, 5000, 6200, 7600, 9200, 11000, 13000, 15500, 18500, 22000,
];

export function calcLevel(xp: number): number {
  let level = 1;
  for (let i = 0; i < LEVEL_THRESHOLDS.length; i++) {
    if (xp >= LEVEL_THRESHOLDS[i]) level = i + 1;
    else break;
  }
  return level;
}

export function xpForLevel(level: number): number {
  const idx = Math.min(level - 1, LEVEL_THRESHOLDS.length - 1);
  return LEVEL_THRESHOLDS[idx];
}

export function xpForNextLevel(level: number): number {
  const idx = Math.min(level, LEVEL_THRESHOLDS.length - 1);
  return LEVEL_THRESHOLDS[idx];
}

export function calcXpFromResults(
  validWordsCount: number,
  playerScore: number,
  aiScore: number,
): number {
  const base = validWordsCount * 10;
  const winBonus = playerScore > aiScore ? 25 : 0;
  const scorePts = Math.floor(playerScore / 5);
  return base + winBonus + scorePts;
}

export function useProgression(playerId?: string) {
  const [xp, setXp] = useState<number>(() => {
    try {
      const stored = localStorage.getItem(XP_KEY);
      return stored ? parseInt(stored, 10) : 0;
    } catch {
      return 0;
    }
  });

  const [levelUpInfo, setLevelUpInfo] = useState<{ from: number; to: number } | null>(null);

  // ── Sync from server on mount (server is source of truth) ──────────────
  useEffect(() => {
    if (!playerId) return;
    const API = getApiUrl();
    fetch(`${API}/api/ranking/profile/${playerId}`)
      .then(r => r.ok ? r.json() : null)
      .then((data: { xp?: number } | null) => {
        if (data?.xp != null && data.xp > 0) {
          setXp(prev => {
            const serverXp = data.xp as number;
            if (serverXp > prev) {
              try { localStorage.setItem(XP_KEY, String(serverXp)); } catch {}
              return serverXp;
            }
            return prev;
          });
        }
      })
      .catch(() => {});
  }, [playerId]);

  const level = calcLevel(xp);
  const currentLevelXp = xpForLevel(level);
  const nextLevelXp = xpForNextLevel(level);
  const progress =
    nextLevelXp > currentLevelXp
      ? Math.min(100, Math.round(((xp - currentLevelXp) / (nextLevelXp - currentLevelXp)) * 100))
      : 100;

  const addXp = useCallback((amount: number) => {
    setXp(prev => {
      const newXp = prev + amount;
      const oldLevel = calcLevel(prev);
      const newLevel = calcLevel(newXp);
      try {
        localStorage.setItem(XP_KEY, String(newXp));
      } catch {}
      if (newLevel > oldLevel) {
        setLevelUpInfo({ from: oldLevel, to: newLevel });
      }
      return newXp;
    });
  }, []);

  const clearLevelUp = useCallback(() => setLevelUpInfo(null), []);

  return { xp, level, progress, currentLevelXp, nextLevelXp, addXp, levelUpInfo, clearLevelUp };
}
