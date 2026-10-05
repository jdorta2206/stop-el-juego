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

const MADRID_DATE = new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Madrid", year: "numeric", month: "2-digit", day: "2-digit" });

function getTodayStr(): string {
  return MADRID_DATE.format(new Date());
}

function getYesterdayStr(): string {
  const today = getTodayStr();
  const [year, month, day] = today.split("-").map(Number);
  return MADRID_DATE.format(new Date(Date.UTC(year, month - 1, day - 1, 12)));
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
