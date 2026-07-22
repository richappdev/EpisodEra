import {MediaDetail, TvSeasonDetail} from "../types/media";
import {LikedItem} from "../types/likes";
import {ShowProgress, ShowProgressSummary} from "../types/progress";
import {UserStats, YearRecap} from "../types/stats";
import {WatchlistItem} from "../types/watchlist";

export const now = "2026-07-12T00:00:00.000Z";

export const tvDetail: MediaDetail = {
  id: 1001,
  mediaType: "tv",
  title: "Critical Flow Show",
  overview: "A deterministic TV fixture.",
  releaseDate: "2024-01-01",
  voteAverage: 8.4,
  popularity: 42,
  images: {poster: null, backdrop: null},
  genres: [{id: 18, name: "Drama"}],
  homepage: "https://example.com/show",
  originalLanguage: "en",
  runtimeMinutes: null,
  seasons: [{id: 501, seasonNumber: 1, title: "Season 1", episodeCount: 3, airDate: "2024-01-01", poster: null}],
  status: "Returning Series",
  totalEpisodes: 3,
};

export const movieDetail: MediaDetail = {
  id: 2001,
  mediaType: "movie",
  title: "Critical Flow Movie",
  overview: "A deterministic movie fixture.",
  releaseDate: "2024-02-01",
  voteAverage: 7.2,
  popularity: 24,
  images: {poster: null, backdrop: null},
  genres: [{id: 12, name: "Adventure"}],
  homepage: null,
  originalLanguage: "en",
  runtimeMinutes: 110,
  status: "Released",
};

export const seasonDetail: TvSeasonDetail = {
  id: 501,
  tvId: tvDetail.id,
  seasonNumber: 1,
  title: "Season 1",
  overview: "Season fixture.",
  airDate: "2024-01-01",
  poster: null,
  episodeCount: 3,
  episodes: [
    {
      id: 5001,
      airDate: "2024-01-01",
      episodeKey: "s01e01",
      episodeNumber: 1,
      overview: "Pilot overview.",
      runtimeMinutes: null,
      seasonNumber: 1,
      still: null,
      title: "Pilot",
      voteAverage: 8,
    },
    {
      id: 5002,
      airDate: "2024-01-02",
      episodeKey: "s01e02",
      episodeNumber: 2,
      overview: "Gap overview.",
      runtimeMinutes: null,
      seasonNumber: 1,
      still: null,
      title: "The Gap",
      voteAverage: 8,
    },
  ],
};

export const watchlistItem: WatchlistItem = {
  itemId: `tv_${tvDetail.id}`,
  tmdbId: tvDetail.id,
  mediaType: "tv",
  title: tvDetail.title,
  poster: null,
  backdrop: null,
  status: "watching",
  addedAt: now,
  updatedAt: now,
};

export const likedItem: LikedItem = {
  itemId: `tv_${tvDetail.id}`,
  tmdbId: tvDetail.id,
  mediaType: "tv",
  title: tvDetail.title,
  poster: null,
  backdrop: null,
  likedAt: now,
};

export const progressSummary: ShowProgressSummary = {
  showId: String(tvDetail.id),
  tmdbId: tvDetail.id,
  title: tvDetail.title,
  poster: null,
  totalEpisodes: 3,
  watchedEpisodeCount: 1,
  progressPercent: 33.33,
  currentSeason: 1,
  currentEpisode: 1,
  nextEpisode: {episodeKey: "s01e02", seasonNumber: 1, episodeNumber: 2, episodeTitle: "The Gap"},
  updatedAt: now,
};

export const progress: ShowProgress = {
  ...progressSummary,
  episodes: [
    {
      episodeKey: "s01e01",
      seasonNumber: 1,
      episodeNumber: 1,
      episodeTitle: "Pilot",
      watched: true,
      watchedAt: now,
      updatedAt: now,
    },
  ],
};

export const stats: UserStats = {
  totalWatchedMovies: 0,
  totalWatchedEpisodes: 1,
  currentlyWatchingCount: 1,
  completedShowsCount: 0,
  watchlistCount: 1,
  likedCount: 0,
  progressShowCount: 1,
  totalWatchTimeMinutes: 42,
  longestStreakDays: 1,
  currentStreakDays: 1,
  topShows: [{tmdbId: 1001, mediaType: "tv", title: "Critical Flow Show", count: 1}],
  topMovies: [],
  topGenres: [{name: "Drama", count: 1}],
  mostActiveMonth: "2026-07",
};

export const yearRecap: YearRecap = {
  year: 2026,
  totalWatchedMovies: 0,
  totalWatchedEpisodes: 1,
  totalWatchTimeMinutes: 42,
  longestStreakDays: 1,
  mostActiveMonth: "2026-07",
  topShow: {tmdbId: 1001, mediaType: "tv", title: "Critical Flow Show", count: 1},
  topMovie: null,
  topGenre: {name: "Drama", count: 1},
  newlyDiscovered: [{tmdbId: 1001, mediaType: "tv", title: "Critical Flow Show", count: 1}],
};
