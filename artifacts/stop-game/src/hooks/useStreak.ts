import { useState, useEffect } from "react";

interface StreakData {
  current: number;
  longest: number;
  lastPlayedDate: string | null;
}

const STORAGE_KEY = "stop_streak_v1";
const DEFAULT_STREAK: StreakData = { current: 0, longest: 0, lastPlayedDate: null };

function isValidDate(value: unknown): value is string | null {
  return value === null || (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value));
}

function isValidStreakData(value: unknown): value is StreakData {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const data = value as Record<string, unknown>;
  return Number.isInteger(data.current) &&
    Number.isInteger(data.longest) &&
    data.current >= 0 &&
    data.longest >= 0 &&
    data.longest >= data.current &&
    isValidDate(data.lastPlayedDate);
}

function getTodayStr(): string {
  return new Date().toISOString().slice(0, 10);
}

function getYesterdayStr(): string {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.toISOString().slice(0, 10);
}

function loadStreak(): StreakData {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STREAK;
    const parsed: unknown = JSON.parse(raw);
    return isValidStreakData(parsed) ? parsed : DEFAULT_STREAK;
  } catch (error) {
    console.warn("Could not load streak from local storage", error);
    return DEFAULT_STREAK;
  }
}

function saveStreak(data: StreakData): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  } catch (error) {
    console.warn("Could not save streak to local storage", error);
  }
}

export function useStreak() {
  const [streak, setStreak] = useState<StreakData>(loadStreak);

  useEffect(() => {
    const data = loadStreak();
    const today = getTodayStr();
    const yesterday = getYesterdayStr();

    if (
      data.lastPlayedDate &&
      data.lastPlayedDate !== today &&
      data.lastPlayedDate !== yesterday
    ) {
      const reset = { ...data, current: 0 };
      saveStreak(reset);
      setStreak(reset);
    } else {
      setStreak(data);
    }
  }, []);

  function recordPlay() {
    setStreak(prev => {
      const today = getTodayStr();
      const yesterday = getYesterdayStr();

      if (prev.lastPlayedDate === today) return prev;

      const newCurrent = prev.lastPlayedDate === yesterday ? prev.current + 1 : 1;
      const updated: StreakData = {
        current: newCurrent,
        longest: Math.max(prev.longest, newCurrent),
        lastPlayedDate: today,
      };
      saveStreak(updated);
      return updated;
    });
  }

  const playedToday = streak.lastPlayedDate === getTodayStr();

  return { streak, recordPlay, playedToday };
}
