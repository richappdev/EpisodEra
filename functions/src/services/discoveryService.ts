import {franchiseCatalogs} from "../data/franchises";
import {HttpError} from "../lib/httpError";
import {AuthenticatedRequest} from "../middleware/auth";
import {
  DiscoveryListResponse,
  DiscoveryMood,
  DiscoverySuggestionRail,
  DiscoverySuggestionsResponse,
} from "../models/discovery";
import {FranchiseTitleProgress} from "../models/franchise";
import {MediaDetail, MediaSummary} from "../models/media";
import {SupportedLanguage} from "../models/settings";
import {buildFranchiseProgress} from "./franchiseLogic";
import {
  continueFranchiseSuggestions,
  dedupeMediaSummaries,
  isDiscoveryMood,
  moodDefinitions,
  parseProviderIds,
  streamingProviders,
} from "./recommendationLogic";
import {fetchAllPages} from "../lib/pagination";
import {historyService} from "./historyService";
import {progressService} from "./progressService";
import {settingsService} from "./settingsService";
import {tmdbService} from "./tmdbService";
import {watchlistService} from "./watchlistService";

export interface DiscoverySuggestionsQuery {
  mood?: string;
  maxMinutes?: string | number;
  providers?: string;
  region?: string;
  language?: SupportedLanguage;
}

export interface DiscoveryListQuery extends DiscoverySuggestionsQuery {
  page?: string | number;
}

const CONTINUE_FRANCHISE_LIST_ID = "continue-franchise";
const FOR_YOU_LIST_ID = "for-you";

const franchiseTitleToSummary = (title: {
  tmdbId: number;
  mediaType: "movie" | "tv";
  title: string;
}): MediaSummary => ({
  id: title.tmdbId,
  mediaType: title.mediaType,
  title: title.title,
  overview: "",
  releaseDate: null,
  voteAverage: 0,
  popularity: 0,
  images: {poster: null, backdrop: null},
});

const toMediaSummary = (detail: MediaDetail): MediaSummary => ({
  id: detail.id,
  mediaType: detail.mediaType,
  title: detail.title,
  overview: detail.overview,
  releaseDate: detail.releaseDate,
  voteAverage: detail.voteAverage,
  popularity: detail.popularity,
  images: detail.images,
});

/** Load poster/year/rating from TMDb; keep catalog stub if the lookup fails. */
export const hydrateFranchiseTitle = async (
  title: Pick<FranchiseTitleProgress, "tmdbId" | "mediaType" | "title">,
  language: SupportedLanguage = "en-US",
): Promise<MediaSummary> => {
  try {
    const detail =
      title.mediaType === "movie" ?
        await tmdbService.movieDetail(title.tmdbId, language) :
        await tmdbService.tvDetail(title.tmdbId, language);
    return toMediaSummary(detail);
  } catch {
    return franchiseTitleToSummary(title);
  }
};

const parsePage = (value: string | number | undefined): number => {
  const page = Number(value ?? 1);
  return Number.isInteger(page) && page > 0 ? page : 1;
};

const isKnownListId = (listId: string): boolean =>
  listId === CONTINUE_FRANCHISE_LIST_ID || listId === FOR_YOU_LIST_ID || isDiscoveryMood(listId);

class DiscoveryService {
  async suggestions(
    req: AuthenticatedRequest,
    query: DiscoverySuggestionsQuery,
  ): Promise<DiscoverySuggestionsResponse> {
    const mood = typeof query.mood === "string" && isDiscoveryMood(query.mood) ? query.mood : null;
    const context = await this.resolveContext(req, query, mood);
    const rails: DiscoverySuggestionRail[] = [];

    if (req.user?.uid) {
      const continueItems = await this.continueFranchiseItems(req.user.uid, context);
      if (continueItems.length > 0) {
        rails.push({
          id: CONTINUE_FRANCHISE_LIST_ID,
          title: "Continue an unfinished franchise",
          reason: "Next titles from franchises you have started or can pick up next.",
          items: continueItems.slice(0, 10),
        });
      }
    }

    try {
      const discovered = await this.discoverMergedPage(context, 1);
      if (discovered.results.length > 0) {
        rails.push({
          id: mood ?? FOR_YOU_LIST_ID,
          title: context.moodDefinition?.label ?? "Suggested for you",
          reason: context.providerIds.length > 0
            ? `Popular titles filtered for your providers in ${context.region}.`
            : "Popular titles matched to this mood or time budget.",
          items: discovered.results.slice(0, 10),
        });
      }
    } catch {
      // Keep franchise rails even when TMDb discover fails.
    }

    return {
      mood,
      maxMinutes: context.maxMinutes,
      region: context.region,
      providerIds: context.providerIds,
      rails,
      moods: Object.values(moodDefinitions),
      providers: streamingProviders,
    };
  }

