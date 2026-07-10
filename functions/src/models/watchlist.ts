import {MediaType} from "./media";

export const watchlistStatuses = ["planned", "watching", "completed", "dropped"] as const;

export type WatchlistStatus = (typeof watchlistStatuses)[number];

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

export interface AddWatchlistItemInput {
  tmdbId: number;
  mediaType: MediaType;
  title: string;
  poster?: string | null;
  backdrop?: string | null;
  status?: WatchlistStatus;
}
