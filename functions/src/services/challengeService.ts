import {fetchAllPages} from "../lib/pagination";
import {ChallengeProgress} from "../models/social";
import {franchiseCatalogLoader} from "./franchiseCatalogLoader";
import {buildFranchiseProgress} from "./franchiseLogic";
import {friendService} from "./friendService";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {settingsService} from "./settingsService";
import {evaluateChallenges} from "./socialLogic";
import {watchlistService} from "./watchlistService";

class ChallengeService {
  private async completedFranchiseCount(userId: string) {
    const [history, watchlistItems, progressItems, settings, {catalogs}] = await Promise.all([
      fetchAllPages((pagination) => historyService.list(userId, pagination)),
      fetchAllPages((pagination) => watchlistService.list(userId, pagination)),
      fetchAllPages((pagination) => progressService.list(userId, pagination)),
      settingsService.get(userId),
      franchiseCatalogLoader.listPublished(),
    ]);

    return catalogs
      .map((catalog) =>
        buildFranchiseProgress({
          catalog,
          order: "release",
          watchlistItems,
          progressItems,
          historyItems: history,
          preferredProviderIds: settings.preferredProviderIds,
        }),
      )
      .filter((item) => item.progressPercent >= 100).length;
  }

  async list(userId: string, friendUserId?: string): Promise<{items: ChallengeProgress[]}> {
    const history = await fetchAllPages((pagination) => historyService.list(userId, pagination));
    const completedFranchises = await this.completedFranchiseCount(userId);

    if (!friendUserId) {
      return {
        items: evaluateChallenges({history, completedFranchises}),
      };
    }

    const accepted = await friendService.acceptedFriendIds(userId);
    if (!accepted.includes(friendUserId)) {
      return {
        items: evaluateChallenges({history, completedFranchises}),
      };
    }

    const [friendHistory, friendCompletedFranchises] = await Promise.all([
      fetchAllPages((pagination) => historyService.list(friendUserId, pagination)),
      this.completedFranchiseCount(friendUserId),
    ]);

    return {
      items: evaluateChallenges({
        history,
        completedFranchises,
        friendHistory,
        friendCompletedFranchises,
      }),
    };
  }
}

export const challengeService = new ChallengeService();
