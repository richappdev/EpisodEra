import {EXPORT_SCHEMA_VERSION, UserDataExport} from "../models/export";
import {ShowProgress} from "../models/progress";
import {fetchAllPages} from "../lib/pagination";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {watchlistService} from "./watchlistService";

const PROGRESS_FETCH_CONCURRENCY = 10;

const mapInChunks = async <T, R>(
  items: T[],
  concurrency: number,
  mapper: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = [];
  for (let index = 0; index < items.length; index += concurrency) {
    const chunk = items.slice(index, index + concurrency);
    const mapped = await Promise.all(chunk.map((item) => mapper(item)));
    results.push(...mapped);
  }
  return results;
};

class ExportService {
  async build(userId: string): Promise<UserDataExport> {
    const [history, progressSummaries, watchlist] = await Promise.all([
      fetchAllPages((pagination) => historyService.list(userId, pagination)),
      fetchAllPages((pagination) => progressService.list(userId, pagination)),
      fetchAllPages((pagination) => watchlistService.list(userId, pagination)),
    ]);

    const progress = (
      await mapInChunks(progressSummaries, PROGRESS_FETCH_CONCURRENCY, async (summary) => {
        const detail = await progressService.get(userId, summary.showId);
        return detail;
      })
    ).filter((item): item is ShowProgress => item != null);

    const progressEpisodes = progress.reduce((total, show) => total + show.episodes.length, 0);

    return {
      manifest: {
        schemaVersion: EXPORT_SCHEMA_VERSION,
        exportedAt: new Date().toISOString(),
        userId,
        counts: {
          history: history.length,
          progressShows: progress.length,
          progressEpisodes,
          watchlist: watchlist.length,
        },
      },
      history,
      progress,
      watchlist,
    };
  }
}

export const exportService = new ExportService();
