import {WatchlistStatus} from "./watchlist";

export const importProviders = ["tv_time"] as const;
export type ImportProvider = (typeof importProviders)[number];

export const importStatuses = [
  "draft",
  "staged",
  "running",
  "completed",
  "failed",
  "cancelled",
] as const;
export type ImportStatus = (typeof importStatuses)[number];

export type StagedEpisodeStatus = "pending" | "imported" | "skipped" | "failed";

export interface ImportWatchlistItemInput {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  status: WatchlistStatus;
  sourceShowId?: string | null;
}

export interface ImportEpisodeInput {
  tmdbId: number;
  seasonNumber: number;
  episodeNumber: number;
  watchedAt?: string | null;
  sourceShowId?: string | null;
  sourceEpisodeId?: string | null;
  bulkType?: string | null;
}

export interface ImportJobSummary {
  importId: string;
  provider: ImportProvider;
  status: ImportStatus;
  sourceHash: string | null;
  watchlistStaged: number;
  episodesStaged: number;
  watchlistImported: number;
  episodesImported: number;
  episodesSkipped: number;
  episodesFailed: number;
  errorMessage: string | null;
  createdAt: string | null;
  updatedAt: string | null;
  completedAt: string | null;
  /** Set when stagedShows/stagedEpisodes were deleted after a successful run. */
  stagingClearedAt: string | null;
  stagingDocsDeleted: number;
}

export interface ImportRunResult {
  import: ImportJobSummary;
  processedEpisodes: number;
  remainingEpisodes: number;
  done: boolean;
}
