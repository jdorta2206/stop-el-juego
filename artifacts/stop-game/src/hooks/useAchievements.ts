import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl } from "@/lib/utils";

const STATS_KEY = "stop_achievement_stats_v1";
const UNLOCKED_KEY = "stop_achievements_unlocked_v1";

export interface AchievementStats {
  totalWins: number;
  totalGames: number;
  maxCombo: number;
  wonSpeedRound: boolean;
  wonChaosRound: boolean;
  validWordsRecord: number;
  xpTotal: number;
}

export interface RoundResult {
  won: boolean;
  validWords: number;
  combo: number;
  wasSpeedRound: boolean;
  wasChaosRound: boolean;
  xpGained: number;
}

export interface AchievementDef {
  id: string;
  icon: string;
  nameKey: string;
  descKey: string;
  xpReward: number;
  check: (stats: AchievementStats) => boolean;
}

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_win", icon: "🏆", nameKey: "first_win_name", descKey: "first_win_desc", xpReward: 50,
    check: s => s.totalWins >= 1,
  },
  {
    id: "combo3", icon: "🔥", nameKey: "combo3_name", descKey: "combo3_desc", xpReward: 100,
    check: s => s.maxCombo >= 3,
  },
  {
    id: "speed_demon", icon: "⚡", nameKey: "speed_demon_name", descKey: "speed_demon_desc", xpReward: 75,
    check: s => s.wonSpeedRound,
  },
  {
    id: "chaos_master", icon: "🌀", nameKey: "chaos_master_name", descKey: "chaos_master_desc", xpReward: 150,
    check: s => s.wonChaosRound,
  },
  {
    id: "wordsmith", icon: "📝", nameKey: "wordsmith_name", descKey: "wordsmith_desc", xpReward: 100,
    check: s => s.validWordsRecord >= 7,
  },
  {
    id: "veteran", icon: "🎖️", nameKey: "veteran_name", descKey: "veteran_desc", xpReward: 150,
    check: s => s.totalGames >= 25,
  },
  {
    id: "champion", icon: "🥊", nameKey: "champion_name", descKey: "champion_desc", xpReward: 200,
    check: s => s.totalWins >= 10,
  },
  {
    id: "unstoppable", icon: "👑", nameKey: "unstoppable_name", descKey: "unstoppable_desc", xpReward: 500,
    check: s => s.totalWins >= 50,
  },
];

function defaultStats(): AchievementStats {
  return {
    totalWins: 0, totalGames: 0, maxCombo: 0,
    wonSpeedRound: false, wonChaosRound: false,
    validWordsRecord: 0, xpTotal: 0,
  };
}

function loadStats(): AchievementStats {
  try {
    const s = localStorage.getItem(STATS_KEY);
    return s ? { ...defaultStats(), ...JSON.parse(s) } : defaultStats();
  } catch { return defaultStats(); }
}

function saveStatsLocal(stats: AchievementStats) {
  try { localStorage.setItem(STATS_KEY, JSON.stringify(stats)); } catch {}
}

function loadUnlocked(): Set<string> {
  try {
    const s = localStorage.getItem(UNLOCKED_KEY);
    return s ? new Set(JSON.parse(s)) : new Set();
  } catch { return new Set(); }
}

function saveUnlocked(unlocked: Set<string>) {
  try { localStorage.setItem(UNLOCKED_KEY, JSON.stringify([...unlocked])); } catch {}
}

// Merge two stat objects: take max of numerics, OR of booleans
function mergeStats(local: AchievementStats, remote: Partial<AchievementStats>): AchievementStats {
  return {
    totalWins: Math.max(local.totalWins, Number(remote.totalWins ?? 0)),
    totalGames: Math.max(local.totalGames, Number(remote.totalGames ?? 0)),
    maxCombo: Math.max(local.maxCombo, Number(remote.maxCombo ?? 0)),
    wonSpeedRound: local.wonSpeedRound || Boolean(remote.wonSpeedRound),
    wonChaosRound: local.wonChaosRound || Boolean(remote.wonChaosRound),
    validWordsRecord: Math.max(local.validWordsRecord, Number(remote.validWordsRecord ?? 0)),
    xpTotal: Math.max(local.xpTotal, Number(remote.xpTotal ?? 0)),
  };
}

async function syncFromServer(playerId: string): Promise<{
  achievements: string[];
  stats: Partial<AchievementStats>;
}> {
  try {
    const r = await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`);
    if (!r.ok) return { achievements: [], stats: {} };
    const data = await r.json();
    return {
      achievements: Array.isArray(data.achievements) ? data.achievements : [],
      stats: data.stats && typeof data.stats === "object" ? data.stats : {},
    };
  } catch { return { achievements: [], stats: {} }; }
}

async function saveToServer(
  playerId: string,
  achievements: string[],
  stats: AchievementStats,
) {
  try {
    await fetch(`${getApiUrl()}/api/ranking/progress/${playerId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ achievements, stats }),
    });
  } catch {}
}

export function useAchievements(playerId?: string) {
  const [stats, setStats] = useState<AchievementStats>(loadStats);
  const [unlocked, setUnlocked] = useState<Set<string>>(loadUnlocked);
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementDef | null>(null);
  const syncedRef = useRef(false);

  // ── Sync from server on mount — server wins, then merge with local ────────
  useEffect(() => {
    if (!playerId || syncedRef.current) return;
    syncedRef.current = true;
    syncFromServer(playerId).then(({ achievements: serverIds, stats: serverStats }) => {
      // Merge achievements
      setUnlocked(prev => {
        const merged = new Set([...prev, ...serverIds]);
        if (merged.size !== prev.size) {
          saveUnlocked(merged);
          return merged;
        }
        return prev;
      });

      // Merge stats — server wins on any value that is higher
      if (Object.keys(serverStats).length > 0) {
        setStats(prev => {
          const merged = mergeStats(prev, serverStats);
          // Only update localStorage if something changed
          if (JSON.stringify(merged) !== JSON.stringify(prev)) {
            saveStatsLocal(merged);
            return merged;
          }
          return prev;
        });
      }
    });
  }, [playerId]);

  const afterRound = useCallback((result: RoundResult) => {
    const current = loadStats();
    const next: AchievementStats = {
      totalWins: current.totalWins + (result.won ? 1 : 0),
      totalGames: current.totalGames + 1,
      maxCombo: Math.max(current.maxCombo, result.combo),
      wonSpeedRound: current.wonSpeedRound || (result.wasSpeedRound && result.won),
      wonChaosRound: current.wonChaosRound || (result.wasChaosRound && result.won),
      validWordsRecord: Math.max(current.validWordsRecord, result.validWords),
      xpTotal: current.xpTotal + result.xpGained,
    };
    saveStatsLocal(next);
    setStats(next);

    const currentUnlocked = loadUnlocked();
    const newUnlocked = new Set(currentUnlocked);
    let justUnlocked: AchievementDef | null = null;
    for (const ach of ACHIEVEMENTS) {
      if (!newUnlocked.has(ach.id) && ach.check(next)) {
        newUnlocked.add(ach.id);
        if (!justUnlocked) justUnlocked = ach;
      }
    }
    if (justUnlocked) {
      saveUnlocked(newUnlocked);
      setUnlocked(newUnlocked);
      setNewlyUnlocked(justUnlocked);
    }
    // Always persist stats + achievements to server after every round
    if (playerId) saveToServer(playerId, [...newUnlocked], next);
  }, [playerId]);

  const clearNewlyUnlocked = useCallback(() => setNewlyUnlocked(null), []);

  return { stats, unlocked, newlyUnlocked, afterRound, clearNewlyUnlocked };
}
