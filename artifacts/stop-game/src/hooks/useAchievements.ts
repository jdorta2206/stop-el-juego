import { useState, useCallback, useEffect, useRef } from "react";
import { getApiUrl, authHeaders } from "@/lib/utils";

const STATS_KEY = "stop_achievement_stats_v1";
const UNLOCKED_KEY = "stop_achievements_unlocked_v1";
// Used by `recordExternalStat` to hand off unlocks to whichever screen mounts
// `useAchievements` next (Home is the canonical toast surface, but Room/Solo
// might not be mounted when the event fires). Cleared once the toast picks
// it up.
const PENDING_UNLOCK_KEY = "stop_pending_achievement_v1";

export interface AchievementStats {
  totalWins: number;
  totalGames: number;
  maxCombo: number;
  wonSpeedRound: boolean;
  wonChaosRound: boolean;
  validWordsRecord: number;
  xpTotal: number;
  longestStreak: number;
  usedCustomPack: boolean;
  timesShared: number;
  aiZeroWin: boolean;
}

export interface RoundResult {
  won: boolean;
  validWords: number;
  combo: number;
  wasSpeedRound: boolean;
  wasChaosRound: boolean;
  xpGained: number;
  /** Player won this round AND the AI scored 0 — unlocks `shutout`. */
  aiZeroWin?: boolean;
  /** Round was played with a custom (user-defined) category pack — unlocks `creator`. */
  usedCustomPack?: boolean;
}

export interface AchievementDef {
  id: string;
  icon: string;
  /** Optional path to an AI-generated badge PNG (preferred over emoji). */
  image?: string;
  nameKey: string;
  descKey: string;
  xpReward: number;
  check: (stats: AchievementStats) => boolean;
}

// Centralized base path so every achievement def stays one-line readable
// and the BASE_URL prefix (artifact path /stop-game/) is applied uniformly.
const IMG = (id: string) => `${import.meta.env.BASE_URL}achievements/${id}.png`;

export const ACHIEVEMENTS: AchievementDef[] = [
  {
    id: "first_win", icon: "🏆", image: IMG("first_win"), nameKey: "first_win_name", descKey: "first_win_desc", xpReward: 50,
    check: s => s.totalWins >= 1,
  },
  {
    id: "combo3", icon: "🔥", image: IMG("combo3"), nameKey: "combo3_name", descKey: "combo3_desc", xpReward: 100,
    check: s => s.maxCombo >= 3,
  },
  {
    id: "speed_demon", icon: "⚡", image: IMG("speed_demon"), nameKey: "speed_demon_name", descKey: "speed_demon_desc", xpReward: 75,
    check: s => s.wonSpeedRound,
  },
  {
    id: "chaos_master", icon: "🌀", image: IMG("chaos_master"), nameKey: "chaos_master_name", descKey: "chaos_master_desc", xpReward: 150,
    check: s => s.wonChaosRound,
  },
  {
    id: "wordsmith", icon: "📝", image: IMG("wordsmith"), nameKey: "wordsmith_name", descKey: "wordsmith_desc", xpReward: 100,
    check: s => s.validWordsRecord >= 7,
  },
  {
    id: "veteran", icon: "🎖️", image: IMG("veteran"), nameKey: "veteran_name", descKey: "veteran_desc", xpReward: 150,
    check: s => s.totalGames >= 25,
  },
  {
    id: "champion", icon: "🥊", image: IMG("champion"), nameKey: "champion_name", descKey: "champion_desc", xpReward: 200,
    check: s => s.totalWins >= 10,
  },
  {
    id: "unstoppable", icon: "👑", image: IMG("unstoppable"), nameKey: "unstoppable_name", descKey: "unstoppable_desc", xpReward: 500,
    check: s => s.totalWins >= 50,
  },
  // Streak milestones — celebrated by the streak calendar UI on Home.
  {
    id: "streak_3", icon: "🔥", image: IMG("streak_3"), nameKey: "streak_3_name", descKey: "streak_3_desc", xpReward: 75,
    check: s => s.longestStreak >= 3,
  },
  {
    id: "streak_7", icon: "🌟", image: IMG("streak_7"), nameKey: "streak_7_name", descKey: "streak_7_desc", xpReward: 150,
    check: s => s.longestStreak >= 7,
  },
  {
    id: "streak_14", icon: "💎", image: IMG("streak_14"), nameKey: "streak_14_name", descKey: "streak_14_desc", xpReward: 300,
    check: s => s.longestStreak >= 14,
  },
  {
    id: "streak_30", icon: "👑", image: IMG("streak_30"), nameKey: "streak_30_name", descKey: "streak_30_desc", xpReward: 750,
    check: s => s.longestStreak >= 30,
  },
  // ── Recent additions ──────────────────────────────────────────────────────
  // "Creator": premium feature engagement — playing a round with your own
  // custom category pack (solo or as host in multiplayer).
  {
    id: "creator", icon: "🎨", image: IMG("creator"), nameKey: "creator_name", descKey: "creator_desc", xpReward: 200,
    check: s => s.usedCustomPack,
  },
  // "Viral": shared 10 results via the Wordle-style share modal.
  {
    id: "viral", icon: "📣", image: IMG("viral"), nameKey: "viral_name", descKey: "viral_desc", xpReward: 200,
    check: s => s.timesShared >= 10,
  },
  // "Shutout": won a solo round with the AI scoring 0 points — extremely rare.
  {
    id: "shutout", icon: "✨", image: IMG("shutout"), nameKey: "shutout_name", descKey: "shutout_desc", xpReward: 300,
    check: s => s.aiZeroWin,
  },
];

