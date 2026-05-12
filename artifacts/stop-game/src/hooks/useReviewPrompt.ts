import { useCallback, useEffect, useState } from "react";

const STORAGE_KEY = "stop_review_prompt_v1";
const GAMES_KEY = "stop_games_played_v1";
const SCORE_HIST_KEY = "stop_score_history_v1";

const MIN_GAMES = 3;
const MIN_DAYS_BETWEEN_PROMPTS = 30;
const SNOOZE_DAYS = 7;
const DAY_MS = 24 * 60 * 60 * 1000;

const SCORE_HIST_MAX = 50;
const PERCENTILE_MIN_HISTORY = 5;

interface ReviewState {
  lastShownAt: number | null;
  snoozedUntil: number | null;
  dontAskAgain: boolean;
  rated: boolean;
}

const DEFAULT_STATE: ReviewState = {
  lastShownAt: null,
  snoozedUntil: null,
  dontAskAgain: false,
  rated: false,
};

function safeNumber(v: unknown): number | null {
  const n = typeof v === "number" ? v : Number(v);
  return Number.isFinite(n) ? n : null;
}

function loadState(): ReviewState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ReviewState> & {
      nextEligibleAt?: unknown;
    };
    return {
      lastShownAt: safeNumber(parsed.lastShownAt),
      snoozedUntil:
        safeNumber(parsed.snoozedUntil) ??
        safeNumber(parsed.nextEligibleAt),
      dontAskAgain: parsed.dontAskAgain === true,
      rated: parsed.rated === true,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(s: ReviewState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {}
}

export function recordGamePlayed() {
  try {
    const current = safeNumber(localStorage.getItem(GAMES_KEY)) ?? 0;
    localStorage.setItem(GAMES_KEY, String(current + 1));
  } catch {}
}

function getGamesPlayed(): number {
  try {
    return safeNumber(localStorage.getItem(GAMES_KEY)) ?? 0;
  } catch {
    return 0;
  }
}

function loadScoreHistory(): number[] {
  try {
    const raw = localStorage.getItem(SCORE_HIST_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return [];
    return arr
      .map((x) => safeNumber(x))
      .filter((x): x is number => x !== null);
  } catch {
    return [];
  }
}

function saveScoreHistory(arr: number[]) {
  try {
    localStorage.setItem(SCORE_HIST_KEY, JSON.stringify(arr));
  } catch {}
}

export function recordScoreAndPercentile(score: number): number {
  const hist = loadScoreHistory();
  const fraction =
    hist.length >= PERCENTILE_MIN_HISTORY
      ? hist.filter((s) => s < score).length / hist.length
      : 0;
  const next = [...hist, score].slice(-SCORE_HIST_MAX);
  saveScoreHistory(next);
  return fraction;
}

export interface HappyMoment {
  won?: boolean;
  newPersonalBest?: boolean;
  streakDays?: number;
  scorePercentile?: number;
}

function isHappy(m: HappyMoment): boolean {
  if (m.won) return true;
  if (m.newPersonalBest) return true;
  if ((m.streakDays ?? 0) >= 3) return true;
  if ((m.scorePercentile ?? 0) >= 0.8) return true;
  return false;
}

export function useReviewPrompt() {
  const [state, setState] = useState<ReviewState>(loadState);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    saveState(state);
  }, [state]);

  const eligible = useCallback(
    (moment: HappyMoment): boolean => {
      if (state.dontAskAgain || state.rated) return false;
      if (getGamesPlayed() < MIN_GAMES) return false;
      const now = Date.now();
      if (
        state.lastShownAt &&
        now - state.lastShownAt < MIN_DAYS_BETWEEN_PROMPTS * DAY_MS
      ) {
        return false;
      }
      if (state.snoozedUntil && now < state.snoozedUntil) return false;
      return isHappy(moment);
    },
    [state],
  );

  const maybeShow = useCallback(
    (moment: HappyMoment): boolean => {
      if (!eligible(moment)) return false;
      setOpen(true);
      const now = Date.now();
      setState((s) => ({ ...s, lastShownAt: now, snoozedUntil: null }));
      return true;
    },
    [eligible],
  );

  const close = useCallback(() => {
    setState((s) => ({
      ...s,
      snoozedUntil: Date.now() + SNOOZE_DAYS * DAY_MS,
    }));
    setOpen(false);
  }, []);

  const markRated = useCallback(() => {
    setState((s) => ({ ...s, rated: true }));
    setOpen(false);
  }, []);

  const snooze = useCallback(() => {
    setState((s) => ({
      ...s,
      snoozedUntil: Date.now() + SNOOZE_DAYS * DAY_MS,
    }));
    setOpen(false);
  }, []);

  const dontAskAgain = useCallback(() => {
    setState((s) => ({ ...s, dontAskAgain: true }));
    setOpen(false);
  }, []);

  return { open, maybeShow, close, markRated, snooze, dontAskAgain };
}
