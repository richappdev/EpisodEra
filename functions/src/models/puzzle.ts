export type PuzzleHintType = "year" | "genre" | "network" | "country" | "cast" | "image";
export type PuzzleDifficulty = "easy" | "medium" | "hard";
export type PuzzleStatus = "draft" | "scheduled" | "published";

export interface PuzzleChoice {
  choiceId: string;
  title: string;
}

export interface PuzzleHint {
  revealAfterAttempt: number;
  type: PuzzleHintType;
  value: string;
}

export interface PublicPuzzleDoc {
  id: string;
  puzzleDate: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  choices: PuzzleChoice[];
  maxAttempts: number;
  nextPuzzleAt: string;
  locale: string;
}

export interface PrivatePuzzleDoc {
  puzzleId: string;
  correctChoiceId: string;
  correctShowId: number;
  hints: PuzzleHint[];
  status: PuzzleStatus;
  difficulty: PuzzleDifficulty;
  seasonNumber: number | null;
  episodeNumber: number | null;
  createdAt: string;
  updatedAt: string;
  publishedAt: string | null;
}

export interface PuzzleAttemptDoc {
  puzzleId: string;
  playerId: string;
  selectedChoiceIds: string[];
  attemptCount: number;
  completed: boolean;
  won: boolean;
  startedAt: string;
  updatedAt: string;
}

export interface UserGameStatsDoc {
  gamesPlayed: number;
  gamesWon: number;
  currentStreak: number;
  longestStreak: number;
  winsByAttempt: {
    1: number;
    2: number;
    3: number;
  };
  lastPlayedPuzzleDate: string | null;
}

export interface PuzzleImageAsset {
  sourceProvider: "tmdb";
  tmdbSeriesId: number;
  seasonNumber: number;
  episodeNumber: number;
  sourceFilePath: string;
  storagePath: string;
  desktopUrl: string;
  mobileUrl: string;
  width: number;
  height: number;
  aspectRatio: number;
  difficulty: PuzzleDifficulty;
  containsLeadCharacter: boolean;
  containsSubtitle: boolean;
  spoilerRisk: "low" | "medium" | "high";
  editorialApproved: boolean;
  createdAt: string;
  updatedAt: string;
}

export interface DailyPuzzleResponse extends PublicPuzzleDoc {
  puzzleId: string;
  attempt: {
    puzzleId: string;
    selectedChoiceIds: string[];
    attemptCount: number;
    completed: boolean;
    won: boolean;
    hints: PuzzleHint[];
    answer: {
      showId: number;
      title: string;
      seasonNumber: number | null;
      episodeNumber: number | null;
    } | null;
  } | null;
}

export interface GuessWrongResponse {
  correct: false;
  attempt: number;
  attemptsRemaining: number;
  hint: PuzzleHint | null;
  selectedChoiceIds: string[];
  completed: false;
  won: false;
}

export interface GuessFinalResponse {
  correct: boolean;
  attempt: number;
  attemptsRemaining: number;
  selectedChoiceIds: string[];
  completed: true;
  won: boolean;
  answer: {
    showId: number;
    title: string;
    seasonNumber: number | null;
    episodeNumber: number | null;
  };
  showPath: string;
  hint?: PuzzleHint | null;
}

export type GuessResponse = GuessWrongResponse | GuessFinalResponse;

export interface UpsertPuzzleInput {
  puzzleDate: string;
  correctShowId: number;
  correctTitle: string;
  seasonNumber: number;
  episodeNumber: number;
  imageUrl: string;
  mobileImageUrl?: string | null;
  choices: PuzzleChoice[];
  correctChoiceId: string;
  hints: PuzzleHint[];
  difficulty: PuzzleDifficulty;
  status: PuzzleStatus;
  locale?: string;
  imageAsset?: Partial<PuzzleImageAsset>;
}

export const emptyUserGameStats = (): UserGameStatsDoc => ({
  gamesPlayed: 0,
  gamesWon: 0,
  currentStreak: 0,
  longestStreak: 0,
  winsByAttempt: {1: 0, 2: 0, 3: 0},
  lastPlayedPuzzleDate: null,
});
