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

export interface ImportReportRow {
  kind: "failed_episode" | "skipped_episode" | "skipped_show";
  title: string | null;
  tmdbId: number | null;
  seasonNumber: number | null;
  episodeNumber: number | null;
  reason: string;
  sourceShowId: string | null;
}

export interface ImportReport {
  generatedAt: string;
  failedEpisodeCount: number;
  skippedEpisodeCount: number;
  skippedShowCount: number;
  truncated: boolean;
  rows: ImportReportRow[];
}

export interface ImportMappingSkippedShow {
  title: string;
  sourceShowId: string | null;
  reason: string;
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
  /** Snapshot of skips/failures captured before staging cleanup. */
  report: ImportReport | null;
  /** Mapping misses retained until the final import report is generated. */
  mappingSkippedShows?: ImportMappingSkippedShow[];
}

export interface ImportRunResult {
  import: ImportJobSummary;
  processedEpisodes: number;
  remainingEpisodes: number;
  done: boolean;
}
