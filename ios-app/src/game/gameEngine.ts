export type GameMode = 'normal' | 'quick' | 'chaos' | 'daily' | 'random';

export type GameCategory = {
  id: string;
  name: string;
};

export type RoundAnswer = {
  category: string;
  word: string;
};

export type CategoryResult = {
  player?: { response: string; score: number; valid: boolean; isDuplicate?: boolean };
  ai?: { response: string; score: number };
};

export type ValidateRoundResult = {
  playerTotalScore: number;
  aiTotalScore: number;
  results: Record<string, CategoryResult>;
  scoreToken?: string;
};

export type GameRound = {
  round: number;
  maxRounds: number;
  mode: GameMode;
  letter: string;
  categories: GameCategory[];
  answers: Record<string, string>;
  seconds: number;
};

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
export const NORMAL_ROUND_SECONDS = 60;
export const QUICK_ROUND_SECONDS = 30;
export const MAX_ROUNDS = 3;

export function pickLetter(excluded: string[] = []): string {
  const available = ALPHABET.filter((letter) => !excluded.includes(letter));
  return available[Math.floor(Math.random() * available.length)] ?? 'A';
}

export function getRoundSeconds(mode: GameMode): number {
  if (mode === 'quick') return QUICK_ROUND_SECONDS;
  return NORMAL_ROUND_SECONDS;
}

export function createRound(
  categories: GameCategory[],
  options: {
    round?: number;
    mode?: GameMode;
    letter?: string;
    previousLetters?: string[];
  } = {},
): GameRound {
  const mode = options.mode ?? 'normal';
  const round = options.round ?? 1;
  const letter = (options.letter || pickLetter(options.previousLetters)).toUpperCase();

  return {
    round,
    maxRounds: mode === 'daily' || mode === 'quick' ? 1 : MAX_ROUNDS,
    mode,
    letter,
    categories,
    answers: {},
    seconds: getRoundSeconds(mode),
  };
}

export function setAnswer(round: GameRound, category: string, value: string): GameRound {
  return {
    ...round,
    answers: {
      ...round.answers,
      [category]: value.toUpperCase(),
    },
  };
}

export function buildValidationPayload(round: GameRound, language: string, playerName?: string) {
  return {
    letter: round.letter,
    language,
    playerName,
    playerResponses: round.categories.map(({ name }) => ({
      category: name,
      word: round.answers[name] || '',
    })),
  };
}

export function calculatePlayerScore(result: ValidateRoundResult): number {
  return Math.max(0, Number(result.playerTotalScore) || 0);
}

export function hasWonRound(result: ValidateRoundResult): boolean {
  return calculatePlayerScore(result) > Math.max(0, Number(result.aiTotalScore) || 0);
}

export function isFinalRound(round: GameRound): boolean {
  return round.round >= round.maxRounds;
}

export function nextRound(
  current: GameRound,
  categories: GameCategory[],
  previousLetters: string[],
): GameRound | null {
  if (isFinalRound(current)) return null;
  return createRound(categories, {
    round: current.round + 1,
    mode: current.mode,
    previousLetters: [...previousLetters, current.letter],
  });
}
