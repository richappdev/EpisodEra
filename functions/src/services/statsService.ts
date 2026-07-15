import {UserStats, YearRecap} from "../models/stats";
import {fetchAllPages} from "../lib/pagination";
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
    const [watchlistItems, progressItems, historyItems] = await Promise.all([
      fetchAllPages((pagination) => watchlistService.list(userId, pagination)),
      fetchAllPages((pagination) => progressService.list(userId, pagination)),
      fetchAllPages((pagination) => historyService.list(userId, pagination)),
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

    return {
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
  }

  async getYearRecap(userId: string, year: number): Promise<YearRecap> {
    const historyItems = await fetchAllPages((pagination) => historyService.list(userId, pagination));
    return buildYearRecap(historyItems, year);
  }
}

export const statsService = new StatsService();
