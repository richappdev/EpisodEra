import {UserStats} from "../models/stats";
import {fetchAllPages} from "../lib/pagination";
import {progressService} from "./progressService";
import {watchlistService} from "./watchlistService";

class StatsService {
  async get(userId: string): Promise<UserStats> {
    const [watchlistItems, progressItems] = await Promise.all([
      fetchAllPages((pagination) => watchlistService.list(userId, pagination)),
      fetchAllPages((pagination) => progressService.list(userId, pagination)),
    ]);
    const fullyWatchedShowIds = new Set(
      progressItems
        .filter((progress) => progress.progressPercent >= 100)
        .map((progress) => progress.tmdbId),
    );
    const completedWatchlistShowIds = new Set(
      watchlistItems
        .filter((item) => item.mediaType === "tv" && item.status === "completed")
        .map((item) => item.tmdbId),
    );

    return {
      totalWatchedMovies: watchlistItems.filter((item) => item.mediaType === "movie" && item.status === "watched").length,
      totalWatchedEpisodes: progressItems.reduce((total, progress) => total + progress.watchedEpisodeCount, 0),
      currentlyWatchingCount: watchlistItems.filter((item) => item.mediaType === "tv" && item.status === "watching").length,
      completedShowsCount: new Set([...completedWatchlistShowIds, ...fullyWatchedShowIds]).size,
      watchlistCount: watchlistItems.length,
      progressShowCount: progressItems.length,
    };
  }
}

export const statsService = new StatsService();
