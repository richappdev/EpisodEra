import {franchiseCatalogs} from "../data/franchises";
import {AuthenticatedRequest} from "../middleware/auth";
import {
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

class DiscoveryService {
  async suggestions(
    req: AuthenticatedRequest,
    query: DiscoverySuggestionsQuery,
  ): Promise<DiscoverySuggestionsResponse> {
    const mood = typeof query.mood === "string" && isDiscoveryMood(query.mood) ? query.mood : null;
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
    const rails: DiscoverySuggestionRail[] = [];

    if (req.user?.uid) {
      const settings = await settingsService.get(req.user.uid);
      if (providerIds.length === 0) {
        providerIds = settings.preferredProviderIds;
      }
      if (!query.region) {
        region = settings.watchRegion;
      }

      const [watchlistItems, progressItems, historyItems] = await Promise.all([
        fetchAllPages((pagination) => watchlistService.list(req.user!.uid, pagination)),
        fetchAllPages((pagination) => progressService.list(req.user!.uid, pagination)),
        fetchAllPages((pagination) => historyService.list(req.user!.uid, pagination)),
      ]);

      const unfinished = franchiseCatalogs.flatMap((catalog) => {
        const progress = buildFranchiseProgress({
          catalog,
          order: "release",
          watchlistItems,
          progressItems,
          historyItems,
          preferredProviderIds: providerIds,
        });
        return progress.recommendedNext ? [progress.recommendedNext] : [];
      });

      const continueTitles = continueFranchiseSuggestions(unfinished, maxMinutes);
      const continueItems = await Promise.all(
        continueTitles.map((title) => hydrateFranchiseTitle(title, language)),
      );
      if (continueItems.length > 0) {
        rails.push({
          id: "continue-franchise",
          title: "Continue an unfinished franchise",
          reason: "Next titles from franchises you have started or can pick up next.",
          items: continueItems.slice(0, 10),
        });
      }
    }

    const withGenres = moodDefinition && moodDefinition.genreIds.length > 0 ? moodDefinition.genreIds.join("|") : undefined;
    const withWatchProviders = providerIds.length > 0 ? providerIds.join("|") : undefined;
    const discoverOptions = {
      language,
      withGenres,
      withWatchProviders,
      watchRegion: region,
      withRuntimeLte: maxMinutes ?? undefined,
    };

    try {
      const [movies, tv] = await Promise.all([
        tmdbService.discoverMovies(discoverOptions),
        tmdbService.discoverTv({
          language,
          withGenres,
          withWatchProviders,
          watchRegion: region,
        }),
      ]);

      const moodItems = dedupeMediaSummaries([...movies.results, ...tv.results]).slice(0, 10);
      if (moodItems.length > 0) {
        rails.push({
          id: mood ?? "for-you",
          title: moodDefinition?.label ?? "Suggested for you",
          reason: withWatchProviders
            ? `Popular titles filtered for your providers in ${region}.`
            : "Popular titles matched to this mood or time budget.",
          items: moodItems,
        });
      }
    } catch {
      // Keep franchise rails even when TMDb discover fails.
    }

    return {
      mood,
      maxMinutes,
      region,
      providerIds,
      rails,
      moods: Object.values(moodDefinitions),
      providers: streamingProviders,
    };
  }

  options() {
    return {
      moods: Object.values(moodDefinitions),
      providers: streamingProviders,
    };
  }
}

export const discoveryService = new DiscoveryService();
export type {DiscoveryMood};
