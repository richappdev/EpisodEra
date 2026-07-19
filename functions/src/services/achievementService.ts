import {fetchAllPages} from "../lib/pagination";
import {AchievementsResponse} from "../models/achievement";
import {evaluateAchievements} from "./achievementLogic";
import {franchiseCatalogLoader} from "./franchiseCatalogLoader";
import {buildFranchiseProgress} from "./franchiseLogic";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {settingsService} from "./settingsService";
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

    const [history, watchlistItems, progressItems, {catalogs}] = await Promise.all([
      fetchAllPages((pagination) => historyService.list(userId, pagination)),
      fetchAllPages((pagination) => watchlistService.list(userId, pagination)),
      fetchAllPages((pagination) => progressService.list(userId, pagination)),
      franchiseCatalogLoader.listPublished(),
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
    });

    return {
      enabled: true,
      showOnProfile: settings.showAchievementsOnProfile,
      items,
      unlockedCount: items.filter((item) => item.unlocked).length,
    };
  }
}

export const achievementService = new AchievementService();
