import {HttpError} from "../lib/httpError";
import {fetchAllPages} from "../lib/pagination";
import {FranchiseOrder, FranchiseProgress, FranchiseSummary} from "../models/franchise";
import {franchiseCatalogLoader} from "./franchiseCatalogLoader";
import {buildFranchiseProgress, listFranchiseSummaries} from "./franchiseLogic";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {settingsService} from "./settingsService";
import {watchlistService} from "./watchlistService";

const parseOrder = (value: unknown): FranchiseOrder =>
  value === "chronological" ? "chronological" : "release";

class FranchiseService {
  async list(): Promise<FranchiseSummary[]> {
    const {catalogs} = await franchiseCatalogLoader.listPublished();
    return listFranchiseSummaries(catalogs);
  }

  async getCatalog(slug: string) {
    const result = await franchiseCatalogLoader.getBySlug(slug);
    if (!result) {
      throw new HttpError(404, "Franchise not found.", "franchise_not_found");
    }
    return result.catalog;
  }

  async getProgress(userId: string, slug: string, orderParam?: unknown): Promise<FranchiseProgress> {
    const catalog = await this.getCatalog(slug);
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
