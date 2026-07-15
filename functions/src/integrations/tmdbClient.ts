import {tmdbApiKey, tmdbBaseUrl} from "../config/env";
import {HttpError} from "../lib/httpError";
import {MediaDetail, MediaSummary, PagedResult, TvSeasonDetail} from "../models/media";
import {SupportedLanguage} from "../models/settings";
import {mapMovieDetail, mapPaged, mapTvDetail, mapTvSeasonDetail} from "./tmdbMapper";
import {
  TmdbMovie,
  TmdbMovieDetail,
  TmdbPagedResponse,
  TmdbTv,
  TmdbTvDetail,
  TmdbTvSeasonDetail,
} from "./tmdbTypes";

type QueryValue = string | number | boolean | undefined;

interface CacheEntry<T> {
  expiresAt: number;
  value: T;
}

const metadataTtlMs = 24 * 60 * 60 * 1000;
const trendingTtlMs = 5 * 60 * 1000;

export class TmdbClient {
  private cache = new Map<string, CacheEntry<unknown>>();

  async search(query: string, page = 1, language: SupportedLanguage = "en-US"): Promise<{
    movies: PagedResult<MediaSummary>;
    tv: PagedResult<MediaSummary>;
  }> {
    const [movies, tv] = await Promise.all([
      this.get<TmdbPagedResponse<TmdbMovie>>("/search/movie", {query, page, language}),
      this.get<TmdbPagedResponse<TmdbTv>>("/search/tv", {query, page, language}),
    ]);

    return {
      movies: mapPaged(movies, "movie"),
      tv: mapPaged(tv, "tv"),
    };
  }

  async trending(page = 1, language: SupportedLanguage = "en-US"): Promise<{
    movies: PagedResult<MediaSummary>;
    tv: PagedResult<MediaSummary>;
  }> {
    const [movies, tv] = await Promise.all([this.trendingMovies(page, language), this.trendingTv(page, language)]);

    return {
      movies,
      tv,
    };
  }

  async trendingMovies(page = 1, language: SupportedLanguage = "en-US"): Promise<PagedResult<MediaSummary>> {
    return mapPaged(
      await this.getCached<TmdbPagedResponse<TmdbMovie>>("/trending/movie/week", {page, language}, trendingTtlMs),
      "movie",
    );
  }

  async trendingTv(page = 1, language: SupportedLanguage = "en-US"): Promise<PagedResult<MediaSummary>> {
    return mapPaged(
      await this.getCached<TmdbPagedResponse<TmdbTv>>("/trending/tv/week", {page, language}, trendingTtlMs),
      "tv",
    );
  }

  async movieDetail(id: number, language: SupportedLanguage = "en-US"): Promise<MediaDetail> {
    return mapMovieDetail(await this.getCached<TmdbMovieDetail>(`/movie/${id}`, {language}, metadataTtlMs));
  }

  async tvDetail(id: number, language: SupportedLanguage = "en-US"): Promise<MediaDetail> {
    return mapTvDetail(await this.getCached<TmdbTvDetail>(`/tv/${id}`, {language}, metadataTtlMs));
  }

  async tvSeasonDetail(
    id: number,
    seasonNumber: number,
    language: SupportedLanguage = "en-US",
  ): Promise<TvSeasonDetail> {
    return mapTvSeasonDetail(
      id,
      await this.getCached<TmdbTvSeasonDetail>(`/tv/${id}/season/${seasonNumber}`, {language}, metadataTtlMs),
    );
  }

  async discoverMovies(
    options: {
      page?: number;
      language?: SupportedLanguage;
      withGenres?: string;
      withRuntimeLte?: number;
      withWatchProviders?: string;
      watchRegion?: string;
    } = {},
  ): Promise<PagedResult<MediaSummary>> {
    const {
      page = 1,
      language = "en-US",
      withGenres,
      withRuntimeLte,
      withWatchProviders,
      watchRegion = "US",
    } = options;

    return mapPaged(
      await this.getCached<TmdbPagedResponse<TmdbMovie>>(
        "/discover/movie",
        {
          page,
          language,
          sort_by: "popularity.desc",
          include_adult: false,
          with_genres: withGenres,
          "with_runtime.lte": withRuntimeLte,
          with_watch_providers: withWatchProviders,
          watch_region: withWatchProviders ? watchRegion : undefined,
          with_watch_monetization_types: withWatchProviders ? "flatrate|free|ads|rent|buy" : undefined,
        },
        trendingTtlMs,
      ),
      "movie",
    );
  }

  async discoverTv(
    options: {
      page?: number;
      language?: SupportedLanguage;
      withGenres?: string;
      withWatchProviders?: string;
      watchRegion?: string;
    } = {},
  ): Promise<PagedResult<MediaSummary>> {
    const {
      page = 1,
      language = "en-US",
      withGenres,
      withWatchProviders,
      watchRegion = "US",
    } = options;

    return mapPaged(
      await this.getCached<TmdbPagedResponse<TmdbTv>>(
        "/discover/tv",
        {
          page,
          language,
          sort_by: "popularity.desc",
          include_adult: false,
          with_genres: withGenres,
          with_watch_providers: withWatchProviders,
          watch_region: withWatchProviders ? watchRegion : undefined,
          with_watch_monetization_types: withWatchProviders ? "flatrate|free|ads|rent|buy" : undefined,
        },
        trendingTtlMs,
      ),
      "tv",
    );
  }

  clearCache() {
    this.cache.clear();
  }

  private async getCached<T>(path: string, query: Record<string, QueryValue>, ttlMs: number): Promise<T> {
    const key = this.cacheKey(path, query);
    const cached = this.cache.get(key) as CacheEntry<T> | undefined;

    if (cached && cached.expiresAt > Date.now()) {
      return cached.value;
    }

    const value = await this.get<T>(path, query);
    this.cache.set(key, {
      value,
      expiresAt: Date.now() + ttlMs,
    });

    return value;
  }

  private async get<T>(path: string, query: Record<string, QueryValue> = {}): Promise<T> {
    const url = new URL(`${tmdbBaseUrl}${path}`);
    url.searchParams.set("api_key", tmdbApiKey.value());

    for (const [key, value] of Object.entries(query)) {
      if (value !== undefined) {
        url.searchParams.set(key, String(value));
      }
    }

    const response = await fetch(url);

    if (!response.ok) {
      throw new HttpError(502, `TMDb request failed for ${path}`, "tmdb_request_failed");
    }

    return response.json() as Promise<T>;
  }

  private cacheKey(path: string, query: Record<string, QueryValue>) {
    const pairs = Object.entries(query)
      .filter((entry): entry is [string, string | number | boolean] => entry[1] !== undefined)
      .sort(([left], [right]) => left.localeCompare(right));

    return `${path}?${pairs.map(([key, value]) => `${key}=${String(value)}`).join("&")}`;
  }
}
