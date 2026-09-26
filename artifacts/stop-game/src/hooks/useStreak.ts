import { useState, useEffect } from "react";

interface StreakData {
  current: number;
  longest: number;
  lastPlayedDate: string | null;
}

const STORAGE_KEY = "stop_streak_v1";
function storageKey(playerId?: string) {
  return playerId ? `${STORAGE_KEY}:${playerId}` : `${STORAGE_KEY}:guest`;
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function loadStreak(playerId?: string): StreakData {
  try {
    const raw = localStorage.getItem(storageKey(playerId));
    if (raw) return JSON.parse(raw);
  } catch {}
  return { current: 0, longest: 0, lastPlayedDate: null };
}

function saveStreak(playerId: string | undefined, data: StreakData) {
  localStorage.setItem(storageKey(playerId), JSON.stringify(data));
}

export function useStreak(playerId?: string) {
  const [streak, setStreak] = useState<StreakData>(() => loadStreak(playerId));

  // Recalculate on mount: if last play was not today or yesterday, reset streak
  useEffect(() => {
    const data = loadStreak(playerId);
    const today = getTodayStr();
    const yesterday = getYesterdayStr();

    if (
      data.lastPlayedDate &&
      data.lastPlayedDate !== today &&
      data.lastPlayedDate !== yesterday
    ) {
      const reset = { ...data, current: 0 };
      saveStreak(playerId, reset);
      setStreak(reset);
    } else {
      setStreak(data);
    }
  }, [playerId]);

  function recordPlay() {
    setStreak(prev => {
      const today = getTodayStr();
      const yesterday = getYesterdayStr();

      if (prev.lastPlayedDate === today) return prev; // Already recorded today

      let newCurrent: number;
      if (prev.lastPlayedDate === yesterday) {
        newCurrent = prev.current + 1; // Consecutive day
      } else {
        newCurrent = 1; // New streak or broken streak
      }

      const updated: StreakData = {
        current: newCurrent,
        longest: Math.max(prev.longest, newCurrent),
        lastPlayedDate: today,
      };
      saveStreak(playerId, updated);
      return updated;
    });
  }

  const playedToday = streak.lastPlayedDate === getTodayStr();

  return { streak, recordPlay, playedToday };
}
