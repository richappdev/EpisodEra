export type PuzzleHintType = "year" | "genre" | "network" | "country" | "cast" | "image";

export interface PuzzleChoice {
  choiceId: string;
  title: string;
}

export interface PuzzleHint {
  revealAfterAttempt: number;
  type: PuzzleHintType;
  value: string;
}

export interface PublicPuzzle {
  puzzleId: string;
  puzzleDate: string;
  imageUrl: string;
  mobileImageUrl?: string | null;
  choices: PuzzleChoice[];
  maxAttempts: number;
  nextPuzzleAt: string;
  locale: string;
}

export interface PuzzleAttemptState {
  puzzleId: string;
  selectedChoiceIds: string[];
  attemptCount: number;
  completed: boolean;
  won: boolean;
  hints: PuzzleHint[];
  answer?: {
    showId: number;
    title: string;
    seasonNumber?: number | null;
    episodeNumber?: number | null;
  } | null;
}

export interface DailyPuzzlePayload extends PublicPuzzle {
  attempt: PuzzleAttemptState | null;
}

export interface GuessRequest {
  choiceId: string;
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
    seasonNumber?: number | null;
    episodeNumber?: number | null;
  };
  showPath: string;
  hint?: PuzzleHint | null;
}

export type GuessResponse = GuessWrongResponse | GuessFinalResponse;

export interface UserGameStats {
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

export interface SamplePuzzle extends PublicPuzzle {
  correctChoiceId: string;
  correctShowId: number;
  hints: PuzzleHint[];
  seasonNumber?: number | null;
  episodeNumber?: number | null;
}

export interface AdminPuzzleDraft {
  puzzleId?: string;
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
  difficulty: "easy" | "medium" | "hard";
  status: "draft" | "scheduled" | "published";
  locale?: string;
}

export interface AdminPuzzleDetail {
  puzzleId: string;
  puzzleDate: string;
  imageUrl: string;
  mobileImageUrl: string | null;
  choices: PuzzleChoice[];
  maxAttempts: number;
  nextPuzzleAt: string;
  locale: string;
  correctChoiceId: string;
  correctShowId: number;
  correctTitle: string;
  hints: PuzzleHint[];
  status: "draft" | "scheduled" | "published";
  difficulty: "easy" | "medium" | "hard";
  seasonNumber: number | null;
  episodeNumber: number | null;
}
