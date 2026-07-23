import {NewWatchlistItem, WatchlistItemRecord, WatchlistRepository, WatchStatus} from "../types";

/**
 * Supabase implementation — activated when SUPABASE_URL + service role are configured
 * and Domain migration flag enables shadow or primary writes.
 */
export class SupabaseWatchlistRepository implements WatchlistRepository {
  constructor(private readonly enabled: boolean) {}

  private ensureEnabled(): void {
    if (!this.enabled) {
      throw new Error("SupabaseWatchlistRepository is not enabled");
    }
  }

  async list(_firebaseUid: string): Promise<WatchlistItemRecord[]> {
    this.ensureEnabled();
    throw new Error("SupabaseWatchlistRepository.list not wired — add @supabase/supabase-js client");
  }

  async add(_firebaseUid: string, _item: NewWatchlistItem): Promise<WatchlistItemRecord> {
    this.ensureEnabled();
    throw new Error("SupabaseWatchlistRepository.add not wired — add @supabase/supabase-js client");
  }

  async updateStatus(
    _firebaseUid: string,
    _mediaType: "movie" | "tv",
    _tmdbId: number,
    _status: WatchStatus,
  ): Promise<WatchlistItemRecord | null> {
    this.ensureEnabled();
    throw new Error("SupabaseWatchlistRepository.updateStatus not wired");
  }

  async remove(_firebaseUid: string, _mediaType: "movie" | "tv", _tmdbId: number): Promise<void> {
    this.ensureEnabled();
    throw new Error("SupabaseWatchlistRepository.remove not wired");
  }
}