  async list(
    req: AuthenticatedRequest,
    listId: string,
    query: DiscoveryListQuery,
  ): Promise<DiscoveryListResponse> {
    if (!isKnownListId(listId)) {
      throw new HttpError(404, "Discovery list was not found.", "discovery_list_not_found");
    }

    const page = parsePage(query.page);
    const mood = isDiscoveryMood(listId) ? listId : null;
    const context = await this.resolveContext(req, query, mood);

    if (listId === CONTINUE_FRANCHISE_LIST_ID) {
      if (!req.user?.uid) {
        return {
          id: CONTINUE_FRANCHISE_LIST_ID,
          title: "Continue an unfinished franchise",
          reason: "Sign in to see unfinished franchises.",
          page: 1,
          totalPages: 1,
          totalResults: 0,
          results: [],
        };
      }

      const results = await this.continueFranchiseItems(req.user.uid, context);
      return {
        id: CONTINUE_FRANCHISE_LIST_ID,
        title: "Continue an unfinished franchise",
        reason: "Next titles from franchises you have started or can pick up next.",
        page: 1,
        totalPages: 1,
        totalResults: results.length,
        results,
      };
    }

    const discovered = await this.discoverMergedPage(context, page);
    return {
      id: listId,
      title: context.moodDefinition?.label ?? "Suggested for you",
      reason: context.providerIds.length > 0
        ? `Popular titles filtered for your providers in ${context.region}.`
        : "Popular titles matched to this mood or time budget.",
      page: discovered.page,
      totalPages: discovered.totalPages,
      totalResults: discovered.totalResults,
      results: discovered.results,
    };
  }

  options() {
    return {
      moods: Object.values(moodDefinitions),
      providers: streamingProviders,
    };
  }

  private async resolveContext(
    req: AuthenticatedRequest,
    query: DiscoverySuggestionsQuery,
    mood: DiscoveryMood | null,
  ) {
    const moodDefinition = mood ? moodDefinitions[mood] : null;
    const parsedMax = Number(query.maxMinutes);
    const maxMinutes =
      Number.isInteger(parsedMax) && parsedMax > 0
        ? parsedMax
        : moodDefinition?.maxRuntimeMinutes ?? null;

    let providerIds = parseProviderIds(query.providers);
    let region =
      typeof query.region === "string" && /^[A-Za-z]{2}$/.test(query.region)
        ? query.region.toUpperCase()
        : "US";
    const language = query.language ?? "en-US";

    if (req.user?.uid) {
      const settings = await settingsService.get(req.user.uid);
      if (providerIds.length === 0) {
        providerIds = settings.preferredProviderIds;
      }
      if (!query.region) {
        region = settings.watchRegion;
      }
    }

    return {mood, moodDefinition, maxMinutes, providerIds, region, language};
  }

  private async continueFranchiseItems(
    uid: string,
    context: {maxMinutes: number | null; providerIds: number[]; language: SupportedLanguage},
  ): Promise<MediaSummary[]> {
    const [watchlistItems, progressItems, historyItems] = await Promise.all([
      fetchAllPages((pagination) => watchlistService.list(uid, pagination)),
      fetchAllPages((pagination) => progressService.list(uid, pagination)),
      fetchAllPages((pagination) => historyService.list(uid, pagination)),
    ]);

    const unfinished = franchiseCatalogs.flatMap((catalog) => {
      const progress = buildFranchiseProgress({
        catalog,
        order: "release",
        watchlistItems,
        progressItems,
        historyItems,
        preferredProviderIds: context.providerIds,
      });
      return progress.recommendedNext ? [progress.recommendedNext] : [];
    });

    const continueTitles = continueFranchiseSuggestions(unfinished, context.maxMinutes);
    return Promise.all(continueTitles.map((title) => hydrateFranchiseTitle(title, context.language)));
  }

  private async discoverMergedPage(
    context: {
      moodDefinition: (typeof moodDefinitions)[DiscoveryMood] | null;
      maxMinutes: number | null;
      providerIds: number[];
      region: string;
      language: SupportedLanguage;
    },
    page: number,
  ): Promise<{page: number; totalPages: number; totalResults: number; results: MediaSummary[]}> {
    const withGenres =
      context.moodDefinition && context.moodDefinition.genreIds.length > 0
        ? context.moodDefinition.genreIds.join("|")
        : undefined;
    const withWatchProviders = context.providerIds.length > 0 ? context.providerIds.join("|") : undefined;
    const discoverOptions = {
      page,
      language: context.language,
      withGenres,
      withWatchProviders,
      watchRegion: context.region,
      withRuntimeLte: context.maxMinutes ?? undefined,
    };

    const [movies, tv] = await Promise.all([
      tmdbService.discoverMovies(discoverOptions),
      tmdbService.discoverTv({
        page,
        language: context.language,
        withGenres,
        withWatchProviders,
        watchRegion: context.region,
      }),
    ]);

    return {
      page,
      totalPages: Math.max(movies.totalPages, tv.totalPages, 1),
      totalResults: movies.totalResults + tv.totalResults,
      results: dedupeMediaSummaries([...movies.results, ...tv.results]),
    };
  }
}

export const discoveryService = new DiscoveryService();
export type {DiscoveryMood};
