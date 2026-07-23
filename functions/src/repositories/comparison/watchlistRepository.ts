import {NewWatchlistItem, WatchlistItemRecord, WatchlistRepository, WatchStatus} from "../types";

/** Reads both stores and reports mismatches for shadow-mode reconciliation. */
export class ComparisonWatchlistRepository implements WatchlistRepository {
  constructor(
    private readonly primary: WatchlistRepository,
    private readonly secondary: WatchlistRepository,
    private readonly onMismatch: (detail: unknown) => void,
  ) {}

  async list(firebaseUid: string): Promise<WatchlistItemRecord[]> {
    const [a, b] = await Promise.all([
      this.primary.list(firebaseUid),
      this.secondary.list(firebaseUid).catch((error) => {
        this.onMismatch({op: "list", error: String(error)});
        return null;
      }),
    ]);
    if (b && a.length !== b.length) {
      this.onMismatch({op: "list", primaryCount: a.length, secondaryCount: b.length});
    }
    return a;
  }

  add(firebaseUid: string, item: NewWatchlistItem): Promise<WatchlistItemRecord> {
    return this.primary.add(firebaseUid, item);
  }

  updateStatus(
    firebaseUid: string,
    mediaType: "movie" | "tv",
    tmdbId: number,
    status: WatchStatus,
  ): Promise<WatchlistItemRecord | null> {
    return this.primary.updateStatus(firebaseUid, mediaType, tmdbId, status);
  }

  remove(firebaseUid: string, mediaType: "movie" | "tv", tmdbId: number): Promise<void> {
    return this.primary.remove(firebaseUid, mediaType, tmdbId);
  }
}
