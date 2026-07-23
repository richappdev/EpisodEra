/** Repository contracts for Firestore → Supabase domain migration (Model A). */

export type WatchStatus = string;

export interface WatchlistItemRecord {
  id: string;
  firebaseUid: string;
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath: string | null;
  backdropPath: string | null;
  status: WatchStatus;
  addedAt: string | null;
  updatedAt: string | null;
}

export interface NewWatchlistItem {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
  posterPath?: string | null;
  backdropPath?: string | null;
  status: WatchStatus;
}

export interface WatchlistRepository {
  list(firebaseUid: string): Promise<WatchlistItemRecord[]>;
  add(firebaseUid: string, item: NewWatchlistItem): Promise<WatchlistItemRecord>;
  updateStatus(
    firebaseUid: string,
    mediaType: "movie" | "tv",
    tmdbId: number,
    status: WatchStatus,
  ): Promise<WatchlistItemRecord | null>;
  remove(firebaseUid: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void>;
}

export interface ProfileRecord {
  firebaseUid: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string;
  photoUrl: string | null;
  bio: string | null;
  country: string | null;
  timezone: string | null;
  friendCode: string | null;
}

export interface ProfileRepository {
  get(firebaseUid: string): Promise<ProfileRecord | null>;
  upsert(firebaseUid: string, profile: Omit<ProfileRecord, "firebaseUid">): Promise<ProfileRecord>;
}

export interface ProgressAggregateRecord {
  firebaseUid: string;
  showTmdbId: number;
  title: string;
  posterPath: string | null;
  totalEpisodes: number;
  watchedEpisodeCount: number;
  progressPercent: number;
  currentSeason: number | null;
  currentEpisode: number | null;
  nextSeasonNumber: number | null;
  nextEpisodeNumber: number | null;
  nextEpisodeTitle: string | null;
  watchedEpisodeKeys: string[];
  updatedAt: string | null;
}

export interface MarkEpisodesInput {
  title: string;
  posterPath?: string | null;
  totalEpisodes: number;
  genreNames?: string[];
  preserveEarliestWatchedAt?: boolean;
  episodes: Array<{
    seasonNumber: number;
    episodeNumber: number;
    episodeTitle: string;
    watched: boolean;
    watchedAt?: string | null;
    source?: string | null;
    sourceImportId?: string | null;
  }>;
}

export interface ProgressRepository {
  get(firebaseUid: string, showTmdbId: number): Promise<ProgressAggregateRecord | null>;
  markEpisodes(
    firebaseUid: string,
    showTmdbId: number,
    input: MarkEpisodesInput,
  ): Promise<ProgressAggregateRecord>;
}

export interface MigrationDomain {
  readonly name: string;
}
