import {WatchlistItemRecord, WatchlistRepository, NewWatchlistItem, WatchStatus} from "../types";

/**
 * Thin adapter over existing watchlistService once dual-write is enabled.
 * For now this documents the Firestore side of the repository pair.
 */
export class FirestoreWatchlistRepository implements WatchlistRepository {
  constructor(
    private readonly delegate: {
      list(userId: string): Promise<WatchlistItemRecord[]>;
      add(userId: string, item: NewWatchlistItem): Promise<WatchlistItemRecord>;
      updateStatus(
        userId: string,
        mediaType: "movie" | "tv",
        tmdbId: number,
        status: WatchStatus,
      ): Promise<WatchlistItemRecord | null>;
      remove(userId: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void>;
    },
  ) {}

  list(firebaseUid: string): Promise<WatchlistItemRecord[]> {
    return this.delegate.list(firebaseUid);
  }

  add(firebaseUid: string, item: NewWatchlistItem): Promise<WatchlistItemRecord> {
    return this.delegate.add(firebaseUid, item);
  }

  updateStatus(
    firebaseUid: string,
    mediaType: "movie" | "tv",
    tmdbId: number,
    status: WatchStatus,
  ): Promise<WatchlistItemRecord | null> {
    return this.delegate.updateStatus(firebaseUid, mediaType, tmdbId, status);
  }

  remove(firebaseUid: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void> {
    return this.delegate.remove(firebaseUid, mediaType, tmdbId);
  }
}
