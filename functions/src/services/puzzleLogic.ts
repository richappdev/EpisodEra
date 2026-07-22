import {PuzzleHint, UserGameStatsDoc} from "../models/puzzle";

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

export const computeStreakUpdate = (input: {
  stats: UserGameStatsDoc;
  puzzleDate: string;
  won: boolean;
  attemptCount: number;
}): UserGameStatsDoc => {
  if (input.stats.lastPlayedPuzzleDate === input.puzzleDate) {
    return input.stats;
  }

  const [year, month, day] = input.puzzleDate.split("-").map(Number);
  const yesterday = utcPuzzleDate(new Date(Date.UTC(year, month - 1, day - 1)));
  const continued = input.stats.lastPlayedPuzzleDate === yesterday;
  const currentStreak = input.won ? (continued ? input.stats.currentStreak + 1 : 1) : 0;
  const winsByAttempt = {...input.stats.winsByAttempt};
  if (input.won && (input.attemptCount === 1 || input.attemptCount === 2 || input.attemptCount === 3)) {
    winsByAttempt[input.attemptCount as 1 | 2 | 3] += 1;
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

export interface DistractorCandidate {
  id: number;
  title: string;
  genreIds: number[];
  releaseYear: number | null;
  popularity: number;
  originCountry: string | null;
  networkOrProvider?: string | null;
}

export const scoreDistractor = (answer: DistractorCandidate, candidate: DistractorCandidate): number => {
  if (candidate.id === answer.id) {
    return -100;
  }

  let score = 0;
  const genreOverlap = candidate.genreIds.some((id) => answer.genreIds.includes(id));
  if (genreOverlap) {
    score += 3;
  }
  if (
    answer.networkOrProvider &&
    candidate.networkOrProvider &&
    answer.networkOrProvider.toLowerCase() === candidate.networkOrProvider.toLowerCase()
  ) {
    score += 2;
  }
  if (
    answer.releaseYear != null &&
    candidate.releaseYear != null &&
    Math.abs(answer.releaseYear - candidate.releaseYear) <= 5
  ) {
    score += 2;
  }
  if (answer.releaseYear != null && candidate.releaseYear != null && Math.abs(answer.releaseYear - candidate.releaseYear) <= 7) {
    score += 0;
  }
  const answerTier = Math.round(Math.log10(Math.max(answer.popularity, 1)));
  const candidateTier = Math.round(Math.log10(Math.max(candidate.popularity, 1)));
  if (answerTier === candidateTier) {
    score += 1;
  }
  if (answer.originCountry && candidate.originCountry && answer.originCountry === candidate.originCountry) {
    score += 1;
  }
  return score;
};

export const rankDistractors = (
  answer: DistractorCandidate,
  candidates: DistractorCandidate[],
  limit = 3,
): DistractorCandidate[] =>
  [...candidates]
    .filter((candidate) => candidate.id !== answer.id)
    .map((candidate) => ({candidate, score: scoreDistractor(answer, candidate)}))
    .sort((left, right) => right.score - left.score || right.candidate.popularity - left.candidate.popularity)
    .slice(0, limit)
    .map((entry) => entry.candidate);

export const buildOpaqueImageUrls = (sourceFilePath: string) => {
  const normalized = sourceFilePath.startsWith("/") ? sourceFilePath : `/${sourceFilePath}`;
  return {
    storagePath: `puzzles/assets${normalized}`,
    desktopUrl: `https://image.tmdb.org/t/p/w1280${normalized}`,
    mobileUrl: `https://image.tmdb.org/t/p/w780${normalized}`,
  };
};