// Streak milestone thresholds — kept in sync with the four streak achievements
// above so the calendar UI can highlight them.
export const STREAK_MILESTONES = [3, 7, 14, 30] as const;
export type StreakMilestone = typeof STREAK_MILESTONES[number];

const MILESTONE_TO_ACHIEVEMENT: Record<StreakMilestone, string> = {
  3: "streak_3",
  7: "streak_7",
  14: "streak_14",
  30: "streak_30",
};

function defaultStats(): AchievementStats {
  return {
    totalWins: 0, totalGames: 0, maxCombo: 0,
    wonSpeedRound: false, wonChaosRound: false,
    validWordsRecord: 0, xpTotal: 0, longestStreak: 0,
    usedCustomPack: false, timesShared: 0, aiZeroWin: false,
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
    longestStreak: Math.max(local.longestStreak, Number(remote.longestStreak ?? 0)),
    usedCustomPack: local.usedCustomPack || Boolean(remote.usedCustomPack),
    timesShared: Math.max(local.timesShared, Number(remote.timesShared ?? 0)),
    aiZeroWin: local.aiZeroWin || Boolean(remote.aiZeroWin),
  };
}

// Public helper used by the streak calendar to celebrate when a player crosses
// a milestone. Persists locally + on the server, sets `newlyUnlocked` so the
// existing AchievementToast surfaces the new badge, and returns the unlocked
// achievement (or null if nothing new).
export function getStreakMilestoneAchievement(streak: number): AchievementDef | null {
  // Find the highest milestone the streak satisfies.
  const milestone = [...STREAK_MILESTONES].reverse().find(m => streak >= m);
  if (!milestone) return null;
  const id = MILESTONE_TO_ACHIEVEMENT[milestone];
  return ACHIEVEMENTS.find(a => a.id === id) ?? null;
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
      headers: { "Content-Type": "application/json", ...authHeaders() },
      body: JSON.stringify({ achievements, stats }),
    });
  } catch {}
}

