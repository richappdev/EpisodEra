import {MediaType} from "./media";

export interface HistoryEntry {
  historyId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  seasonNumber: number | null;
  episodeNumber: number | null;
  episodeTitle: string | null;
  watchedAt: string | null;
  updatedAt: string | null;
  rewatchCount: number;
  genreNames?: string[];
  runtimeMinutes?: number | null;
}

export interface UpdateHistoryInput {
  watchedAt: string;
}
