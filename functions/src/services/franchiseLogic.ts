import {
  FranchiseCatalog,
  FranchiseOrder,
  FranchiseProgress,
  FranchiseSummary,
  FranchiseTitle,
  FranchiseTitleProgress,
  FranchiseTitleStatus,
} from "../models/franchise";
import {HistoryEntry} from "../models/history";
import {ShowProgressSummary} from "../models/progress";
import {WatchlistItem} from "../models/watchlist";

export interface FranchiseProgressInput {
  catalog: FranchiseCatalog;
  order: FranchiseOrder;
  watchlistItems: WatchlistItem[];
  progressItems: ShowProgressSummary[];
  historyItems: HistoryEntry[];
  preferredProviderIds?: number[];
}

const progressPercent = (total: number, watched: number) =>
  total === 0 ? 0 : Number(((watched / total) * 100).toFixed(2));

const titleKey = (mediaType: string, tmdbId: number) => `${mediaType}:${tmdbId}`;

export const listFranchiseSummaries = (catalogs: FranchiseCatalog[]): FranchiseSummary[] =>
  catalogs.map((catalog) => ({
    slug: catalog.slug,
    name: catalog.name,
    description: catalog.description,
    titleCount: catalog.titles.length,
    phaseCount: catalog.phases.length,
  }));

export const sortFranchiseTitles = (titles: FranchiseTitle[], order: FranchiseOrder): FranchiseTitle[] =>
  [...titles].sort((left, right) => {
    const leftOrder = order === "release" ? left.releaseOrder : left.chronologicalOrder;
    const rightOrder = order === "release" ? right.releaseOrder : right.chronologicalOrder;
    if (leftOrder !== rightOrder) {
      return leftOrder - rightOrder;
    }
    return left.title.localeCompare(right.title);
  });

const resolveTitleStatus = (
  title: FranchiseTitle,
  watchlistByKey: Map<string, WatchlistItem>,
  progressById: Map<number, ShowProgressSummary>,
  watchedMovieIds: Set<number>,
): {status: FranchiseTitleStatus; progressPercent: number} => {
  if (title.mediaType === "movie") {
    const watchlist = watchlistByKey.get(titleKey("movie", title.tmdbId));
    if (watchlist?.status === "watched" || watchedMovieIds.has(title.tmdbId)) {
      return {status: "watched", progressPercent: 100};
    }
    return {status: "unwatched", progressPercent: 0};
  }

  const progress = progressById.get(title.tmdbId);
  const watchlist = watchlistByKey.get(titleKey("tv", title.tmdbId));
  if (watchlist?.status === "completed" || (progress && progress.progressPercent >= 100)) {
    return {status: "watched", progressPercent: 100};
  }
  if ((progress && progress.watchedEpisodeCount > 0) || watchlist?.status === "watching") {
    return {status: "in_progress", progressPercent: progress?.progressPercent ?? 0};
  }
  return {status: "unwatched", progressPercent: 0};
};

export const buildFranchiseProgress = ({
  catalog,
  order,
  watchlistItems,
  progressItems,
  historyItems,
  preferredProviderIds = [],
}: FranchiseProgressInput): FranchiseProgress => {
  const watchlistByKey = new Map(watchlistItems.map((item) => [titleKey(item.mediaType, item.tmdbId), item]));
  const progressById = new Map(progressItems.map((item) => [item.tmdbId, item]));
  const watchedMovieIds = new Set(
    historyItems.filter((entry) => entry.mediaType === "movie").map((entry) => entry.tmdbId),
  );
  const phaseNameById = new Map(catalog.phases.map((phase) => [phase.id, phase.name]));

  const titles: FranchiseTitleProgress[] = sortFranchiseTitles(catalog.titles, order).map((title) => {
    const resolved = resolveTitleStatus(title, watchlistByKey, progressById, watchedMovieIds);
    return {
      tmdbId: title.tmdbId,
      mediaType: title.mediaType,
      title: title.title,
      phaseId: title.phaseId,
      phaseName: phaseNameById.get(title.phaseId) ?? title.phaseId,
      releaseOrder: title.releaseOrder,
      chronologicalOrder: title.chronologicalOrder,
      runtimeMinutes: title.runtimeMinutes,
      status: resolved.status,
      progressPercent: resolved.progressPercent,
    };
  });

  const watchedTitles = titles.filter((title) => title.status === "watched").length;
  const inProgressTitles = titles.filter((title) => title.status === "in_progress").length;

  const phases = catalog.phases.map((phase) => {
    const phaseTitles = titles.filter((title) => title.phaseId === phase.id);
    const phaseWatched = phaseTitles.filter((title) => title.status === "watched").length;
    return {
      id: phase.id,
      name: phase.name,
      totalTitles: phaseTitles.length,
      watchedTitles: phaseWatched,
      progressPercent: progressPercent(phaseTitles.length, phaseWatched),
    };
  });

  const preferred = new Set(preferredProviderIds);
  const catalogById = new Map(catalog.titles.map((title) => [titleKey(title.mediaType, title.tmdbId), title]));

  const recommendedNext =
    titles.find((title) => {
      if (title.status === "watched") {
        return false;
      }
      if (preferred.size === 0) {
        return true;
      }
      const source = catalogById.get(titleKey(title.mediaType, title.tmdbId));
      const providerIds = source?.providerIds ?? [];
      return providerIds.length === 0 || providerIds.some((id) => preferred.has(id));
    }) ??
    titles.find((title) => title.status !== "watched") ??
    null;

  return {
    slug: catalog.slug,
    name: catalog.name,
    description: catalog.description,
    order,
    totalTitles: titles.length,
    watchedTitles,
    inProgressTitles,
    progressPercent: progressPercent(titles.length, watchedTitles),
    phases,
    titles,
    recommendedNext,
  };
};
