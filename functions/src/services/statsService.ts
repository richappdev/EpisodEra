import {UserStats, YearRecap} from "../models/stats";
import {listAllDocuments} from "../lib/pagination";
import {derivedCacheService} from "./derivedCacheService";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {
  buildYearRecap,
  computeStreaks,
  mostActiveMonth,
  rankGenres,
  rankTitles,
  totalWatchTimeMinutes,
} from "./statsLogic";
import {watchlistService} from "./watchlistService";

class StatsService {
  async get(userId: string): Promise<UserStats> {
    const cached = await derivedCacheService.getStats(userId);
    if (cached) {
      return cached;
    }

    const [watchlistItems, progressItems, historyItems] = await Promise.all([
      listAllDocuments((pagination) => watchlistService.list(userId, pagination)),
      listAllDocuments((pagination) => progressService.list(userId, pagination)),
      listAllDocuments((pagination) => historyService.list(userId, pagination)),
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
    const streaks = computeStreaks(historyItems);

    const stats: UserStats = {
      totalWatchedMovies: watchlistItems.filter((item) => item.mediaType === "movie" && item.status === "watched").length,
      totalWatchedEpisodes: progressItems.reduce((total, progress) => total + progress.watchedEpisodeCount, 0),
      currentlyWatchingCount: watchlistItems.filter((item) => item.mediaType === "tv" && item.status === "watching").length,
      completedShowsCount: new Set([...completedWatchlistShowIds, ...fullyWatchedShowIds]).size,
      watchlistCount: watchlistItems.length,
      progressShowCount: progressItems.length,
      totalWatchTimeMinutes: totalWatchTimeMinutes(historyItems),
      longestStreakDays: streaks.longestStreakDays,
      currentStreakDays: streaks.currentStreakDays,
      topShows: rankTitles(historyItems, "tv"),
      topMovies: rankTitles(historyItems, "movie"),
      topGenres: rankGenres(historyItems),
      mostActiveMonth: mostActiveMonth(historyItems),
    };

    await derivedCacheService.setStats(userId, stats);
    return stats;
  }

  async getYearRecap(userId: string, year: number): Promise<YearRecap> {
    const cached = await derivedCacheService.getYearRecap(userId, year);
    if (cached) {
      return cached;
    }

    const historyItems = await listAllDocuments((pagination) => historyService.list(userId, pagination));
    const recap = buildYearRecap(historyItems, year);
    await derivedCacheService.setYearRecap(userId, year, recap);
    return recap;
  }
}

export const statsService = new StatsService();
