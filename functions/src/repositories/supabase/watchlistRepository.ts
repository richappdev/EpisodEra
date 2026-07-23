import {NewWatchlistItem, WatchlistItemRecord, WatchlistRepository, WatchStatus} from "../types";
import {
  removeWatchlistShadow,
  upsertWatchlistShadow,
} from "../../migration/supabaseWriters";
import {WatchlistItem} from "../../models/watchlist";

/** Supabase-backed watchlist repository used by Phase 4–6 adapters. */
export class SupabaseWatchlistRepository implements WatchlistRepository {
  async list(_firebaseUid: string): Promise<WatchlistItemRecord[]> {
    throw new Error("SupabaseWatchlistRepository.list is not used while Firestore remains read primary");
  }

  async add(firebaseUid: string, item: NewWatchlistItem): Promise<WatchlistItemRecord> {
    const mapped: WatchlistItem = {
      itemId: `${item.mediaType}_${item.tmdbId}`,
      tmdbId: item.tmdbId,
      mediaType: item.mediaType,
      title: item.title,
      poster: item.posterPath ?? null,
      backdrop: item.backdropPath ?? null,
      status: item.status as WatchlistItem["status"],
      addedAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    await upsertWatchlistShadow(firebaseUid, mapped);
    return {
      id: mapped.itemId,
      firebaseUid,
      tmdbId: mapped.tmdbId,
      mediaType: mapped.mediaType,
      title: mapped.title,
      posterPath: mapped.poster,
      backdropPath: mapped.backdrop,
      status: mapped.status,
      addedAt: mapped.addedAt,
      updatedAt: mapped.updatedAt,
    };
  }

  async updateStatus(
    firebaseUid: string,
    mediaType: "movie" | "tv",
    tmdbId: number,
    status: WatchStatus,
  ): Promise<WatchlistItemRecord | null> {
    await upsertWatchlistShadow(firebaseUid, {
      itemId: `${mediaType}_${tmdbId}`,
      tmdbId,
      mediaType,
      title: `${mediaType} ${tmdbId}`,
      poster: null,
      backdrop: null,
      status: status as WatchlistItem["status"],
      addedAt: null,
      updatedAt: new Date().toISOString(),
    });
    return null;
  }

  async remove(firebaseUid: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void> {
    await removeWatchlistShadow(firebaseUid, mediaType, tmdbId);
  }
}
