export interface EpisodeProgress {
  episodeKey: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
  watched: boolean;
  watchedAt: string | null;
  updatedAt: string | null;
}

export interface ProgressEpisodePointer {
  episodeKey: string;
  seasonNumber: number;
  episodeNumber: number;
  episodeTitle: string;
}

export interface ShowProgressSummary {
  showId: string;
  tmdbId: number;
  title: string;
  totalEpisodes: number;
  watchedEpisodeCount: number;
  progressPercent: number;
  currentSeason: number | null;
  currentEpisode: number | null;
  nextEpisode: ProgressEpisodePointer | null;
  updatedAt: string | null;
}

export interface ShowProgress extends ShowProgressSummary {
  episodes: EpisodeProgress[];
}

export interface ProgressResponse {
  progress: ShowProgress | null;
}

export interface ProgressListResponse {
  items: ShowProgressSummary[];
}

export interface MarkEpisodeWatchedInput {
  seasonNumber: number;
  episodeNumber: number;
}

export interface BatchEpisodeProgressInput {
  watched: boolean;
  episodes: MarkEpisodeWatchedInput[];
}
