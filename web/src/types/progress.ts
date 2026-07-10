export interface EpisodeProgress {
  episodeKey: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  watched: boolean;
  watchedAt: string | null;
  updatedAt: string | null;
}

export interface ShowProgress {
  showId: string;
  tmdbId: number;
  title: string;
  totalEpisodes: number;
  watchedEpisodeCount: number;
  progressPercent: number;
  currentSeason: number | null;
  currentEpisode: number | null;
  updatedAt: string | null;
  episodes: EpisodeProgress[];
}

export interface ProgressResponse {
  progress: ShowProgress | null;
}

export interface MarkEpisodeWatchedInput {
  title: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  totalEpisodes: number;
}
