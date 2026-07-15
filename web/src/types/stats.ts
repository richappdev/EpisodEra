import {MediaType} from "./media";

export interface StatsTitleCount {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  count: number;
}

export interface StatsGenreCount {
  name: string;
  count: number;
}

export interface UserStats {
  totalWatchedMovies: number;
  totalWatchedEpisodes: number;
  currentlyWatchingCount: number;
  completedShowsCount: number;
  watchlistCount: number;
  progressShowCount: number;
  totalWatchTimeMinutes: number;
  longestStreakDays: number;
  currentStreakDays: number;
  topShows: StatsTitleCount[];
  topMovies: StatsTitleCount[];
  topGenres: StatsGenreCount[];
  mostActiveMonth: string | null;
}

export interface YearRecap {
  year: number;
  totalWatchedMovies: number;
  totalWatchedEpisodes: number;
  totalWatchTimeMinutes: number;
  longestStreakDays: number;
  mostActiveMonth: string | null;
  topShow: StatsTitleCount | null;
  topMovie: StatsTitleCount | null;
  topGenre: StatsGenreCount | null;
  newlyDiscovered: StatsTitleCount[];
}

export const emptyStats = (): UserStats => ({
  totalWatchedMovies: 0,
  totalWatchedEpisodes: 0,
  currentlyWatchingCount: 0,
  completedShowsCount: 0,
  watchlistCount: 0,
  progressShowCount: 0,
  totalWatchTimeMinutes: 0,
  longestStreakDays: 0,
  currentStreakDays: 0,
  topShows: [],
  topMovies: [],
  topGenres: [],
  mostActiveMonth: null,
});
