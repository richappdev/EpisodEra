import {HttpError} from "../lib/httpError";
import {fetchAllPages} from "../lib/pagination";
import {franchiseCatalogs, getFranchiseCatalog} from "../data/franchises";
import {FranchiseOrder, FranchiseProgress, FranchiseSummary} from "../models/franchise";
import {buildFranchiseProgress, listFranchiseSummaries} from "./franchiseLogic";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {settingsService} from "./settingsService";
import {watchlistService} from "./watchlistService";

const parseOrder = (value: unknown): FranchiseOrder =>
  value === "chronological" ? "chronological" : "release";

class FranchiseService {
  list(): FranchiseSummary[] {
    return listFranchiseSummaries(franchiseCatalogs);
  }

  getCatalog(slug: string) {
    const catalog = getFranchiseCatalog(slug);
    if (!catalog) {
      throw new HttpError(404, "Franchise not found.", "franchise_not_found");
    }
    return catalog;
  }

  async getProgress(userId: string, slug: string, orderParam?: unknown): Promise<FranchiseProgress> {
    const catalog = this.getCatalog(slug);
    const order = parseOrder(orderParam);
    const [watchlistItems, progressItems, historyItems, settings] = await Promise.all([
      fetchAllPages((pagination) => watchlistService.list(userId, pagination)),
      fetchAllPages((pagination) => progressService.list(userId, pagination)),
      fetchAllPages((pagination) => historyService.list(userId, pagination)),
      settingsService.get(userId),
    ]);

    return buildFranchiseProgress({
      catalog,
      order,
      watchlistItems,
      progressItems,
      historyItems,
      preferredProviderIds: settings.preferredProviderIds,
    });
  }
}

export const franchiseService = new FranchiseService();
