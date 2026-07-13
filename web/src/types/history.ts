import {MediaType} from "./media";
import {PaginatedResponse} from "./pagination";

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
}

export interface HistoryResponse extends PaginatedResponse<HistoryEntry> {}
