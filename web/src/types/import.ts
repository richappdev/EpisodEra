export type ImportProvider = "tv_time";

export type ImportStatus =
  | "draft"
  | "staged"
  | "running"
  | "completed"
  | "failed"
  | "cancelled";

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
  stagingClearedAt: string | null;
  stagingDocsDeleted: number;
  /** Snapshot of skips/failures captured before staging cleanup. */
  report: ImportReport | null;
}

export interface ImportRunResult {
  import: ImportJobSummary;
  processedEpisodes: number;
  remainingEpisodes: number;
  done: boolean;
}

export interface ImportWatchlistItemInput {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  status: string;
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

export interface ResolveTvTimeShowInput {
  sourceShowId: string;
  title: string;
}

export interface AcceptedTvTimeShowMapping {
  sourceShowId: string;
  tmdbId: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  confidence: number;
  matchMethod: string;
}

export interface TvTimeMappingCandidate {
  tmdbId: number;
  title: string;
  poster: string | null;
  backdrop: string | null;
  year: string | null;
}

export interface SkippedTvTimeShowMapping {
  sourceShowId: string;
  title: string;
  reason: string;
  confidence?: number;
  notes?: string;
  candidates: TvTimeMappingCandidate[];
}

export interface ResolveTvTimeShowsResponse {
  accepted: AcceptedTvTimeShowMapping[];
  skipped: SkippedTvTimeShowMapping[];
}

export interface MediaMapping {
  provider: "tv_time";
  mediaType: "tv" | "movie";
  externalId: string;
  tmdbId: number;
  title: string | null;
  updatedBy: string | null;
  updatedAt: string | null;
}