export function useAchievements(playerId?: string) {
  const [stats, setStats] = useState<AchievementStats>(loadStats);
  const [unlocked, setUnlocked] = useState<Set<string>>(loadUnlocked);
  const [newlyUnlocked, setNewlyUnlocked] = useState<AchievementDef | null>(null);
  const syncedRef = useRef(false);
  const checkStreakMilestoneRef = useRef<(longestStreak: number) => AchievementDef | null>(() => null);

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

      // Deterministically evaluate streak milestones from the authoritative
      // server-side longestStreak — does NOT depend on the player opening the
      // streak calendar modal. checkStreakMilestone is idempotent.
      const serverLongest = Number(serverStats.longestStreak ?? 0);
      if (serverLongest >= STREAK_MILESTONES[0]) {
        // Defer to next tick so the stats setState above has settled.
        setTimeout(() => checkStreakMilestoneRef.current(serverLongest), 0);
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
      longestStreak: current.longestStreak,
      usedCustomPack: current.usedCustomPack || Boolean(result.usedCustomPack),
      timesShared: current.timesShared,
      aiZeroWin: current.aiZeroWin || Boolean(result.aiZeroWin),
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

  // Called by the streak calendar when the player's longest streak crosses a
  // milestone (3/7/14/30). Unlocks the matching achievement once and triggers
  // the AchievementToast via `newlyUnlocked`.
  const checkStreakMilestone = useCallback((longestStreak: number) => {
    if (!longestStreak || longestStreak < STREAK_MILESTONES[0]) return null;
    const current = loadStats();
    const currentUnlocked = loadUnlocked();
    const newUnlocked = new Set(currentUnlocked);

    // Compute which milestone IDs are missing locally for this streak — this
    // is the source of truth for whether to unlock, NOT the monotonic stats
    // guard. That way an existing player whose server `longestStreak` is
    // already past a milestone but whose local achievements set is missing
    // the badge (fresh device, cleared storage, etc.) still gets unlocked
    // on Home mount / server sync.
    let justUnlocked: AchievementDef | null = null;
    for (const m of STREAK_MILESTONES) {
      if (longestStreak >= m) {
        const id = MILESTONE_TO_ACHIEVEMENT[m];
        if (!newUnlocked.has(id)) {
          newUnlocked.add(id);
          const def = ACHIEVEMENTS.find(a => a.id === id) ?? null;
          // Show the *highest* milestone just crossed.
          if (def) justUnlocked = def;
        }
      }
    }

    // Stats: bump only forward (never regress).
    const nextLongest = Math.max(current.longestStreak, longestStreak);
    const next: AchievementStats =
      nextLongest === current.longestStreak ? current : { ...current, longestStreak: nextLongest };
    if (next !== current) {
      saveStatsLocal(next);
      setStats(next);
    }

    if (justUnlocked) {
      saveUnlocked(newUnlocked);
      setUnlocked(newUnlocked);
      setNewlyUnlocked(justUnlocked);
    }
    // Persist when either stats moved forward or new achievements were added.
    if (playerId && (justUnlocked || next !== current)) {
      saveToServer(playerId, [...newUnlocked], next);
    }
    return justUnlocked;
  }, [playerId]);

  // Keep the ref pointing at the latest closure so the server-sync effect can
  // call it without re-running when the callback identity changes.
  checkStreakMilestoneRef.current = checkStreakMilestone;

  const clearNewlyUnlocked = useCallback(() => setNewlyUnlocked(null), []);

  // Listen for unlocks triggered outside of this hook (e.g. ShareResultsModal,
  // Room.tsx) so the global AchievementToast on Home surfaces them too.
  useEffect(() => {
    const consume = (def: AchievementDef) => {
      setUnlocked(prev => {
        if (prev.has(def.id)) return prev;
        const merged = new Set([...prev, def.id]);
        saveUnlocked(merged);
        return merged;
      });
      // Refresh stats from storage since the external helper persisted them.
      setStats(loadStats());
      setNewlyUnlocked(def);
    };
    const handler = (e: Event) => {
      const def = (e as CustomEvent<AchievementDef>).detail;
      if (!def) return;
      consume(def);
      // Clear the persisted pending unlock — this listener already showed it.
      try { sessionStorage.removeItem(PENDING_UNLOCK_KEY); } catch {}
    };
    window.addEventListener("stop:achievement-unlocked", handler);

    // Replay any pending unlock that fired on a page where this hook wasn't
    // mounted (e.g. Room.tsx during a multiplayer game). Done on every mount
    // — not just first sync — so navigating back to Home reliably toasts.
    try {
      const raw = sessionStorage.getItem(PENDING_UNLOCK_KEY);
      if (raw) {
        const id = JSON.parse(raw) as string;
        const def = ACHIEVEMENTS.find(a => a.id === id);
        if (def) consume(def);
        sessionStorage.removeItem(PENDING_UNLOCK_KEY);
      }
    } catch {}

    return () => window.removeEventListener("stop:achievement-unlocked", handler);
  }, []);

  return { stats, unlocked, newlyUnlocked, afterRound, clearNewlyUnlocked, checkStreakMilestone };
}

/**
 * Stand-alone helper for events that happen *outside* the `useAchievements`
 * hook (sharing a result, joining a multiplayer round with a custom pack, …).
 *
 * Persists stat deltas locally and on the server, evaluates the achievement
 * list, and dispatches a `stop:achievement-unlocked` window event so any
 * mounted `useAchievements` hook surfaces the toast.
 *
 * `timesShared` is treated as an INCREMENT; boolean flags are OR-merged.
 */
export function recordExternalStat(
  playerId: string | undefined,
  patch: { usedCustomPack?: boolean; timesShared?: number; aiZeroWin?: boolean },
) {
  const current = loadStats();
  const next: AchievementStats = {
    ...current,
    usedCustomPack: current.usedCustomPack || Boolean(patch.usedCustomPack),
    timesShared: current.timesShared + (patch.timesShared ?? 0),
    aiZeroWin: current.aiZeroWin || Boolean(patch.aiZeroWin),
  };
  if (JSON.stringify(next) === JSON.stringify(current)) return;
  saveStatsLocal(next);

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
    // Persist for screens that don't mount this hook (Room.tsx). Storing the
    // id only — the consumer resolves the full def from ACHIEVEMENTS.
    try { sessionStorage.setItem(PENDING_UNLOCK_KEY, JSON.stringify(justUnlocked.id)); } catch {}
    window.dispatchEvent(new CustomEvent<AchievementDef>("stop:achievement-unlocked", { detail: justUnlocked }));
  }
  if (playerId) saveToServer(playerId, [...newUnlocked], next);
}
