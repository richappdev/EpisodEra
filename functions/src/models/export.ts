import {HistoryEntry} from "./history";
import {ShowProgress} from "./progress";
import {WatchlistItem} from "./watchlist";

/** Bump when the on-disk / API export shape changes incompatibly. */
export const EXPORT_SCHEMA_VERSION = 1 as const;

export interface UserDataExportManifest {
  schemaVersion: typeof EXPORT_SCHEMA_VERSION;
  exportedAt: string;
  userId: string;
  counts: {
    history: number;
    progressShows: number;
    progressEpisodes: number;
    watchlist: number;
  };
}

export interface UserDataExport {
  manifest: UserDataExportManifest;
  history: HistoryEntry[];
  progress: ShowProgress[];
  watchlist: WatchlistItem[];
}
