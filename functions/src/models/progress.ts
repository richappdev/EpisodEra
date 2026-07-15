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

export interface MarkEpisodeWatchedInput {
  seasonNumber: number;
  episodeNumber: number;
}

export interface BatchEpisodeProgressInput {
  watched: boolean;
  episodes: MarkEpisodeWatchedInput[];
}

export interface ImportEpisodeWatchedInput {
  seasonNumber: number;
  episodeNumber: number;
  watchedAt?: string | null;
}

export interface ImportEpisodesInput {
  importId: string;
  source?: "tv_time" | "manual" | "bulk_season" | "bulk_fill_previous";
  episodes: ImportEpisodeWatchedInput[];
}
