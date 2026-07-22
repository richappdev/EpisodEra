import {PuzzleHint, SamplePuzzle} from "../types/dailyPuzzle";

export interface LocalGuessResult {
  correct: boolean;
  attemptCount: number;
  attemptsRemaining: number;
  selectedChoiceIds: string[];
  completed: boolean;
  won: boolean;
  hint: PuzzleHint | null;
  answer: {
    showId: number;
    title: string;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
  } | null;
  showPath: string | null;
}

export const utcPuzzleDate = (now = new Date()): string => {
  const year = now.getUTCFullYear();
  const month = String(now.getUTCMonth() + 1).padStart(2, "0");
  const day = String(now.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const nextUtcMidnightIso = (puzzleDate: string): string => {
  const [year, month, day] = puzzleDate.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, day + 1, 0, 0, 0));
  return next.toISOString();
};

export const hintForAttempt = (hints: PuzzleHint[], attemptCount: number): PuzzleHint | null =>
  hints.find((hint) => hint.revealAfterAttempt === attemptCount) ?? null;

export const formatShareResult = (input: {
  puzzleDate: string;
  won: boolean;
  attemptCount: number;
  maxAttempts: number;
}): string => {
  const marks = Array.from({length: input.maxAttempts}, (_, index) => {
    if (index < input.attemptCount - (input.won ? 1 : 0)) {
      return "🟥";
    }
    if (input.won && index === input.attemptCount - 1) {
      return "🟩";
    }
    if (!input.won && index < input.attemptCount) {
      return "🟥";
    }
    return "";
  }).filter(Boolean);

  const outcome = input.won ? `Correct in ${input.attemptCount}` : "Didn't get it";
  return `Episodera Daily Puzzle ${input.puzzleDate}\n${outcome}\n${marks.join(" ")}`;
};

export const applyLocalGuess = (input: {
  puzzle: SamplePuzzle;
  selectedChoiceIds: string[];
  choiceId: string;
}): LocalGuessResult => {
  const {puzzle, choiceId} = input;
  if (input.selectedChoiceIds.includes(choiceId)) {
    throw new Error("That choice was already selected.");
  }

  if (input.selectedChoiceIds.length >= puzzle.maxAttempts) {
    throw new Error("No attempts remaining.");
  }

  const selectedChoiceIds = [...input.selectedChoiceIds, choiceId];
  const attemptCount = selectedChoiceIds.length;
  const correct = choiceId === puzzle.correctChoiceId;
  const completed = correct || attemptCount >= puzzle.maxAttempts;
  const won = correct;
  const correctChoice = puzzle.choices.find((choice) => choice.choiceId === puzzle.correctChoiceId);

  return {
    correct,
    attemptCount,
    attemptsRemaining: Math.max(puzzle.maxAttempts - attemptCount, 0),
    selectedChoiceIds,
    completed,
    won,
    hint: correct ? null : hintForAttempt(puzzle.hints, attemptCount),
    answer: completed
      ? {
          showId: puzzle.correctShowId,
          title: correctChoice?.title ?? puzzle.choices[0]?.title ?? "Unknown",
          seasonNumber: puzzle.seasonNumber ?? null,
          episodeNumber: puzzle.episodeNumber ?? null,
        }
      : null,
    showPath: completed ? `/tv/${puzzle.correctShowId}` : null,
  };
};

export const computeStreakUpdate = (input: {
  stats: {
    gamesPlayed: number;
    gamesWon: number;
    currentStreak: number;
    longestStreak: number;
    winsByAttempt: {1: number; 2: number; 3: number};
    lastPlayedPuzzleDate: string | null;
  };
  puzzleDate: string;
  won: boolean;
  attemptCount: number;
}) => {
  const alreadyPlayed = input.stats.lastPlayedPuzzleDate === input.puzzleDate;
  if (alreadyPlayed) {
    return input.stats;
  }

  const yesterday = (() => {
    const [year, month, day] = input.puzzleDate.split("-").map(Number);
    const date = new Date(Date.UTC(year, month - 1, day - 1));
    return utcPuzzleDate(date);
  })();

  const continued = input.stats.lastPlayedPuzzleDate === yesterday;
  const currentStreak = input.won ? (continued ? input.stats.currentStreak + 1 : 1) : 0;
  const winsByAttempt = {...input.stats.winsByAttempt};
  if (input.won && (input.attemptCount === 1 || input.attemptCount === 2 || input.attemptCount === 3)) {
    winsByAttempt[input.attemptCount] += 1;
  }

  return {
    gamesPlayed: input.stats.gamesPlayed + 1,
    gamesWon: input.stats.gamesWon + (input.won ? 1 : 0),
    currentStreak,
    longestStreak: Math.max(input.stats.longestStreak, currentStreak),
    winsByAttempt,
    lastPlayedPuzzleDate: input.puzzleDate,
  };
};
