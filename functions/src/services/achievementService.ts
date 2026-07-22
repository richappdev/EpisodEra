import {listAllDocuments} from "../lib/pagination";
import {AchievementsResponse} from "../models/achievement";
import {evaluateAchievements} from "./achievementLogic";
import {derivedCacheService} from "./derivedCacheService";
import {franchiseCatalogLoader} from "./franchiseCatalogLoader";
import {buildFranchiseProgress} from "./franchiseLogic";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {settingsService} from "./settingsService";
import {puzzleService} from "./puzzleService";
import {watchlistService} from "./watchlistService";

class AchievementService {
  async list(userId: string): Promise<AchievementsResponse> {
    const settings = await settingsService.get(userId);
    if (!settings.achievementsEnabled) {
      return {
        enabled: false,
        showOnProfile: false,
        items: [],
        unlockedCount: 0,
      };
    }

    const cachedItems = await derivedCacheService.getAchievements(userId);
    if (cachedItems) {
      return {
        enabled: true,
        showOnProfile: settings.showAchievementsOnProfile,
        items: cachedItems,
        unlockedCount: cachedItems.filter((item) => item.unlocked).length,
      };
    }

    const [history, watchlistItems, progressItems, {catalogs}, gameStats] = await Promise.all([
      listAllDocuments((pagination) => historyService.list(userId, pagination)),
      listAllDocuments((pagination) => watchlistService.list(userId, pagination)),
      listAllDocuments((pagination) => progressService.list(userId, pagination)),
      franchiseCatalogLoader.listPublished(),
      puzzleService.getStats(userId),
    ]);

    const franchiseProgress = catalogs.map((catalog) =>
      buildFranchiseProgress({
        catalog,
        order: "release",
        watchlistItems,
        progressItems,
        historyItems: history,
        preferredProviderIds: settings.preferredProviderIds,
      }),
    );

    const items = evaluateAchievements({
      history,
      watchlistItems,
      progressItems,
      franchiseProgress,
      gameStats,
    });

    await derivedCacheService.setAchievements(userId, items);

    return {
      enabled: true,
      showOnProfile: settings.showAchievementsOnProfile,
      items,
      unlockedCount: items.filter((item) => item.unlocked).length,
    };
  }
}

export const achievementService = new AchievementService();
