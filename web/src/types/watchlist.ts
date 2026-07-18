import {MediaType} from "./media";
import {PaginatedResponse} from "./pagination";

export const tvWatchlistStatuses = ["planned", "watching", "completed", "dropped"] as const;
export const movieWatchlistStatuses = ["unwatched", "watched"] as const;
export const watchlistStatuses = [...tvWatchlistStatuses, ...movieWatchlistStatuses] as const;

export type WatchlistStatus = (typeof watchlistStatuses)[number];

/** Statuses shown on the Watchlist Active tab (queue to manage). */
export const isActiveWatchlistStatus = (status: WatchlistStatus) =>
  status === "watching" || status === "unwatched";

/** Statuses eligible for Continue Watching (Home resume rail). */
export const isContinueEligibleStatus = (status: WatchlistStatus) =>
  status === "watching" || status === "planned" || status === "unwatched";

/** Statuses that belong on the Library tab (archive / backlog). */
export const isLibraryWatchlistStatus = (status: WatchlistStatus) =>
  status === "planned" || status === "completed" || status === "watched";

export interface WatchlistItem {
  itemId: string;
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster: string | null;
  backdrop: string | null;
  status: WatchlistStatus;
  addedAt: string | null;
  updatedAt: string | null;
}

export interface WatchlistResponse extends PaginatedResponse<WatchlistItem> {}

export interface AddWatchlistItemInput {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  status?: WatchlistStatus;
}
