import { useCallback, useEffect, useState } from "react";

const KEY_DONE = "stop_ftue_done";
const KEY_GAMES = "stop_ftue_games_played";
const KEY_FIRST_WIN = "stop_ftue_first_win_celebrated";
const KEY_WELCOME_SEEN = "stop_ftue_welcome_seen";
const TUTORIAL_GAMES = 3;

function readBool(k: string): boolean {
  try { return localStorage.getItem(k) === "1"; } catch { return false; }
}
function writeBool(k: string, v: boolean) {
  try { localStorage.setItem(k, v ? "1" : "0"); } catch {}
}
function readInt(k: string): number {
  try { return parseInt(localStorage.getItem(k) || "0", 10) || 0; } catch { return 0; }
}
function writeInt(k: string, v: number) {
  try { localStorage.setItem(k, String(v)); } catch {}
}

export function useFTUE() {
  const [done, setDone] = useState<boolean>(() => readBool(KEY_DONE));
  const [gamesPlayed, setGamesPlayed] = useState<number>(() => readInt(KEY_GAMES));
  const [firstWinCelebrated, setFirstWinCelebrated] = useState<boolean>(() => readBool(KEY_FIRST_WIN));
  const [welcomeSeen, setWelcomeSeen] = useState<boolean>(() => readBool(KEY_WELCOME_SEEN));

  // The welcome modal must show exactly once. We use a dedicated persisted
  // flag (not derived from `gamesPlayed`) so closing/skipping the modal
  // before finishing a tutorial game still suppresses it on later visits.
  const isFirstVisit = !done && !welcomeSeen;
  const isInTutorial = !done && gamesPlayed < TUTORIAL_GAMES;

  const dismissWelcome = useCallback(() => {
    writeBool(KEY_WELCOME_SEEN, true);
    setWelcomeSeen(true);
  }, []);

  const recordTutorialGame = useCallback(() => {
    setGamesPlayed((prev) => {
      const next = Math.min(prev + 1, TUTORIAL_GAMES);
      writeInt(KEY_GAMES, next);
      if (next >= TUTORIAL_GAMES) {
        writeBool(KEY_DONE, true);
        setDone(true);
      }
      return next;
    });
  }, []);

  const markFirstWinCelebrated = useCallback(() => {
    writeBool(KEY_FIRST_WIN, true);
    setFirstWinCelebrated(true);
  }, []);

  const finishFTUE = useCallback(() => {
    writeBool(KEY_DONE, true);
    setDone(true);
  }, []);

  // Sync across tabs
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === KEY_DONE) setDone(readBool(KEY_DONE));
      if (e.key === KEY_GAMES) setGamesPlayed(readInt(KEY_GAMES));
      if (e.key === KEY_FIRST_WIN) setFirstWinCelebrated(readBool(KEY_FIRST_WIN));
      if (e.key === KEY_WELCOME_SEEN) setWelcomeSeen(readBool(KEY_WELCOME_SEEN));
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  return {
    isFirstVisit,
    isInTutorial,
    done,
    gamesPlayed,
    firstWinCelebrated,
    tutorialGamesTotal: TUTORIAL_GAMES,
    dismissWelcome,
    recordTutorialGame,
    markFirstWinCelebrated,
    finishFTUE,
  };
}
